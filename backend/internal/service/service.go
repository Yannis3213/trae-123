package service

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"live-selection-backend/internal/db"
	"live-selection-backend/internal/middleware"
	"live-selection-backend/internal/model"
)

var location *time.Location

func init() {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		location = time.FixedZone("CST", 8*3600)
	} else {
		location = loc
	}
}

func validateOrderContext(order *model.LiveSelectionOrder, user *model.User,
	allowedRoles []string, allowedStatuses []string, reqVersion int, now time.Time,
	writeException func(content string)) (bool, error) {

	roleValid := false
	for _, r := range allowedRoles {
		if user.Role == r {
			roleValid = true
			break
		}
	}
	if !roleValid {
		writeException(fmt.Sprintf("角色校验失败：需要角色%v，当前角色%s", allowedRoles, user.Role))
		return false, fmt.Errorf("角色不匹配，无法操作")
	}

	if order.CurrentHandler != user.Username {
		writeException(fmt.Sprintf("处理人校验失败：当前处理人是%s，操作人是%s",
			order.CurrentHandler, user.Username))
		return false, errors.New("您不是当前处理人，无法操作")
	}

	statusValid := false
	for _, s := range allowedStatuses {
		if order.Status == s {
			statusValid = true
			break
		}
	}
	if !statusValid {
		writeException(fmt.Sprintf("状态校验失败：需要状态%v，当前状态%s",
			allowedStatuses, order.Status))
		return false, fmt.Errorf("当前状态不允许该操作")
	}

	if reqVersion > 0 && order.Version != reqVersion {
		writeException(fmt.Sprintf("版本校验失败：当前版本%d，请求版本%d",
			order.Version, reqVersion))
		return false, errors.New("版本冲突，请刷新后重试")
	}

	if now.After(order.Deadline) && !order.IsOverdue {
		overdueReason := fmt.Sprintf("操作时已超过截止时间%s",
			order.Deadline.Format("2006-01-02 15:04:05"))
		_, _ = db.DB.Exec(`
			UPDATE live_selection_orders 
			SET is_overdue = 1, overdue_reason = ? WHERE id = ?
		`, overdueReason, order.ID)
		order.IsOverdue = true
		order.OverdueReason = overdueReason
		addAuditRemark(order.ID, user.Username, user.Role,
			model.RemarkTypeException, "警告："+overdueReason, now)
	}

	return true, nil
}

func Login(username, password string) (*model.User, string, error) {
	var user model.User
	err := db.DB.QueryRow(
		"SELECT id, username, password, role, name, created_at FROM users WHERE username = ?",
		username,
	).Scan(&user.ID, &user.Username, &user.Password, &user.Role, &user.Name, &user.CreatedAt)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, "", errors.New("用户不存在")
		}
		return nil, "", errors.New("查询用户失败")
	}

	if user.Password != password {
		return nil, "", errors.New("密码错误")
	}

	token, err := middleware.GenerateToken(&user)
	if err != nil {
		return nil, "", errors.New("生成令牌失败")
	}

	return &user, token, nil
}

