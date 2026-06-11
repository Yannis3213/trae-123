package main

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(APIResponse{Code: -1, Message: "请求参数错误"})
	}

	var user User
	err := DB.QueryRow(
		"SELECT id, username, password, name, role FROM users WHERE username = ?",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.Password, &user.Name, &user.Role)

	if err != nil || user.Password != req.Password {
		return c.Status(401).JSON(APIResponse{Code: -1, Message: "用户名或密码错误"})
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"role":     user.Role,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	})

	tokenStr, err := token.SignedString(jwtSecret)
	if err != nil {
		return c.Status(500).JSON(APIResponse{Code: -1, Message: "生成令牌失败"})
	}

	return c.JSON(APIResponse{
		Code:    0,
		Message: "success",
		Data: LoginResponse{
			Token: tokenStr,
			User:  user,
		},
	})
}

func GetCurrentUser(c *fiber.Ctx) error {
	userID := c.Locals("userId").(int)

	var user User
	err := DB.QueryRow(
		"SELECT id, username, name, role FROM users WHERE id = ?",
		userID,
	).Scan(&user.ID, &user.Username, &user.Name, &user.Role)

	if err != nil {
		return c.Status(404).JSON(APIResponse{Code: -1, Message: "用户不存在"})
	}

	return c.JSON(APIResponse{
		Code:    0,
		Message: "success",
		Data:    user,
	})
}

func GetOrders(c *fiber.Ctx) error {
	status := c.Query("status")
	expiryGroup := c.Query("expiry_group")
	role := c.Query("role")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "10"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}

	where := "WHERE 1=1"
	args := []interface{}{}

	if status != "" {
		where += " AND status = ?"
		args = append(args, status)
	}

	if role == "客服专员" {
		userID := c.Locals("userId").(int)
		where += " AND customer_id = ?"
		args = append(args, userID)
	} else if role == "师傅调度" {
		userID := c.Locals("userId").(int)
		where += " AND (technician_id = ? OR status = '待接单')"
		args = append(args, userID)
	} else if role == "服务经理" {
		userID := c.Locals("userId").(int)
		where += " AND (manager_id = ? OR status IN ('待验收', '验收通过'))"
		args = append(args, userID)
	}

	if expiryGroup != "" {
		now := time.Now().Format("2006-01-02 15:04:05")
		approaching := time.Now().Add(3 * 24 * time.Hour).Format("2006-01-02 15:04:05")
		if expiryGroup == "approaching" {
			where += " AND deadline > ? AND deadline <= ? AND status NOT IN ('验收通过', '已归档')"
			args = append(args, now, approaching)
		} else if expiryGroup == "overdue" {
			where += " AND deadline < ? AND deadline != '' AND status NOT IN ('验收通过', '已归档')"
			args = append(args, now)
		} else if expiryGroup == "normal" {
			where += " AND (deadline = '' OR deadline > ? OR status IN ('验收通过', '已归档'))"
			args = append(args, approaching)
		}
	}

	var total int
	countSQL := "SELECT COUNT(*) FROM repair_orders " + where
	DB.QueryRow(countSQL, args...).Scan(&total)

	offset := (page - 1) * pageSize
	querySQL := "SELECT id, order_no, title, description, status, priority, customer_id, technician_id, manager_id, deadline, version, exception_type, created_at, updated_at FROM repair_orders " + where + " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	queryArgs := append(args, pageSize, offset)

	rows, err := DB.Query(querySQL, queryArgs...)
	if err != nil {
		return c.Status(500).JSON(APIResponse{Code: -1, Message: "查询失败"})
	}
	defer rows.Close()

	orders := []RepairOrder{}
	for rows.Next() {
		var o RepairOrder
		if err := rows.Scan(&o.ID, &o.OrderNo, &o.Title, &o.Description, &o.Status, &o.Priority, &o.CustomerID, &o.TechnicianID, &o.ManagerID, &o.Deadline, &o.Version, &o.ExceptionType, &o.CreatedAt, &o.UpdatedAt); err != nil {
			continue
		}
		orders = append(orders, o)
	}

	statusCounts := map[string]int{}
	statusList := []string{"待接单", "已接单", "施工中", "待验收", "验收通过", "退回补正", "已归档"}
	for _, s := range statusList {
		var cnt int
		DB.QueryRow("SELECT COUNT(*) FROM repair_orders WHERE status = ?", s).Scan(&cnt)
		statusCounts[s] = cnt
	}

	return c.JSON(APIResponse{
		Code:    0,
		Message: "success",
		Data: PaginatedResponse{
			List:         orders,
			Total:        total,
			Page:         page,
			PageSize:     pageSize,
			StatusCounts: statusCounts,
		},
	})
}

