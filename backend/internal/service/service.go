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

func GetOrderDetail(id int64) (*model.OrderDetailResponse, error) {
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

	return &model.OrderDetailResponse{
		Order:          &o,
		Attachments:    attachments,
		ProcessRecords: processRecords,
		AuditRemarks:   auditRemarks,
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
	if user.Role != model.RoleRegistrar {
		return errors.New("只有直播选品登记员可以提交审核")
	}

	tx, err := db.DB.Begin()
	if err != nil {
		return errors.New("开启事务失败")
	}
	defer tx.Rollback()

	var order model.LiveSelectionOrder
	var isOverdue int
	err = tx.QueryRow(`
		SELECT id, status, current_handler, version, submission_evidence, sample_evidence, is_overdue
		FROM live_selection_orders WHERE id = ?
	`, id).Scan(&order.ID, &order.Status, &order.CurrentHandler, &order.Version,
		&order.SubmissionEvidence, &order.SampleEvidence, &isOverdue)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("选品单不存在")
		}
		return errors.New("查询选品单失败")
	}
	order.IsOverdue = isOverdue == 1

	if order.Status != model.StatusDraft && order.Status != model.StatusReturned {
		return errors.New("只有草稿或退回状态的选品单才能提交审核")
	}

	if order.CurrentHandler != user.Username {
		return errors.New("您不是当前处理人，无法提交")
	}

	if order.Version != req.Version {
		return errors.New("版本冲突，请刷新后重试")
	}

	if !hasEvidence(order.SubmissionEvidence) {
		return errors.New("提交审核前必须上传选品提报证据")
	}

	now := time.Now().In(location)
	newVersion := order.Version + 1

	_, err = tx.Exec(`
		UPDATE live_selection_orders 
		SET status = ?, current_handler = ?, current_role = ?, version = ?, 
		    updated_at = ?, exception_reason = ?
		WHERE id = ? AND version = ?
	`, model.StatusPendingAudit, "auditor", model.RoleAuditor, newVersion, now, "", id, req.Version)
	if err != nil {
		return errors.New("更新选品单状态失败")
	}

	_, err = tx.Exec(`
		INSERT INTO process_records 
		(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, "submit", order.Status, model.StatusPendingAudit, "提交审核", newVersion, now)
	if err != nil {
		return errors.New("添加处理记录失败")
	}

	_, err = tx.Exec(`
		INSERT INTO audit_remarks 
		(order_id, operator, operator_role, remark_type, content, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, model.RemarkTypeStatusChange,
		fmt.Sprintf("状态变更：%s -> 待审核", order.Status), now)
	if err != nil {
		return errors.New("添加审计备注失败")
	}

	return tx.Commit()
}