func GetOrderList(req *model.OrderListRequest, currentUser *model.User) (*model.OrderListResponse, error) {
	page := req.Page
	pageSize := req.PageSize
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	whereClauses := []string{"1=1"}
	args := []interface{}{}

	switch currentUser.Role {
	case model.RoleRegistrar:
		whereClauses = append(whereClauses, "(created_by = ? OR (status IN ('draft','returned') AND current_handler = ?))")
		args = append(args, currentUser.Username, currentUser.Username)
	case model.RoleAuditor:
		whereClauses = append(whereClauses, "status IN ('pending_audit','audit_passed','synced','returned')")
	case model.RoleReviewer:
	}

	if req.Status != "" {
		whereClauses = append(whereClauses, "status = ?")
		args = append(args, req.Status)
	}

	if req.Keyword != "" {
		whereClauses = append(whereClauses, "(product_name LIKE ? OR order_no LIKE ?)")
		args = append(args, "%"+req.Keyword+"%", "%"+req.Keyword+"%")
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM live_selection_orders WHERE %s", whereSQL)
	var total int64
	err := db.DB.QueryRow(countSQL, args...).Scan(&total)
	if err != nil {
		return nil, errors.New("查询总数失败")
	}

	querySQL := fmt.Sprintf(`
		SELECT id, order_no, product_name, product_category, price, stock, status,
		       current_handler, current_role, version, deadline,
		       submission_evidence, sample_evidence, registration_evidence,
		       created_at, updated_at, created_by, exception_reason, is_overdue, overdue_reason
		FROM live_selection_orders
		WHERE %s
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	queryArgs := append(args, pageSize, offset)
	rows, err := db.DB.Query(querySQL, queryArgs...)
	if err != nil {
		return nil, errors.New("查询列表失败")
	}
	defer rows.Close()

	orders := []*model.LiveSelectionOrder{}
	for rows.Next() {
		var o model.LiveSelectionOrder
		var isOverdue int
		err := rows.Scan(
			&o.ID, &o.OrderNo, &o.ProductName, &o.ProductCategory, &o.Price, &o.Stock,
			&o.Status, &o.CurrentHandler, &o.CurrentRole, &o.Version, &o.Deadline,
			&o.SubmissionEvidence, &o.SampleEvidence, &o.RegistrationEvidence,
			&o.CreatedAt, &o.UpdatedAt, &o.CreatedBy, &o.ExceptionReason, &isOverdue, &o.OverdueReason,
		)
		if err != nil {
			return nil, errors.New("扫描数据失败")
		}
		o.IsOverdue = isOverdue == 1
		o.CreatedAt = o.CreatedAt.In(location)
		o.UpdatedAt = o.UpdatedAt.In(location)
		o.Deadline = o.Deadline.In(location)
		orders = append(orders, &o)
	}

	return &model.OrderListResponse{
		List:     orders,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func GetOrderDetail(id int64, user *model.User) (*model.OrderDetailResponse, error) {
	var o model.LiveSelectionOrder
	var isOverdue int
	err := db.DB.QueryRow(`
		SELECT id, order_no, product_name, product_category, price, stock, status,
		       current_handler, current_role, version, deadline,
		       submission_evidence, sample_evidence, registration_evidence,
		       created_at, updated_at, created_by, exception_reason, is_overdue, overdue_reason
		FROM live_selection_orders WHERE id = ?
	`, id).Scan(
		&o.ID, &o.OrderNo, &o.ProductName, &o.ProductCategory, &o.Price, &o.Stock,
		&o.Status, &o.CurrentHandler, &o.CurrentRole, &o.Version, &o.Deadline,
		&o.SubmissionEvidence, &o.SampleEvidence, &o.RegistrationEvidence,
		&o.CreatedAt, &o.UpdatedAt, &o.CreatedBy, &o.ExceptionReason, &isOverdue, &o.OverdueReason,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("选品单不存在")
		}
		return nil, errors.New("查询选品单失败")
	}
	o.IsOverdue = isOverdue == 1
	o.CreatedAt = o.CreatedAt.In(location)
	o.UpdatedAt = o.UpdatedAt.In(location)
	o.Deadline = o.Deadline.In(location)

	attachments, err := getAttachmentsByOrderID(id)
	if err != nil {
		return nil, err
	}

	processRecords, err := getProcessRecordsByOrderID(id)
	if err != nil {
		return nil, err
	}

	auditRemarks, err := getAuditRemarksByOrderID(id)
	if err != nil {
		return nil, err
	}

	isCurrentHandler := o.CurrentHandler == user.Username
	canOperate := isCurrentHandler && o.Status != model.StatusSynced

	return &model.OrderDetailResponse{
		Order:            &o,
		Attachments:      attachments,
		ProcessRecords:   processRecords,
		AuditRemarks:     auditRemarks,
		IsCurrentHandler: isCurrentHandler,
		CanOperate:       canOperate,
	}, nil
}

func getAttachmentsByOrderID(orderID int64) ([]*model.SelectionAttachment, error) {
	rows, err := db.DB.Query(`
		SELECT id, order_id, file_name, file_type, file_url, uploaded_by, uploaded_at, module_type
		FROM selection_attachments WHERE order_id = ? ORDER BY id DESC
	`, orderID)
	if err != nil {
		return nil, errors.New("查询附件失败")
	}
	defer rows.Close()

	attachments := []*model.SelectionAttachment{}
	for rows.Next() {
		var a model.SelectionAttachment
		err := rows.Scan(&a.ID, &a.OrderID, &a.FileName, &a.FileType, &a.FileURL,
			&a.UploadedBy, &a.UploadedAt, &a.ModuleType)
		if err != nil {
			return nil, errors.New("扫描附件数据失败")
		}
		a.UploadedAt = a.UploadedAt.In(location)
		attachments = append(attachments, &a)
	}
	return attachments, nil
}

func getProcessRecordsByOrderID(orderID int64) ([]*model.ProcessRecord, error) {
	rows, err := db.DB.Query(`
		SELECT id, order_id, operator, operator_role, action, from_status, to_status,
		       opinion, version, created_at
		FROM process_records WHERE order_id = ? ORDER BY id ASC
	`, orderID)
	if err != nil {
		return nil, errors.New("查询处理记录失败")
	}
	defer rows.Close()

	records := []*model.ProcessRecord{}
	for rows.Next() {
		var r model.ProcessRecord
		err := rows.Scan(&r.ID, &r.OrderID, &r.Operator, &r.OperatorRole, &r.Action,
			&r.FromStatus, &r.ToStatus, &r.Opinion, &r.Version, &r.CreatedAt)
		if err != nil {
			return nil, errors.New("扫描处理记录失败")
		}
		r.CreatedAt = r.CreatedAt.In(location)
		records = append(records, &r)
	}
	return records, nil
}

func getAuditRemarksByOrderID(orderID int64) ([]*model.AuditRemark, error) {
	rows, err := db.DB.Query(`
		SELECT id, order_id, operator, operator_role, remark_type, content, created_at
		FROM audit_remarks WHERE order_id = ? ORDER BY id ASC
	`, orderID)
	if err != nil {
		return nil, errors.New("查询审计备注失败")
	}
	defer rows.Close()

	remarks := []*model.AuditRemark{}
	for rows.Next() {
		var r model.AuditRemark
		err := rows.Scan(&r.ID, &r.OrderID, &r.Operator, &r.OperatorRole,
			&r.RemarkType, &r.Content, &r.CreatedAt)
		if err != nil {
			return nil, errors.New("扫描审计备注失败")
		}
		r.CreatedAt = r.CreatedAt.In(location)
		remarks = append(remarks, &r)
	}
	return remarks, nil
}

func CreateOrder(req *model.CreateOrderRequest, user *model.User) (*model.LiveSelectionOrder, error) {
	if user.Role != model.RoleRegistrar {
		return nil, errors.New("只有直播选品登记员可以创建选品单")
	}

	if req.ProductName == "" {
		return nil, errors.New("产品名称不能为空")
	}
	if req.ProductCategory == "" {
		return nil, errors.New("产品分类不能为空")
	}

	now := time.Now().In(location)
	orderNo := fmt.Sprintf("XZ%s%06d", now.Format("20060102"), now.Unix()%1000000)

	var deadline time.Time
	if req.Deadline != "" {
		var err error
		deadline, err = time.ParseInLocation("2006-01-02", req.Deadline, location)
		if err != nil {
			deadline, err = time.ParseInLocation(time.RFC3339, req.Deadline, location)
			if err != nil {
				deadline = now.AddDate(0, 0, 7)
			}
		}
	} else {
		deadline = now.AddDate(0, 0, 7)
	}

	submissionEvidence := req.SubmissionEvidence
	if submissionEvidence == "" {
		submissionEvidence = "[]"
	}

	result, err := db.DB.Exec(`
		INSERT INTO live_selection_orders 
		(order_no, product_name, product_category, price, stock, status,
		 current_handler, current_role, version, deadline,
		 submission_evidence, sample_evidence, registration_evidence,
		 created_at, updated_at, created_by, exception_reason, is_overdue, overdue_reason)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		orderNo, req.ProductName, req.ProductCategory, req.Price, req.Stock, model.StatusDraft,
		user.Username, user.Role, 1, deadline,
		submissionEvidence, "[]", "[]",
		now, now, user.Username, "", 0, "",
	)
	if err != nil {
		return nil, errors.New("创建选品单失败")
	}

	id, _ := result.LastInsertId()

	addAuditRemark(id, user.Username, user.Role, model.RemarkTypeStatusChange, "创建选品单", now)

	order := &model.LiveSelectionOrder{
		ID:                 id,
		OrderNo:            orderNo,
		ProductName:        req.ProductName,
		ProductCategory:    req.ProductCategory,
		Price:              req.Price,
		Stock:              req.Stock,
		Status:             model.StatusDraft,
		CurrentHandler:     user.Username,
		CurrentRole:        user.Role,
		Version:            1,
		Deadline:           deadline,
		SubmissionEvidence: submissionEvidence,
		SampleEvidence:     "[]",
		RegistrationEvidence: "[]",
		CreatedAt:          now,
		UpdatedAt:          now,
		CreatedBy:          user.Username,
	}
	return order, nil
}

func SubmitOrder(id int64, req *model.SubmitOrderRequest, user *model.User) error {
	now := time.Now().In(location)

	writeException := func(content string) {
		_, _ = db.DB.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, model.RemarkTypeException, content, now)
	}

	var order model.LiveSelectionOrder
	var isOverdue int
	err := db.DB.QueryRow(`
		SELECT id, status, current_handler, current_role, version, deadline, submission_evidence, sample_evidence, is_overdue
		FROM live_selection_orders WHERE id = ?
	`, id).Scan(&order.ID, &order.Status, &order.CurrentHandler, &order.CurrentRole, &order.Version,
		&order.Deadline, &order.SubmissionEvidence, &order.SampleEvidence, &isOverdue)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("选品单不存在")
		}
		return errors.New("查询选品单失败")
	}
	order.IsOverdue = isOverdue == 1

	allowedRoles := []string{model.RoleRegistrar}
	allowedStatuses := []string{model.StatusDraft, model.StatusReturned}

	valid, err := validateOrderContext(&order, user, allowedRoles, allowedStatuses, req.Version, now, writeException)
	if !valid {
		return err
	}

	if !hasEvidence(order.SubmissionEvidence) {
		writeException("提交审核失败：选品提报证据不能为空")
		return errors.New("提交审核前必须上传选品提报证据")
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeException("提交审核开启事务失败：" + err.Error())
		return errors.New("开启事务失败")
	}
	defer tx.Rollback()

	newVersion := order.Version + 1

	_, err = tx.Exec(`
		UPDATE live_selection_orders 
		SET status = ?, current_handler = ?, current_role = ?, version = ?, 
		    updated_at = ?, exception_reason = ?
		WHERE id = ? AND version = ?
	`, model.StatusPendingAudit, "auditor", model.RoleAuditor, newVersion, now, "", id, req.Version)
	if err != nil {
		writeException("提交审核更新状态失败：" + err.Error())
		return errors.New("更新选品单状态失败")
	}

	_, err = tx.Exec(`
		INSERT INTO process_records 
		(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, "submit", order.Status, model.StatusPendingAudit, "提交审核", newVersion, now)
	if err != nil {
		writeException("提交审核添加处理记录失败：" + err.Error())
		return errors.New("添加处理记录失败")
	}

	_, err = tx.Exec(`
		INSERT INTO audit_remarks 
		(order_id, operator, operator_role, remark_type, content, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, model.RemarkTypeStatusChange,
		fmt.Sprintf("状态变更：%s -> 待审核", order.Status), now)
	if err != nil {
		writeException("提交审核添加审计备注失败：" + err.Error())
		return errors.New("添加审计备注失败")
	}

	return tx.Commit()
}