func GetOrder(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))

	var o RepairOrder
	err := DB.QueryRow(
		"SELECT id, order_no, title, description, status, priority, customer_id, technician_id, manager_id, deadline, version, exception_type, created_at, updated_at FROM repair_orders WHERE id = ?",
		id,
	).Scan(&o.ID, &o.OrderNo, &o.Title, &o.Description, &o.Status, &o.Priority, &o.CustomerID, &o.TechnicianID, &o.ManagerID, &o.Deadline, &o.Version, &o.ExceptionType, &o.CreatedAt, &o.UpdatedAt)

	if err != nil {
		return c.Status(404).JSON(APIResponse{Code: -1, Message: "工单不存在"})
	}

	attachments := []Attachment{}
	rows, _ := DB.Query("SELECT id, order_id, file_name, category, uploaded_by, upload_role, created_at FROM attachments WHERE order_id = ?", id)
	defer rows.Close()
	for rows.Next() {
		var a Attachment
		rows.Scan(&a.ID, &a.OrderID, &a.FileName, &a.Category, &a.UploadedBy, &a.UploadRole, &a.CreatedAt)
		attachments = append(attachments, a)
	}

	processRecords := []ProcessRecord{}
	rows2, _ := DB.Query("SELECT id, order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at FROM process_records WHERE order_id = ? ORDER BY created_at", id)
	defer rows2.Close()
	for rows2.Next() {
		var p ProcessRecord
		rows2.Scan(&p.ID, &p.OrderID, &p.Action, &p.FromStatus, &p.ToStatus, &p.OperatorID, &p.OperatorRole, &p.Remark, &p.CreatedAt)
		processRecords = append(processRecords, p)
	}

	auditNotes := []AuditNote{}
	rows3, _ := DB.Query("SELECT id, order_id, note, author_id, author_role, created_at FROM audit_notes WHERE order_id = ? ORDER BY created_at", id)
	defer rows3.Close()
	for rows3.Next() {
		var n AuditNote
		rows3.Scan(&n.ID, &n.OrderID, &n.Note, &n.AuthorID, &n.AuthorRole, &n.CreatedAt)
		auditNotes = append(auditNotes, n)
	}

	exceptionReasons := []ExceptionReason{}
	rows4, _ := DB.Query("SELECT id, order_id, reason_type, description, created_by, created_at FROM exception_reasons WHERE order_id = ? ORDER BY created_at", id)
	defer rows4.Close()
	for rows4.Next() {
		var e ExceptionReason
		rows4.Scan(&e.ID, &e.OrderID, &e.ReasonType, &e.Description, &e.CreatedBy, &e.CreatedAt)
		exceptionReasons = append(exceptionReasons, e)
	}

	expiryStatus := "normal"
	if o.Deadline != "" {
		deadline, err := time.Parse("2006-01-02 15:04:05", o.Deadline)
		if err == nil && o.Status != "验收通过" && o.Status != "已归档" {
			now := time.Now()
			if deadline.Before(now) {
				expiryStatus = "overdue"
			} else if deadline.Before(now.Add(3 * 24 * time.Hour)) {
				expiryStatus = "approaching"
			}
		}
	}

	return c.JSON(APIResponse{
		Code:    0,
		Message: "success",
		Data: OrderDetailResponse{
			Order:            o,
			Attachments:      attachments,
			ProcessRecords:   processRecords,
			AuditNotes:       auditNotes,
			ExceptionReasons: exceptionReasons,
			ExpiryStatus:     expiryStatus,
		},
	})
}