func AuditOrder(id int64, req *model.AuditOrderRequest, user *model.User) error {
	if user.Role != model.RoleAuditor {
		return errors.New("只有直播选品审核主管可以审核")
	}

	if req.Opinion == "" {
		return errors.New("审核意见不能为空")
	}

	tx, err := db.DB.Begin()
	if err != nil {
		return errors.New("开启事务失败")
	}
	defer tx.Rollback()

	var order model.LiveSelectionOrder
	var isOverdue int
	err = tx.QueryRow(`
		SELECT id, status, current_handler, version, sample_evidence, is_overdue
		FROM live_selection_orders WHERE id = ?
	`, id).Scan(&order.ID, &order.Status, &order.CurrentHandler, &order.Version,
		&order.SampleEvidence, &isOverdue)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("选品单不存在")
		}
		return errors.New("查询选品单失败")
	}
	order.IsOverdue = isOverdue == 1

	if order.Status != model.StatusPendingAudit {
		return errors.New("只有待审核状态的选品单才能审核")
	}

	if order.CurrentHandler != user.Username && order.CurrentHandler != "" {
		if order.CurrentHandler != user.Username {
			return errors.New("您不是当前审核人，无法审核")
		}
	}

	if order.Version != req.Version {
		return errors.New("版本冲突，请刷新后重试")
	}

	now := time.Now().In(location)
	newVersion := order.Version + 1

	if req.Pass {
		if !hasEvidence(order.SampleEvidence) {
			return errors.New("审核通过前必须确认样品证据")
		}

		_, err = tx.Exec(`
			UPDATE live_selection_orders 
			SET status = ?, current_handler = ?, current_role = ?, version = ?, updated_at = ?
			WHERE id = ? AND version = ?
		`, model.StatusAuditPassed, "reviewer", model.RoleReviewer, newVersion, now, id, req.Version)
		if err != nil {
			return errors.New("更新选品单状态失败")
		}

		_, err = tx.Exec(`
			INSERT INTO process_records 
			(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, "audit_pass", model.StatusPendingAudit, model.StatusAuditPassed,
			req.Opinion, newVersion, now)
		if err != nil {
			return errors.New("添加处理记录失败")
		}

		_, err = tx.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, model.RemarkTypeStatusChange,
			"状态变更：待审核 -> 审核通过", now)
		if err != nil {
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
			return errors.New("更新选品单状态失败")
		}

		_, err = tx.Exec(`
			INSERT INTO process_records 
			(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, "return", model.StatusPendingAudit, model.StatusReturned,
			req.Opinion, newVersion, now)
		if err != nil {
			return errors.New("添加处理记录失败")
		}

		_, err = tx.Exec(`
			INSERT INTO audit_remarks 
			(order_id, operator, operator_role, remark_type, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, id, user.Username, user.Role, model.RemarkTypeException,
			"审核退回："+req.Opinion, now)
		if err != nil {
			return errors.New("添加审计备注失败")
		}
	}

	return tx.Commit()
}

func ReviewOrder(id int64, req *model.ReviewOrderRequest, user *model.User) error {
	if user.Role != model.RoleReviewer {
		return errors.New("只有直播电商团队复核负责人可以复核归档")
	}

	if req.Opinion == "" {
		return errors.New("复核意见不能为空")
	}

	tx, err := db.DB.Begin()
	if err != nil {
		return errors.New("开启事务失败")
	}
	defer tx.Rollback()

	var order model.LiveSelectionOrder
	var isOverdue int
	err = tx.QueryRow(`
		SELECT id, status, current_handler, version, registration_evidence, is_overdue
		FROM live_selection_orders WHERE id = ?
	`, id).Scan(&order.ID, &order.Status, &order.CurrentHandler, &order.Version,
		&order.RegistrationEvidence, &isOverdue)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("选品单不存在")
		}
		return errors.New("查询选品单失败")
	}
	order.IsOverdue = isOverdue == 1

	if order.Status != model.StatusAuditPassed {
		return errors.New("只有审核通过状态的选品单才能复核归档")
	}

	if order.Version != req.Version {
		return errors.New("版本冲突，请刷新后重试")
	}

	if !hasEvidence(order.RegistrationEvidence) {
		return errors.New("复核归档前必须有正式登记证据")
	}

	now := time.Now().In(location)
	newVersion := order.Version + 1

	_, err = tx.Exec(`
		UPDATE live_selection_orders 
		SET status = ?, current_handler = ?, current_role = ?, version = ?, updated_at = ?
		WHERE id = ? AND version = ?
	`, model.StatusSynced, "", "", newVersion, now, id, req.Version)
	if err != nil {
		return errors.New("更新选品单状态失败")
	}

	_, err = tx.Exec(`
		INSERT INTO process_records 
		(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, "review", model.StatusAuditPassed, model.StatusSynced,
		req.Opinion, newVersion, now)
	if err != nil {
		return errors.New("添加处理记录失败")
	}

	_, err = tx.Exec(`
		INSERT INTO audit_remarks 
		(order_id, operator, operator_role, remark_type, content, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, model.RemarkTypeStatusChange,
		"状态变更：审核通过 -> 已同步（归档）", now)
	if err != nil {
		return errors.New("添加审计备注失败")
	}

	return tx.Commit()
}

func SupplementOrder(id int64, req *model.SupplementOrderRequest, user *model.User) error {
	if user.Role != model.RoleRegistrar {
		return errors.New("只有直播选品登记员可以补正")
	}

	tx, err := db.DB.Begin()
	if err != nil {
		return errors.New("开启事务失败")
	}
	defer tx.Rollback()

	var order model.LiveSelectionOrder
	var isOverdue int
	err = tx.QueryRow(`
		SELECT id, status, current_handler, version, is_overdue
		FROM live_selection_orders WHERE id = ?
	`, id).Scan(&order.ID, &order.Status, &order.CurrentHandler, &order.Version, &isOverdue)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("选品单不存在")
		}
		return errors.New("查询选品单失败")
	}
	order.IsOverdue = isOverdue == 1

	if order.Status != model.StatusReturned {
		return errors.New("只有退回状态的选品单才能补正")
	}

	if order.CurrentHandler != user.Username {
		return errors.New("您不是当前处理人，无法补正")
	}

	if order.Version != req.Version {
		return errors.New("版本冲突，请刷新后重试")
	}

	now := time.Now().In(location)
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
		return errors.New("更新选品单状态失败")
	}

	_, err = tx.Exec(`
		INSERT INTO process_records 
		(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, "supplement", model.StatusReturned, model.StatusPendingAudit,
		"补正后重新提交", newVersion, now)
	if err != nil {
		return errors.New("添加处理记录失败")
	}

	_, err = tx.Exec(`
		INSERT INTO audit_remarks 
		(order_id, operator, operator_role, remark_type, content, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, user.Username, user.Role, model.RemarkTypeSupplement,
		"补正材料，重新提交审核", now)
	if err != nil {
		return errors.New("添加审计备注失败")
	}

	return tx.Commit()
}

func BatchProcess(req *model.BatchProcessRequest, user *model.User) (*model.BatchProcessResponse, error) {
	results := []*model.BatchProcessResult{}

	for _, orderID := range req.OrderIDs {
		result := &model.BatchProcessResult{
			OrderID: orderID,
			Success: false,
		}

		switch req.Action {
		case "audit_pass":
			auditReq := &model.AuditOrderRequest{
				Version: getCurrentVersion(orderID),
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
			reviewReq := &model.ReviewOrderRequest{
				Version: getCurrentVersion(orderID),
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
			err := pushOverdueOrder(orderID, req.Opinion, user)
			if err != nil {
				result.Message = err.Error()
			} else {
				result.Success = true
				result.Message = "逾期推进成功"
			}
		default:
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

func pushOverdueOrder(orderID int64, reason string, user *model.User) error {
	now := time.Now().In(location)

	result, err := db.DB.Exec(`
		UPDATE live_selection_orders 
		SET is_overdue = 1, overdue_reason = ?, updated_at = ?
		WHERE id = ?
	`, reason, now, orderID)
	if err != nil {
		return errors.New("标记逾期失败")
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("选品单不存在")
	}

	addAuditRemark(orderID, user.Username, user.Role, model.RemarkTypeException,
		"逾期推进："+reason, now)

	return nil
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

	result, err := db.DB.Exec(`
		INSERT INTO selection_attachments 
		(order_id, file_name, file_type, file_url, uploaded_by, uploaded_at, module_type)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, orderID, req.FileName, req.FileType, req.FileURL, user.Username, now, req.ModuleType)
	if err != nil {
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

func hasEvidence(evidenceJSON string) bool {
	if evidenceJSON == "" || evidenceJSON == "[]" || evidenceJSON == "null" {
		return false
	}
	trimmed := strings.TrimSpace(evidenceJSON)
	if trimmed == "" || trimmed == "[]" || trimmed == "null" {
		return false
	}
	var evidence []interface{}
	if err := json.Unmarshal([]byte(trimmed), &evidence); err == nil {
		return len(evidence) > 0
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