func AuditOrder(id int64, req *model.AuditOrderRequest, user *model.User) error {
	now := time.Now().In(location)

	writeException := func(content string) {
		_, _ = db.DB.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, model.RemarkTypeException, content, now)
	}

	var order model.LiveSelectionOrder
	var isOverdue int
	err := db.DB.QueryRow(`
		SELECT id, status, current_handler, current_role, version, deadline, sample_evidence, is_overdue
		FROM live_selection_orders WHERE id = ?
	`, id).Scan(&order.ID, &order.Status, &order.CurrentHandler, &order.CurrentRole, &order.Version,
		&order.Deadline, &order.SampleEvidence, &isOverdue)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("选品单不存在")
		}
		return errors.New("查询选品单失败")
	}
	order.IsOverdue = isOverdue == 1

	if strings.TrimSpace(req.Opinion) == "" {
		writeException("审核失败：审核意见不能为空")
		return errors.New("审核意见不能为空")
	}

	allowedRoles := []string{model.RoleAuditor}
	allowedStatuses := []string{model.StatusPendingAudit}

	valid, err := validateOrderContext(&order, user, allowedRoles, allowedStatuses, req.Version, now, writeException)
	if !valid {
		return err
	}

	if req.Pass && !hasEvidence(order.SampleEvidence) {
		writeException("审核通过失败：样品证据不能为空")
		return errors.New("审核通过前必须确认样品证据")
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeException("审核开启事务失败：" + err.Error())
		return errors.New("开启事务失败")
	}
	defer tx.Rollback()

	newVersion := order.Version + 1

	if req.Pass {
		_, err = tx.Exec(`
			UPDATE live_selection_orders 
			SET status = ?, current_handler = ?, current_role = ?, version = ?, updated_at = ?
			WHERE id = ? AND version = ?
		`, model.StatusAuditPassed, "reviewer", model.RoleReviewer, newVersion, now, id, req.Version)
		if err != nil {
			writeException("审核通过更新状态失败：" + err.Error())
			return errors.New("更新选品单状态失败")
		}

		_, err = tx.Exec(`
			INSERT INTO process_records 
			(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, "audit_pass", model.StatusPendingAudit, model.StatusAuditPassed,
			req.Opinion, newVersion, now)
		if err != nil {
			writeException("审核通过添加处理记录失败：" + err.Error())
			return errors.New("添加处理记录失败")
		}

		_, err = tx.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, model.RemarkTypeStatusChange,
			"状态变更：待审核 -> 审核通过", now)
		if err != nil {
			writeException("审核通过添加审计备注失败：" + err.Error())
			return errors.New("添加审计备注失败")
		}
	} else {
		_, err = tx.Exec(`
			UPDATE live_selection_orders 
			SET status = ?, current_handler = ?, current_role = ?, version = ?, 
			    updated_at = ?, exception_reason = ?
			WHERE id = ? AND version = ?
		`, model.StatusReturned, "registrar", model.RoleRegistrar, newVersion, now, req.Opinion, id, req.Version)
		if err != nil {
			writeException("审核退回更新状态失败：" + err.Error())
			return errors.New("更新选品单状态失败")
		}

		_, err = tx.Exec(`
			INSERT INTO process_records 
			(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, "return", model.StatusPendingAudit, model.StatusReturned,
			req.Opinion, newVersion, now)
		if err != nil {
			writeException("审核退回添加处理记录失败：" + err.Error())
			return errors.New("添加处理记录失败")
		}

		_, err = tx.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, model.RemarkTypeException,
			"审核退回："+req.Opinion, now)
		if err != nil {
			writeException("审核退回添加审计备注失败：" + err.Error())
			return errors.New("添加审计备注失败")
		}
	}

	return tx.Commit()
}