func CreateOrder(c *fiber.Ctx) error {
	role := c.Locals("role").(string)
	if role != "客服专员" {
		return c.Status(403).JSON(APIResponse{Code: -1, Message: "仅客服专员可创建工单"})
	}

	var req CreateOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(APIResponse{Code: -1, Message: "请求参数错误"})
	}

	if req.Title == "" {
		return c.Status(400).JSON(APIResponse{Code: -1, Message: "标题不能为空"})
	}
	if req.Deadline == "" {
		return c.Status(400).JSON(APIResponse{Code: -1, Message: "截止日期不能为空"})
	}

	priority := req.Priority
	if priority == "" {
		priority = "normal"
	}

	var maxNo int
	DB.QueryRow("SELECT COALESCE(MAX(CAST(SUBSTR(order_no, 9) AS INTEGER)), 0) FROM repair_orders WHERE order_no LIKE 'WX-2025-%'").Scan(&maxNo)
	orderNo := fmt.Sprintf("WX-2025-%03d", maxNo+1)

	userID := c.Locals("userId").(int)
	now := time.Now().Format("2006-01-02 15:04:05")

	result, err := DB.Exec(
		`INSERT INTO repair_orders (order_no, title, description, status, priority, customer_id, deadline, version, created_at, updated_at)
		VALUES (?, ?, ?, '待接单', ?, ?, ?, 1, ?, ?)`,
		orderNo, req.Title, req.Description, priority, userID, req.Deadline, now, now,
	)
	if err != nil {
		return c.Status(500).JSON(APIResponse{Code: -1, Message: "创建工单失败"})
	}

	orderID, _ := result.LastInsertId()

	DB.Exec(
		`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at)
		VALUES (?, '建单', '', '待接单', ?, ?, '', ?)`,
		orderID, userID, role, now,
	)

	return GetOrder(c)
}

type transitionRule struct {
	allowedRole      string
	fromStatus       string
	requireOwner     bool
	ownerField       string
	requiredEvidence string
	requireException bool
}

func getTransitionRules() map[string]transitionRule {
	return map[string]transitionRule{
		"已接单_待接单":  {allowedRole: "师傅调度", fromStatus: "待接单", requireOwner: false},
		"施工中":      {allowedRole: "师傅调度", fromStatus: "已接单", requireOwner: true, ownerField: "technician_id"},
		"待验收":      {allowedRole: "师傅调度", fromStatus: "施工中", requireOwner: true, ownerField: "technician_id", requiredEvidence: "施工证据"},
		"验收通过":     {allowedRole: "服务经理", fromStatus: "待验收", requireOwner: false, requiredEvidence: "验收证据"},
		"退回补正":     {allowedRole: "服务经理", fromStatus: "待验收", requireOwner: false, requireException: true},
		"已接单_退回补正": {allowedRole: "师傅调度", fromStatus: "退回补正", requireOwner: true, ownerField: "technician_id"},
		"已归档":      {allowedRole: "服务经理", fromStatus: "验收通过", requireOwner: false},
	}
}

func getTransitionKey(toStatus, fromStatus string) string {
	if toStatus == "已接单" {
		if fromStatus == "待接单" {
			return "已接单_待接单"
		}
		if fromStatus == "退回补正" {
			return "已接单_退回补正"
		}
	}
	return toStatus
}

func hasAttachmentInDB(orderID int, category string) bool {
	var cnt int
	DB.QueryRow("SELECT COUNT(*) FROM attachments WHERE order_id = ? AND category = ?", orderID, category).Scan(&cnt)
	return cnt > 0
}

func hasExceptionReasonInDB(orderID int) bool {
	var cnt int
	DB.QueryRow("SELECT COUNT(*) FROM exception_reasons WHERE order_id = ?", orderID).Scan(&cnt)
	return cnt > 0
}

func getActionLabel(toStatus, fromStatus string) string {
	switch toStatus {
	case "已接单":
		if fromStatus == "退回补正" {
			return "重新接单"
		}
		return "接单"
	case "施工中":
		return "开工"
	case "待验收":
		return "完工"
	case "验收通过":
		return "验收通过"
	case "退回补正":
		return "退回补正"
	case "已归档":
		return "归档"
	default:
		return toStatus
	}
}

func getStatusHint(status string) string {
	switch status {
	case "待接单":
		return "需师傅调度接单"
	case "已接单":
		return "需师傅调度开工"
	case "施工中":
		return "需师傅调度完工"
	case "待验收":
		return "需服务经理验收或退回"
	case "退回补正":
		return "需师傅调度重新接单处理"
	case "验收通过":
		return "需服务经理归档"
	case "已归档":
		return "工单已归档，无法变更"
	default:
		return ""
	}
}

type orderSnapshot struct {
	ID            int
	OrderNo       string
	Status        string
	Version       int
	TechnicianID  int
	ManagerID     int
	ExceptionType string
}