func ReviewOrder(id int64, req *model.ReviewOrderRequest, user *model.User) error {
	now := time.Now().In(location)

	writeException := func(content string) {
		_, _ = db.DB.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, model.RemarkTypeException, content, now)
	}

	var order model.LiveSelectionOrder
	var isOverdue int
	err := db.DB.QueryRow(`
		SELECT id, status, current_handler, current_role, version, deadline, registration_evidence, is_overdue
		FROM live_selection_orders WHERE id = ?
	`, id).Scan(&order.ID, &order.Status, &order.CurrentHandler, &order.CurrentRole, &order.Version,
		&order.Deadline, &order.RegistrationEvidence, &isOverdue)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("选品单不存在")
		}
		return errors.New("查询选品单失败")
	}
	order.IsOverdue = isOverdue == 1

	if strings.TrimSpace(req.Opinion) == "" {
		writeException("复核归档失败：复核意见不能为空")
		return errors.New("复核意见不能为空")
	}

	allowedRoles := []string{model.RoleReviewer}
	allowedStatuses := []string{model.StatusAuditPassed}

	valid, err := validateOrderContext(&order, user, allowedRoles, allowedStatuses, req.Version, now, writeException)
	if !valid {
		return err
	}

	if !hasEvidence(order.RegistrationEvidence) {
		writeException("复核归档失败：正式登记证据不能为空")
		return errors.New("复核归档前必须有正式登记证据")
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeException("复核归档开启事务失败：" + err.Error())
		return errors.New("开启事务失败")
	}
	defer tx.Rollback()

	newVersion := order.Version + 1

	_, err = tx.Exec(`
		UPDATE live_selection_orders 
		SET status = ?, current_handler = ?, current_role = ?, version = ?, updated_at = ?
		WHERE id = ? AND version = ?
	`, model.StatusSynced, "", "", newVersion, now, id, req.Version)
	if err != nil {
		writeException("复核归档更新状态失败：" + err.Error())
		return errors.New("更新选品单状态失败")
	}

	_, err = tx.Exec(`
		INSERT INTO process_records 
		(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, "review", model.StatusAuditPassed, model.StatusSynced,
		req.Opinion, newVersion, now)
	if err != nil {
		writeException("复核归档添加处理记录失败：" + err.Error())
		return errors.New("添加处理记录失败")
	}

	_, err = tx.Exec(`
		INSERT INTO audit_remarks 
		(order_id, operator, operator_role, remark_type, content, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, model.RemarkTypeStatusChange,
		"状态变更：审核通过 -> 已同步（归档）", now)
	if err != nil {
		writeException("复核归档添加审计备注失败：" + err.Error())
		return errors.New("添加审计备注失败")
	}

	return tx.Commit()
}