func getOrderSnapshot(orderID int) (orderSnapshot, error) {
	var s orderSnapshot
	err := DB.QueryRow(
		"SELECT id, order_no, status, version, technician_id, manager_id, exception_type FROM repair_orders WHERE id = ?",
		orderID,
	).Scan(&s.ID, &s.OrderNo, &s.Status, &s.Version, &s.TechnicianID, &s.ManagerID, &s.ExceptionType)
	return s, err
}

type transitionInput struct {
	OrderID          int
	ToStatus         string
	Version          int
	UserID           int
	Role             string
	Remark           string
	ExceptionReason  string
	Attachments      []Attachment
	SkipVersionCheck bool
}

func validateTransition(input transitionInput) (bool, string, orderSnapshot) {
	snap, err := getOrderSnapshot(input.OrderID)
	if err != nil {
		return false, "工单不存在", snap
	}

	if !input.SkipVersionCheck && input.Version != snap.Version {
		return false, fmt.Sprintf("版本冲突：当前版本为v%d，提交版本为v%d，请刷新后重试", snap.Version, input.Version), snap
	}

	key := getTransitionKey(input.ToStatus, snap.Status)
	rules := getTransitionRules()
	rule, ok := rules[key]
	if !ok {
		return false, fmt.Sprintf("不支持从%s变更到%s", snap.Status, input.ToStatus), snap
	}

	if rule.fromStatus != snap.Status {
		return false, fmt.Sprintf("状态冲突：当前状态为%s，无法变更为%s。%s", snap.Status, input.ToStatus, getStatusHint(snap.Status)), snap
	}

	if input.Role != rule.allowedRole {
		return false, fmt.Sprintf("越权：仅%s可执行此操作，当前角色为%s", rule.allowedRole, input.Role), snap
	}

	if rule.requireOwner {
		var ownerID int
		switch rule.ownerField {
		case "technician_id":
			ownerID = snap.TechnicianID
		case "manager_id":
			ownerID = snap.ManagerID
		}
		if ownerID == 0 {
			return false, "越权：当前工单未分配处理人", snap
		}
		if ownerID != input.UserID {
			ownerLabel := ""
			switch rule.ownerField {
			case "technician_id":
				ownerLabel = fmt.Sprintf("师傅(ID:%d)", ownerID)
			case "manager_id":
				ownerLabel = fmt.Sprintf("经理(ID:%d)", ownerID)
			}
			return false, fmt.Sprintf("越权：当前处理人为%s，仅该处理人可操作", ownerLabel), snap
		}
	}

	if rule.requiredEvidence != "" {
		hasInReq := false
		for _, att := range input.Attachments {
			if att.Category == rule.requiredEvidence {
				hasInReq = true
				break
			}
		}
		if !hasInReq && !hasAttachmentInDB(input.OrderID, rule.requiredEvidence) {
			return false, fmt.Sprintf("缺少必填证据：%s", rule.requiredEvidence), snap
		}
	}

	if rule.requireException && input.ExceptionReason == "" && !hasExceptionReasonInDB(input.OrderID) {
		return false, "退回补正需要填写异常原因", snap
	}

	return true, "", snap
}