func SupplementOrder(id int64, req *model.SupplementOrderRequest, user *model.User) error {
	now := time.Now().In(location)

	writeException := func(content string) {
		_, _ = db.DB.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, model.RemarkTypeException, content, now)
	}

	var order model.LiveSelectionOrder
	var isOverdue int
	err := db.DB.QueryRow(`
		SELECT id, status, current_handler, current_role, version, deadline, is_overdue
		FROM live_selection_orders WHERE id = ?
	`, id).Scan(&order.ID, &order.Status, &order.CurrentHandler, &order.CurrentRole, &order.Version,
		&order.Deadline, &isOverdue)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("选品单不存在")
		}
		return errors.New("查询选品单失败")
	}
	order.IsOverdue = isOverdue == 1

	allowedRoles := []string{model.RoleRegistrar}
	allowedStatuses := []string{model.StatusReturned}

	valid, err := validateOrderContext(&order, user, allowedRoles, allowedStatuses, req.Version, now, writeException)
	if !valid {
		return err
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeException("补正开启事务失败：" + err.Error())
		return errors.New("开启事务失败")
	}
	defer tx.Rollback()

	newVersion := order.Version + 1

	subEv := req.SubmissionEvidence
	if subEv == "" {
		subEv = "[]"
	}
	sampleEv := req.SampleEvidence
	if sampleEv == "" {
		sampleEv = "[]"
	}

	_, err = tx.Exec(`
		UPDATE live_selection_orders 
		SET status = ?, current_handler = ?, current_role = ?, version = ?, 
		    submission_evidence = ?, sample_evidence = ?, updated_at = ?, exception_reason = ?
		WHERE id = ? AND version = ?
	`, model.StatusPendingAudit, "auditor", model.RoleAuditor, newVersion,
		subEv, sampleEv, now, "", id, req.Version)
	if err != nil {
		writeException("补正更新状态失败：" + err.Error())
		return errors.New("更新选品单状态失败")
	}

	_, err = tx.Exec(`
		INSERT INTO process_records 
		(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, "supplement", model.StatusReturned, model.StatusPendingAudit,
		"补正后重新提交", newVersion, now)
	if err != nil {
		writeException("补正添加处理记录失败：" + err.Error())
		return errors.New("添加处理记录失败")
	}

	_, err = tx.Exec(`
		INSERT INTO audit_remarks 
		(order_id, operator, operator_role, remark_type, content, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, model.RemarkTypeSupplement,
		"补正材料，重新提交审核", now)
	if err != nil {
		writeException("补正添加审计备注失败：" + err.Error())
		return errors.New("添加审计备注失败")
	}

	return tx.Commit()
}

func BatchProcess(req *model.BatchProcessRequest, user *model.User) (*model.BatchProcessResponse, error) {
	results := []*model.BatchProcessResult{}
	now := time.Now().In(location)

	for _, orderID := range req.OrderIDs {
		result := &model.BatchProcessResult{
			OrderID: orderID,
			Success: false,
		}

		writeException := func(content string) {
			_, _ = db.DB.Exec(`
				INSERT INTO audit_remarks 
				(order_id, operator, operator_role, remark_type, content, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`, orderID, user.Username, user.Role, model.RemarkTypeException, content, now)
		}

		switch req.Action {
		case "audit_pass":
			if strings.TrimSpace(req.Opinion) == "" {
				writeException("批量审核通过失败：审核意见不能为空")
				result.Message = "批量审核通过必须填写审核意见"
				results = append(results, result)
				continue
			}
			version := getCurrentVersion(orderID)
			auditReq := &model.AuditOrderRequest{
				Version: version,
				Pass:    true,
				Opinion: req.Opinion,
			}
			err := AuditOrder(orderID, auditReq, user)
			if err != nil {
				result.Message = err.Error()
			} else {
				result.Success = true
				result.Message = "审核通过成功"
			}
		case "review":
			if strings.TrimSpace(req.Opinion) == "" {
				writeException("批量复核归档失败：复核意见不能为空")
				result.Message = "批量复核归档必须填写复核意见"
				results = append(results, result)
				continue
			}
			version := getCurrentVersion(orderID)
			reviewReq := &model.ReviewOrderRequest{
				Version: version,
				Opinion: req.Opinion,
			}
			err := ReviewOrder(orderID, reviewReq, user)
			if err != nil {
				result.Message = err.Error()
			} else {
				result.Success = true
				result.Message = "复核归档成功"
			}
		case "overdue_push":
			version := getCurrentVersion(orderID)
			err := pushOverdueOrder(orderID, req.Opinion, version, "", user)
			if err != nil {
				result.Message = err.Error()
			} else {
				result.Success = true
				result.Message = "逾期推进成功"
			}
		default:
			writeException("批量操作失败：不支持的操作类型 " + req.Action)
			result.Message = "不支持的批量操作类型"
		}

		results = append(results, result)
	}

	return &model.BatchProcessResponse{Results: results}, nil
}

func getCurrentVersion(orderID int64) int {
	var version int
	db.DB.QueryRow("SELECT version FROM live_selection_orders WHERE id = ?", orderID).Scan(&version)
	return version
}

func BatchOverduePushWithItems(req *model.BatchOverduePushRequest, user *model.User) (*model.BatchProcessResponse, error) {
	results := []*model.BatchProcessResult{}
	now := time.Now().In(location)

	for _, item := range req.Items {
		result := &model.BatchProcessResult{
			OrderID: item.OrderID,
			Success: false,
		}

		writeException := func(content string) {
			_, _ = db.DB.Exec(`
				INSERT INTO audit_remarks 
				(order_id, operator, operator_role, remark_type, content, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`, item.OrderID, user.Username, user.Role, model.RemarkTypeException, content, now)
		}

		reason := strings.TrimSpace(req.Reason)
		if reason == "" {
			writeException("逾期推进失败：处理意见不能为空")
			result.Message = "逾期推进必须填写处理意见"
			results = append(results, result)
			continue
		}

		version := item.Version
		if version <= 0 {
			version = getCurrentVersion(item.OrderID)
		}

		err := pushOverdueOrder(item.OrderID, reason, version, item.AuditRemark, user)
		if err != nil {
			result.Message = err.Error()
		} else {
			result.Success = true
			result.Message = "逾期推进成功"
		}

		results = append(results, result)
	}

	return &model.BatchProcessResponse{Results: results}, nil
}

func pushOverdueOrder(orderID int64, reason string, reqVersion int, auditRemark string, user *model.User) error {
	now := time.Now().In(location)

	writeException := func(content string) {
		_, _ = db.DB.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, orderID, user.Username, user.Role, model.RemarkTypeException, content, now)
	}

	var order model.LiveSelectionOrder
	var isOverdue int
	err := db.DB.QueryRow(`
		SELECT id, status, current_handler, current_role, version, deadline, sample_evidence, is_overdue
		FROM live_selection_orders WHERE id = ?
	`, orderID).Scan(&order.ID, &order.Status, &order.CurrentHandler, &order.CurrentRole, &order.Version,
		&order.Deadline, &order.SampleEvidence, &isOverdue)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("选品单不存在")
		}
		return errors.New("查询选品单失败")
	}
	order.IsOverdue = isOverdue == 1

	allowedRoles := []string{model.RoleAuditor}
	allowedStatuses := []string{model.StatusPendingAudit}

	valid, err := validateOrderContext(&order, user, allowedRoles, allowedStatuses, reqVersion, now, writeException)
	if !valid {
		return err
	}

	if !order.IsOverdue {
		writeException("逾期推进失败：该选品单未标记为逾期，无法推进")
		return errors.New("只有已逾期的选品单可以执行逾期推进")
	}

	opinion := strings.TrimSpace(reason)
	if opinion == "" {
		writeException("处理意见校验失败：逾期推进必须填写处理意见")
		return errors.New("逾期推进必须填写处理意见")
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeException("逾期推进开启事务失败：" + err.Error())
		return errors.New("开启事务失败")
	}
	defer tx.Rollback()

	newVersion := order.Version + 1
	actualVersion := order.Version
	if reqVersion > 0 {
		actualVersion = reqVersion
	}

	_, err = tx.Exec(`
		UPDATE live_selection_orders 
		SET status = ?, current_handler = ?, current_role = ?, version = ?, updated_at = ?
		WHERE id = ? AND version = ?
	`, model.StatusAuditPassed, "reviewer", model.RoleReviewer, newVersion, now, orderID, actualVersion)
	if err != nil {
		writeException("逾期推进更新状态失败：" + err.Error())
		return errors.New("更新选品单状态失败")
	}

	_, err = tx.Exec(`
		INSERT INTO process_records 
		(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, orderID, user.Username, user.Role, "audit_pass", model.StatusPendingAudit, model.StatusAuditPassed,
		opinion, newVersion, now)
	if err != nil {
		writeException("逾期推进添加处理记录失败：" + err.Error())
		return errors.New("添加处理记录失败")
	}

	_, err = tx.Exec(`
		INSERT INTO audit_remarks 
		(order_id, operator, operator_role, remark_type, content, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, orderID, user.Username, user.Role, model.RemarkTypeStatusChange,
		"状态变更：待审核 -> 审核通过（逾期推进）", now)
	if err != nil {
		writeException("逾期推进添加状态变更备注失败：" + err.Error())
		return errors.New("添加审计备注失败")
	}

	_, err = tx.Exec(`
		INSERT INTO audit_remarks 
		(order_id, operator, operator_role, remark_type, content, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, orderID, user.Username, user.Role, model.RemarkTypeException,
		"逾期推进："+opinion, now)
	if err != nil {
		writeException("逾期推进添加逾期备注失败：" + err.Error())
		return errors.New("添加逾期备注失败")
	}

	if strings.TrimSpace(auditRemark) != "" {
		_, err = tx.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, orderID, user.Username, user.Role, model.RemarkTypeSupplement, auditRemark, now)
		if err != nil {
			writeException("逾期推进添加审计备注失败：" + err.Error())
			return errors.New("添加审计备注失败")
		}
	}

	return tx.Commit()
}

func GetOverdueQueue() (*model.OverdueQueueResponse, error) {
	now := time.Now().In(location)
	warningDays := 3

	rows, err := db.DB.Query(`
		SELECT id, order_no, product_name, product_category, price, stock, status,
		       current_handler, current_role, version, deadline,
		       submission_evidence, sample_evidence, registration_evidence,
		       created_at, updated_at, created_by, exception_reason, is_overdue, overdue_reason
		FROM live_selection_orders
		WHERE status NOT IN ('synced')
		ORDER BY current_handler, deadline ASC
	`)
	if err != nil {
		return nil, errors.New("查询逾期队列失败")
	}
	defer rows.Close()

	groupMap := make(map[string]*model.OverdueQueueItem)

	for rows.Next() {
		var o model.LiveSelectionOrder
		var isOverdue int
		err := rows.Scan(
			&o.ID, &o.OrderNo, &o.ProductName, &o.ProductCategory, &o.Price, &o.Stock,
			&o.Status, &o.CurrentHandler, &o.CurrentRole, &o.Version, &o.Deadline,
			&o.SubmissionEvidence, &o.SampleEvidence, &o.RegistrationEvidence,
			&o.CreatedAt, &o.UpdatedAt, &o.CreatedBy, &o.ExceptionReason, &isOverdue, &o.OverdueReason,
		)
		if err != nil {
			continue
		}
		o.IsOverdue = isOverdue == 1
		o.CreatedAt = o.CreatedAt.In(location)
		o.UpdatedAt = o.UpdatedAt.In(location)
		o.Deadline = o.Deadline.In(location)

		handler := o.CurrentHandler
		if handler == "" {
			handler = "未分配"
		}

		group, ok := groupMap[handler]
		if !ok {
			group = &model.OverdueQueueItem{
				Handler: handler,
				Role:    o.CurrentRole,
				Orders:  []*model.LiveSelectionOrder{},
			}
			groupMap[handler] = group
		}

		daysLeft := int(o.Deadline.Sub(now).Hours() / 24)

		if o.IsOverdue || now.After(o.Deadline) {
			group.OverdueCount++
		} else if daysLeft <= warningDays {
			group.WarningCount++
		} else {
			group.NormalCount++
		}

		group.Orders = append(group.Orders, &o)
	}

	groups := []*model.OverdueQueueItem{}
	for _, g := range groupMap {
		groups = append(groups, g)
	}

	return &model.OverdueQueueResponse{Groups: groups}, nil
}

func GetAuditTrail(id int64) ([]*model.AuditRemark, error) {
	return getAuditRemarksByOrderID(id)
}

func UploadAttachment(orderID int64, req *model.UploadAttachmentRequest, user *model.User) (*model.SelectionAttachment, error) {
	now := time.Now().In(location)

	writeException := func(content string) {
		_, _ = db.DB.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, orderID, user.Username, user.Role, model.RemarkTypeException, content, now)
	}

	var order model.LiveSelectionOrder
	var isOverdue int
	err := db.DB.QueryRow(`
		SELECT id, status, current_handler, version, deadline, is_overdue 
		FROM live_selection_orders WHERE id = ?
	`, orderID).Scan(&order.ID, &order.Status, &order.CurrentHandler, &order.Version, &order.Deadline, &isOverdue)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("选品单不存在")
		}
		return nil, errors.New("查询选品单失败")
	}
	order.IsOverdue = isOverdue == 1

	moduleRoleMap := map[string][]string{
		model.ModuleTypeSubmission:   {model.RoleRegistrar},
		model.ModuleTypeSample:       {model.RoleAuditor},
		model.ModuleTypeRegistration: {model.RoleReviewer},
	}
	moduleNameMap := map[string]string{
		model.ModuleTypeSubmission:   "选品提报",
		model.ModuleTypeSample:       "样品确认",
		model.ModuleTypeRegistration: "直播选品单登记",
	}
	moduleStatusMap := map[string][]string{
		model.ModuleTypeSubmission:   {model.StatusDraft, model.StatusReturned},
		model.ModuleTypeSample:       {model.StatusPendingAudit},
		model.ModuleTypeRegistration: {model.StatusAuditPassed},
	}

	allowedRoles, ok := moduleRoleMap[req.ModuleType]
	if !ok {
		writeException("无效的附件模块类型：" + req.ModuleType)
		return nil, errors.New("无效的附件模块类型")
	}

	allowedStatuses := moduleStatusMap[req.ModuleType]
	valid, err := validateOrderContext(&order, user, allowedRoles, allowedStatuses, 0, now, writeException)
	if !valid {
		moduleName := moduleNameMap[req.ModuleType]
		if err != nil && strings.Contains(err.Error(), "角色不匹配") {
			roleName := map[string]string{
				model.RoleRegistrar: "直播选品登记员",
				model.RoleAuditor:   "直播选品审核主管",
				model.RoleReviewer:  "直播电商团队复核负责人",
			}[allowedRoles[0]]
			return nil, fmt.Errorf("只有%s可以上传%s附件", roleName, moduleName)
		}
		if err != nil && strings.Contains(err.Error(), "当前状态不允许该操作") {
			return nil, fmt.Errorf("%s附件只能在对应状态下上传", moduleName)
		}
		return nil, err
	}

	result, err := db.DB.Exec(`
		INSERT INTO selection_attachments 
		(order_id, file_name, file_type, file_url, uploaded_by, uploaded_at, module_type)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, orderID, req.FileName, req.FileType, req.FileURL, user.Username, now, req.ModuleType)
	if err != nil {
		writeException("上传附件失败：" + err.Error())
		return nil, errors.New("上传附件失败")
	}

	attachmentID, _ := result.LastInsertId()

	addAuditRemark(orderID, user.Username, user.Role, model.RemarkTypeSupplement,
		fmt.Sprintf("上传附件：%s", req.FileName), now)

	return &model.SelectionAttachment{
		ID:         attachmentID,
		OrderID:    orderID,
		FileName:   req.FileName,
		FileType:   req.FileType,
		FileURL:    req.FileURL,
		UploadedBy: user.Username,
		UploadedAt: now,
		ModuleType: req.ModuleType,
	}, nil
}