func executeStatusTransition(input transitionInput) (bool, string, orderSnapshot) {
	ok, msg, snap := validateTransition(input)
	if !ok {
		return false, msg, snap
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	newVersion := snap.Version + 1

	tx, err := DB.Begin()
	if err != nil {
		return false, "启动事务失败", snap
	}

	updateSQL := "UPDATE repair_orders SET status = ?, version = ?, updated_at = ?"
	updateArgs := []interface{}{input.ToStatus, newVersion, now}

	if input.ToStatus == "已接单" && (snap.Status == "待接单" || snap.Status == "退回补正") {
		updateSQL += ", technician_id = ?"
		updateArgs = append(updateArgs, input.UserID)
	}
	if input.ToStatus == "验收通过" || input.ToStatus == "退回补正" {
		updateSQL += ", manager_id = ?"
		updateArgs = append(updateArgs, input.UserID)
	}
	if input.ToStatus == "已归档" {
		updateSQL += ", exception_type = ''"
	}

	updateSQL += " WHERE id = ? AND version = ?"
	updateArgs = append(updateArgs, input.OrderID, snap.Version)

	res, err := tx.Exec(updateSQL, updateArgs...)
	if err != nil {
		tx.Rollback()
		return false, "更新状态失败", snap
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		tx.Rollback()
		return false, fmt.Sprintf("版本冲突：当前版本已变更，请刷新后重试"), snap
	}

	action := getActionLabel(input.ToStatus, snap.Status)
	_, err = tx.Exec(
		`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		input.OrderID, action, snap.Status, input.ToStatus, input.UserID, input.Role, input.Remark, now,
	)
	if err != nil {
		tx.Rollback()
		return false, "写入状态历史失败", snap
	}

	for _, att := range input.Attachments {
		_, err = tx.Exec(
			`INSERT INTO attachments (order_id, file_name, category, uploaded_by, upload_role, created_at)
			VALUES (?, ?, ?, ?, ?, ?)`,
			input.OrderID, att.FileName, att.Category, input.UserID, input.Role, now,
		)
		if err != nil {
			tx.Rollback()
			return false, "写入附件失败", snap
		}
	}

	if input.ToStatus == "退回补正" && input.ExceptionReason != "" {
		_, err = tx.Exec(
			`INSERT INTO exception_reasons (order_id, reason_type, description, created_by, created_at)
			VALUES (?, '退回补正', ?, ?, ?)`,
			input.OrderID, input.ExceptionReason, input.UserID, now,
		)
		if err != nil {
			tx.Rollback()
			return false, "写入异常原因失败", snap
		}
		_, err = tx.Exec("UPDATE repair_orders SET exception_type = '退回补正', updated_at = ? WHERE id = ?", now, input.OrderID)
		if err != nil {
			tx.Rollback()
			return false, "更新异常类型失败", snap
		}
	}

	if input.ToStatus == "退回补正" && input.Remark != "" {
		_, err = tx.Exec(
			`INSERT INTO audit_notes (order_id, note, author_id, author_role, created_at)
			VALUES (?, ?, ?, ?, ?)`,
			input.OrderID, fmt.Sprintf("退回补正：%s", input.Remark), input.UserID, input.Role, now,
		)
		if err != nil {
			tx.Rollback()
			return false, "写入审计备注失败", snap
		}
	}

	if err := tx.Commit(); err != nil {
		tx.Rollback()
		return false, "提交事务失败", snap
	}

	snap.Status = input.ToStatus
	snap.Version = newVersion
	return true, "操作成功", snap
}

func UpdateOrderStatus(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))

	var req UpdateStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(APIResponse{Code: -1, Message: "请求参数错误"})
	}

	role := c.Locals("role").(string)
	userID := c.Locals("userId").(int)

	attachments := []Attachment{}
	for _, att := range req.Attachments {
		attachments = append(attachments, Attachment{
			FileName: att.FileName,
			Category: att.Category,
		})
	}

	input := transitionInput{
		OrderID:          id,
		ToStatus:         req.Status,
		Version:          req.Version,
		UserID:           userID,
		Role:             role,
		Remark:           req.Remark,
		ExceptionReason:  req.ExceptionReason,
		Attachments:      attachments,
		SkipVersionCheck: false,
	}

	ok, msg, _ := executeStatusTransition(input)
	if !ok {
		return c.Status(409).JSON(APIResponse{Code: -1, Message: msg})
	}

	return GetOrder(c)
}

func BatchUpdateStatus(c *fiber.Ctx) error {
	var req BatchUpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(APIResponse{Code: -1, Message: "请求参数错误"})
	}

	if len(req.Orders) == 0 {
		return c.Status(400).JSON(APIResponse{Code: -1, Message: "请选择要处理的工单"})
	}

	role := c.Locals("role").(string)
	userID := c.Locals("userId").(int)

	results := []BatchResultItem{}

	for _, item := range req.Orders {
		preSnap, _ := getOrderSnapshot(item.OrderID)

		input := transitionInput{
			OrderID:          item.OrderID,
			ToStatus:         req.Status,
			Version:          item.Version,
			UserID:           userID,
			Role:             role,
			Remark:           req.Remark,
			ExceptionReason:  "",
			Attachments:      []Attachment{},
			SkipVersionCheck: false,
		}

		ok, msg, postSnap := executeStatusTransition(input)

		finalVersion := preSnap.Version
		finalTech := preSnap.TechnicianID
		finalManager := preSnap.ManagerID
		if ok {
			finalVersion = postSnap.Version
			finalTech = postSnap.TechnicianID
			finalManager = postSnap.ManagerID
		}

		results = append(results, BatchResultItem{
			OrderID:      item.OrderID,
			OrderNo:      preSnap.OrderNo,
			Success:      ok,
			Message:      msg,
			FromStatus:   preSnap.Status,
			ToStatus:     req.Status,
			Version:      finalVersion,
			SubmittedVer: item.Version,
			CurrentVer:   finalVersion,
			TechnicianID: finalTech,
			ManagerID:    finalManager,
		})
	}

	return c.JSON(APIResponse{
		Code:    0,
		Message: "success",
		Data:    results,
	})
}

func GetAuditTrail(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))

	trail := []AuditTrailItem{}

	rows, _ := DB.Query("SELECT id, order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at FROM process_records WHERE order_id = ? ORDER BY created_at", id)
	defer rows.Close()
	for rows.Next() {
		var p ProcessRecord
		rows.Scan(&p.ID, &p.OrderID, &p.Action, &p.FromStatus, &p.ToStatus, &p.OperatorID, &p.OperatorRole, &p.Remark, &p.CreatedAt)
		trail = append(trail, AuditTrailItem{
			Type:         "process",
			ID:           p.ID,
			OrderID:      p.OrderID,
			Action:       p.Action,
			FromStatus:   p.FromStatus,
			ToStatus:     p.ToStatus,
			OperatorID:   p.OperatorID,
			OperatorRole: p.OperatorRole,
			Remark:       p.Remark,
			CreatedAt:    p.CreatedAt,
		})
	}

	rows2, _ := DB.Query("SELECT id, order_id, note, author_id, author_role, created_at FROM audit_notes WHERE order_id = ? ORDER BY created_at", id)
	defer rows2.Close()
	for rows2.Next() {
		var n AuditNote
		rows2.Scan(&n.ID, &n.OrderID, &n.Note, &n.AuthorID, &n.AuthorRole, &n.CreatedAt)
		trail = append(trail, AuditTrailItem{
			Type:       "audit_note",
			ID:         n.ID,
			OrderID:    n.OrderID,
			Note:       n.Note,
			AuthorID:   n.AuthorID,
			AuthorRole: n.AuthorRole,
			CreatedAt:  n.CreatedAt,
		})
	}

	rows3, _ := DB.Query("SELECT id, order_id, reason_type, description, created_by, created_at FROM exception_reasons WHERE order_id = ? ORDER BY created_at", id)
	defer rows3.Close()
	for rows3.Next() {
		var e ExceptionReason
		rows3.Scan(&e.ID, &e.OrderID, &e.ReasonType, &e.Description, &e.CreatedBy, &e.CreatedAt)
		trail = append(trail, AuditTrailItem{
			Type:        "exception",
			ID:          e.ID,
			OrderID:     e.OrderID,
			ReasonType:  e.ReasonType,
			Description: e.Description,
			CreatedBy:   e.CreatedBy,
			CreatedAt:   e.CreatedAt,
		})
	}

	for i := 0; i < len(trail); i++ {
		for j := i + 1; j < len(trail); j++ {
			ti, _ := time.Parse("2006-01-02 15:04:05", trail[i].CreatedAt)
			tj, _ := time.Parse("2006-01-02 15:04:05", trail[j].CreatedAt)
			if tj.Before(ti) {
				trail[i], trail[j] = trail[j], trail[i]
			}
		}
	}

	return c.JSON(APIResponse{
		Code:    0,
		Message: "success",
		Data:    trail,
	})
}

func CreateAttachment(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))

	var body struct {
		FileName string `json:"file_name"`
		Category string `json:"category"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(APIResponse{Code: -1, Message: "请求参数错误"})
	}

	userID := c.Locals("userId").(int)
	role := c.Locals("role").(string)
	now := time.Now().Format("2006-01-02 15:04:05")

	result, err := DB.Exec(
		`INSERT INTO attachments (order_id, file_name, category, uploaded_by, upload_role, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		id, body.FileName, body.Category, userID, role, now,
	)
	if err != nil {
		return c.Status(500).JSON(APIResponse{Code: -1, Message: "创建附件失败"})
	}

	attID, _ := result.LastInsertId()

	DB.Exec(
		`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at)
		VALUES (?, '上传附件', '', '', ?, ?, ?, ?)`,
		id, userID, role, fmt.Sprintf("上传附件：%s（%s）", body.FileName, body.Category), now,
	)

	return c.JSON(APIResponse{
		Code:    0,
		Message: "success",
		Data: Attachment{
			ID:         int(attID),
			OrderID:    id,
			FileName:   body.FileName,
			Category:   body.Category,
			UploadedBy: userID,
			UploadRole: role,
			CreatedAt:  now,
		},
	})
}

func CreateAuditNote(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))

	var body struct {
		Note string `json:"note"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(APIResponse{Code: -1, Message: "请求参数错误"})
	}

	userID := c.Locals("userId").(int)
	role := c.Locals("role").(string)
	now := time.Now().Format("2006-01-02 15:04:05")

	result, err := DB.Exec(
		`INSERT INTO audit_notes (order_id, note, author_id, author_role, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		id, body.Note, userID, role, now,
	)
	if err != nil {
		return c.Status(500).JSON(APIResponse{Code: -1, Message: "创建批注失败"})
	}

	noteID, _ := result.LastInsertId()

	DB.Exec(
		`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at)
		VALUES (?, '添加备注', '', '', ?, ?, ?, ?)`,
		id, userID, role, body.Note, now,
	)

	return c.JSON(APIResponse{
		Code:    0,
		Message: "success",
		Data: AuditNote{
			ID:         int(noteID),
			OrderID:    id,
			Note:       body.Note,
			AuthorID:   userID,
			AuthorRole: role,
			CreatedAt:  now,
		},
	})
}

func CreateExceptionReason(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))

	var body struct {
		ReasonType  string `json:"reason_type"`
		Description string `json:"description"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(APIResponse{Code: -1, Message: "请求参数错误"})
	}

	userID := c.Locals("userId").(int)
	role := c.Locals("role").(string)
	now := time.Now().Format("2006-01-02 15:04:05")

	result, err := DB.Exec(
		`INSERT INTO exception_reasons (order_id, reason_type, description, created_by, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		id, body.ReasonType, body.Description, userID, now,
	)
	if err != nil {
		return c.Status(500).JSON(APIResponse{Code: -1, Message: "创建异常原因失败"})
	}

	reasonID, _ := result.LastInsertId()

	DB.Exec("UPDATE repair_orders SET exception_type = ?, updated_at = ? WHERE id = ?", body.ReasonType, now, id)

	DB.Exec(
		`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at)
		VALUES (?, '记录异常', '', '', ?, ?, ?, ?)`,
		id, userID, role, fmt.Sprintf("异常原因[%s]：%s", body.ReasonType, body.Description), now,
	)

	return c.JSON(APIResponse{
		Code:    0,
		Message: "success",
		Data: ExceptionReason{
			ID:          int(reasonID),
			OrderID:     id,
			ReasonType:  body.ReasonType,
			Description: body.Description,
			CreatedBy:   userID,
			CreatedAt:   now,
		},
	})
}

func GetStatistics(c *fiber.Ctx) error {
	statusList := []string{"待接单", "已接单", "施工中", "待验收", "验收通过", "退回补正", "已归档"}
	statusCounts := map[string]int{}
	total := 0

	for _, s := range statusList {
		var cnt int
		DB.QueryRow("SELECT COUNT(*) FROM repair_orders WHERE status = ?", s).Scan(&cnt)
		statusCounts[s] = cnt
		total += cnt
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	approaching := time.Now().Add(3 * 24 * time.Hour).Format("2006-01-02 15:04:05")

	var normalCount int
	DB.QueryRow("SELECT COUNT(*) FROM repair_orders WHERE (deadline = '' OR deadline > ?) AND status NOT IN ('验收通过', '已归档')", approaching).Scan(&normalCount)

	var approachingCount int
	DB.QueryRow("SELECT COUNT(*) FROM repair_orders WHERE deadline > ? AND deadline <= ? AND status NOT IN ('验收通过', '已归档')", now, approaching).Scan(&approachingCount)

	var overdueCount int
	DB.QueryRow("SELECT COUNT(*) FROM repair_orders WHERE deadline < ? AND deadline != '' AND status NOT IN ('验收通过', '已归档')", now).Scan(&overdueCount)

	return c.JSON(APIResponse{
		Code:    0,
		Message: "success",
		Data: StatisticsResponse{
			StatusCounts: statusCounts,
			ExpiryCounts: map[string]int{
				"normal":      normalCount,
				"approaching": approachingCount,
				"overdue":     overdueCount,
			},
			Total: total,
		},
	})
}