func ProcessModule(id int64, req *model.ProcessModuleRequest, user *model.User) error {
	var order model.LiveSelectionOrder
	var isOverdue int
	err := db.DB.QueryRow(`
		SELECT id, status, current_handler, current_role, version, deadline,
		       submission_evidence, sample_evidence, registration_evidence, is_overdue
		FROM live_selection_orders WHERE id = ?
	`, id).Scan(&order.ID, &order.Status, &order.CurrentHandler, &order.CurrentRole, &order.Version, &order.Deadline,
		&order.SubmissionEvidence, &order.SampleEvidence, &order.RegistrationEvidence, &isOverdue)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("选品单不存在")
		}
		return errors.New("查询选品单失败")
	}
	order.IsOverdue = isOverdue == 1

	now := time.Now().In(location)

	writeException := func(content string) {
		_, _ = db.DB.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, model.RemarkTypeException, content, now)
	}

	moduleNameMap := map[string]string{
		model.ModuleTypeSubmission:   "选品提报",
		model.ModuleTypeSample:       "样品确认",
		model.ModuleTypeRegistration: "直播选品单登记",
	}

	moduleRoleMap := map[string][]string{
		model.ModuleTypeSubmission:   {model.RoleRegistrar},
		model.ModuleTypeSample:       {model.RoleAuditor},
		model.ModuleTypeRegistration: {model.RoleReviewer},
	}
	allowedRoles, ok := moduleRoleMap[req.ModuleType]
	if !ok {
		writeException("无效的模块类型：" + req.ModuleType)
		return errors.New("无效的模块类型")
	}

	validStatuses := map[string][]string{
		model.ModuleTypeSubmission:   {model.StatusDraft, model.StatusReturned},
		model.ModuleTypeSample:       {model.StatusPendingAudit},
		model.ModuleTypeRegistration: {model.StatusAuditPassed},
	}
	allowedStatuses := validStatuses[req.ModuleType]

	valid, err := validateOrderContext(&order, user, allowedRoles, allowedStatuses, req.Version, now, writeException)
	if !valid {
		return err
	}

	moduleName := moduleNameMap[req.ModuleType]
	if req.SubmitNext {
		if strings.TrimSpace(req.Opinion) == "" {
			writeException(fmt.Sprintf("处理意见校验失败：%s模块进入下一步前必须填写处理意见", moduleName))
			return fmt.Errorf("%s模块进入下一步前必须填写处理意见", moduleName)
		}
		if !hasEvidence(req.Evidence) {
			writeException(fmt.Sprintf("必填证据校验失败：进入下一步前%s模块证据不能为空", moduleName))
			return fmt.Errorf("进入下一步前必须上传%s证据", moduleName)
		}
	}

	if strings.TrimSpace(req.AuditRemark) != "" {
		if len(strings.TrimSpace(req.AuditRemark)) == 0 {
			writeException("审计备注内容为空")
			return errors.New("审计备注内容不能为空")
		}
	}

	newSubmissionEv := order.SubmissionEvidence
	newSampleEv := order.SampleEvidence
	newRegistrationEv := order.RegistrationEvidence

	switch req.ModuleType {
	case model.ModuleTypeSubmission:
		if req.Evidence != "" {
			newSubmissionEv = req.Evidence
		}
	case model.ModuleTypeSample:
		if req.Evidence != "" {
			newSampleEv = req.Evidence
		}
	case model.ModuleTypeRegistration:
		if req.Evidence != "" {
			newRegistrationEv = req.Evidence
		}
	}

	version := order.Version
	newStatus := order.Status
	newHandler := order.CurrentHandler
	newRole := order.CurrentRole
	statusChanged := false

	action := fmt.Sprintf("process_%s", req.ModuleType)
	opinion := req.Opinion
	if opinion == "" {
		opinion = fmt.Sprintf("办理%s模块", moduleNameMap[req.ModuleType])
	}

	if req.SubmitNext {
		version = order.Version + 1
		statusChanged = true
		switch req.ModuleType {
		case model.ModuleTypeSubmission:
			newStatus = model.StatusPendingAudit
			newHandler = "auditor"
			newRole = model.RoleAuditor
		case model.ModuleTypeSample:
			newStatus = model.StatusAuditPassed
			newHandler = "reviewer"
			newRole = model.RoleReviewer
		case model.ModuleTypeRegistration:
			newStatus = model.StatusSynced
			newHandler = ""
			newRole = ""
		}
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeException("开启事务失败：" + err.Error())
		return errors.New("开启事务失败")
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE live_selection_orders 
		SET submission_evidence = ?, sample_evidence = ?, registration_evidence = ?,
		    status = ?, current_handler = ?, current_role = ?, version = ?, updated_at = ?
		WHERE id = ? AND version = ?
	`, newSubmissionEv, newSampleEv, newRegistrationEv,
		newStatus, newHandler, newRole, version, now, id, req.Version)
	if err != nil {
		writeException("更新选品单证据和状态失败：" + err.Error())
		return errors.New("更新选品单失败")
	}

	_, err = tx.Exec(`
		INSERT INTO process_records 
		(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, action, order.Status, newStatus, opinion, version, now)
	if err != nil {
		writeException("添加处理记录失败：" + err.Error())
		return errors.New("添加处理记录失败")
	}

	if strings.TrimSpace(req.AuditRemark) != "" {
		_, err = tx.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, model.RemarkTypeSupplement, req.AuditRemark, now)
		if err != nil {
			writeException("添加审计备注失败：" + err.Error())
			return errors.New("添加审计备注失败")
		}
	}

	if statusChanged {
		statusText := map[string]string{
			model.StatusDraft:        "草稿",
			model.StatusReturned:     "已退回",
			model.StatusPendingAudit: "待审核",
			model.StatusAuditPassed:  "审核通过",
			model.StatusSynced:       "已同步",
		}
		_, err = tx.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, model.RemarkTypeStatusChange,
			fmt.Sprintf("状态变更：%s -> %s", statusText[order.Status], statusText[newStatus]), now)
		if err != nil {
			writeException("添加状态变更备注失败：" + err.Error())
			return errors.New("添加状态变更备注失败")
		}

		statusAction := map[string]string{
			model.ModuleTypeSubmission:   "submit",
			model.ModuleTypeSample:       "audit_pass",
			model.ModuleTypeRegistration: "review",
		}[req.ModuleType]

		_, err = tx.Exec(`
			INSERT INTO process_records 
			(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, statusAction, order.Status, newStatus, opinion, version, now)
		if err != nil {
			writeException("添加状态变更记录失败：" + err.Error())
			return errors.New("添加状态变更记录失败")
		}
	}

	return tx.Commit()
}

func hasEvidence(evidenceJSON string) bool {
	if evidenceJSON == "" {
		return false
	}
	trimmed := strings.TrimSpace(evidenceJSON)
	if trimmed == "" || trimmed == "[]" || trimmed == "null" || trimmed == "{}" {
		return false
	}
	var arr []interface{}
	if err := json.Unmarshal([]byte(trimmed), &arr); err == nil {
		return len(arr) > 0
	}
	var obj map[string]interface{}
	if err := json.Unmarshal([]byte(trimmed), &obj); err == nil {
		return len(obj) > 0
	}
	return true
}

func addAuditRemark(orderID int64, operator, operatorRole, remarkType, content string, now time.Time) {
	db.DB.Exec(`
		INSERT INTO audit_remarks 
		(order_id, operator, operator_role, remark_type, content, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, orderID, operator, operatorRole, remarkType, content, now)
}
