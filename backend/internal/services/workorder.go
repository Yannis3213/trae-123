package services

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"workshop-system/internal/config"
	"workshop-system/internal/database"
	"workshop-system/internal/models"
	"workshop-system/internal/utils"
)

type WorkOrderService struct{}

func NewWorkOrderService() *WorkOrderService {
	return &WorkOrderService{}
}

var (
	ErrPermissionDenied  = errors.New("权限不足")
	ErrInvalidStatus     = errors.New("状态无效")
	ErrStatusConflict    = errors.New("状态冲突，工单已被其他操作修改")
	ErrVersionMismatch   = errors.New("版本冲突，请刷新后重试")
	ErrMissingEvidence   = errors.New("缺少必填证据附件")
	ErrInvalidHandler    = errors.New("当前处理人不匹配")
	ErrOverdueNotAllowed = errors.New("工单已逾期，需先处理逾期问题")
	ErrWorkOrderNotFound = errors.New("工单不存在")
)

type StateTransition struct {
	FromStatus       models.WorkOrderStatus
	ToStatus         models.WorkOrderStatus
	Action           string
	AllowedRoles     []models.Role
	RequiredEvidence []string
}

var stateTransitions = []StateTransition{
	{
		FromStatus:       models.StatusDraft,
		ToStatus:         models.StatusPendingAudit,
		Action:           "submit",
		AllowedRoles:     []models.Role{models.RoleRegistrar},
		RequiredEvidence: []string{"registration_form", "vehicle_checklist"},
	},
	{
		FromStatus:       models.StatusPendingAudit,
		ToStatus:         models.StatusPendingReview,
		Action:           "approve",
		AllowedRoles:     []models.Role{models.RoleSupervisor},
		RequiredEvidence: []string{"inspection_report", "repair_quote", "parts_confirmation"},
	},
	{
		FromStatus:       models.StatusPendingAudit,
		ToStatus:         models.StatusCorrection,
		Action:           "reject",
		AllowedRoles:     []models.Role{models.RoleSupervisor},
		RequiredEvidence: nil,
	},
	{
		FromStatus:       models.StatusCorrection,
		ToStatus:         models.StatusPendingAudit,
		Action:           "resubmit",
		AllowedRoles:     []models.Role{models.RoleRegistrar},
		RequiredEvidence: []string{"registration_form", "vehicle_checklist"},
	},
	{
		FromStatus:       models.StatusPendingReview,
		ToStatus:         models.StatusCompleted,
		Action:           "archive",
		AllowedRoles:     []models.Role{models.RoleManager},
		RequiredEvidence: []string{"final_inspection", "delivery_note", "customer_confirmation"},
	},
	{
		FromStatus:       models.StatusPendingReview,
		ToStatus:         models.StatusCorrection,
		Action:           "send_back",
		AllowedRoles:     []models.Role{models.RoleManager},
		RequiredEvidence: nil,
	},
}

func (s *WorkOrderService) GetList(req *models.WorkOrderListRequest, user *models.User) ([]*models.WorkOrder, int64, error) {
	database.UpdateWarningLevels()

	where := "WHERE 1=1"
	args := []interface{}{}

	if req.Status != "" {
		where += " AND status = ?"
		args = append(args, req.Status)
	}

	if req.AppointmentClue != "" {
		where += " AND appointment_clue LIKE ?"
		args = append(args, "%"+req.AppointmentClue+"%")
	}

	if req.WarningLevel != "" {
		where += " AND warning_level = ?"
		args = append(args, req.WarningLevel)
	}

	if req.LicensePlate != "" {
		where += " AND license_plate LIKE ?"
		args = append(args, "%"+req.LicensePlate+"%")
	}

	if user.Role != models.RoleManager {
		where += " AND current_handler_id = ?"
		args = append(args, user.ID)
	}

	countSQL := "SELECT COUNT(*) FROM work_orders " + where
	var total int64
	database.DB.QueryRow(countSQL, args...).Scan(&total)

	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	listSQL := `
		SELECT id, order_no, appointment_clue, customer_name, phone, license_plate,
			car_model, mileage, fault_description, status,
			registrar_id, registrar_name, current_handler_id, current_handler_name,
			supervisor_id, supervisor_name, manager_id, manager_name,
			expected_complete_at, warning_level, is_overdue, version,
			created_at, updated_at
		FROM work_orders ` + where + `
		ORDER BY 
			CASE warning_level
				WHEN 'overdue' THEN 1
				WHEN 'near_due' THEN 2
				ELSE 3
			END,
			created_at DESC
		LIMIT ? OFFSET ?
	`
	args = append(args, pageSize, offset)

	rows, err := database.DB.Query(listSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var orders []*models.WorkOrder
	for rows.Next() {
		o := &models.WorkOrder{}
		err := rows.Scan(
			&o.ID, &o.OrderNo, &o.AppointmentClue, &o.CustomerName, &o.Phone, &o.LicensePlate,
			&o.CarModel, &o.Mileage, &o.FaultDescription, &o.Status,
			&o.RegistrarID, &o.RegistrarName, &o.CurrentHandlerID, &o.CurrentHandlerName,
			&o.SupervisorID, &o.SupervisorName, &o.ManagerID, &o.ManagerName,
			&o.ExpectedCompleteAt, &o.WarningLevel, &o.IsOverdue, &o.Version,
			&o.CreatedAt, &o.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		orders = append(orders, o)
	}

	return orders, total, nil
}

func (s *WorkOrderService) GetDetail(id int64, user *models.User) (*models.WorkOrderDetail, error) {
	database.UpdateWarningLevels()

	o := &models.WorkOrderDetail{}
	err := database.DB.QueryRow(`
		SELECT id, order_no, appointment_clue, customer_name, phone, license_plate,
			car_model, mileage, fault_description, status,
			registrar_id, registrar_name, current_handler_id, current_handler_name,
			supervisor_id, supervisor_name, manager_id, manager_name,
			expected_complete_at, warning_level, is_overdue, version,
			created_at, updated_at
		FROM work_orders WHERE id = ?
	`, id).Scan(
		&o.ID, &o.OrderNo, &o.AppointmentClue, &o.CustomerName, &o.Phone, &o.LicensePlate,
		&o.CarModel, &o.Mileage, &o.FaultDescription, &o.Status,
		&o.RegistrarID, &o.RegistrarName, &o.CurrentHandlerID, &o.CurrentHandlerName,
		&o.SupervisorID, &o.SupervisorName, &o.ManagerID, &o.ManagerName,
		&o.ExpectedCompleteAt, &o.WarningLevel, &o.IsOverdue, &o.Version,
		&o.CreatedAt, &o.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrWorkOrderNotFound
	}
	if err != nil {
		return nil, err
	}

	if user.Role != models.RoleManager && o.CurrentHandlerID != user.ID {
		return nil, ErrPermissionDenied
	}

	attachRows, _ := database.DB.Query(`
		SELECT id, work_order_id, file_name, file_type, file_size, file_path,
			uploaded_by, uploader, evidence_type, created_at
		FROM attachments WHERE work_order_id = ? ORDER BY created_at DESC
	`, id)
	for attachRows.Next() {
		a := models.Attachment{}
		attachRows.Scan(&a.ID, &a.WorkOrderID, &a.FileName, &a.FileType, &a.FileSize,
			&a.FilePath, &a.UploadedBy, &a.Uploader, &a.EvidenceType, &a.CreatedAt)
		o.Attachments = append(o.Attachments, a)
	}
	attachRows.Close()

	logRows, _ := database.DB.Query(`
		SELECT id, work_order_id, operator_id, operator, action,
			from_status, to_status, remark, created_at
		FROM processing_logs WHERE work_order_id = ? ORDER BY created_at DESC
	`, id)
	for logRows.Next() {
		l := models.ProcessingLog{}
		logRows.Scan(&l.ID, &l.WorkOrderID, &l.OperatorID, &l.Operator, &l.Action,
			&l.FromStatus, &l.ToStatus, &l.Remark, &l.CreatedAt)
		o.ProcessingLogs = append(o.ProcessingLogs, l)
	}
	logRows.Close()

	noteRows, _ := database.DB.Query(`
		SELECT id, work_order_id, operator_id, operator, note, created_at
		FROM audit_notes WHERE work_order_id = ? ORDER BY created_at DESC
	`, id)
	for noteRows.Next() {
		n := models.AuditNote{}
		noteRows.Scan(&n.ID, &n.WorkOrderID, &n.OperatorID, &n.Operator, &n.Note, &n.CreatedAt)
		o.AuditNotes = append(o.AuditNotes, n)
	}
	noteRows.Close()

	var exceptionReason string
	database.DB.QueryRow(`
		SELECT reason FROM exception_records
		WHERE work_order_id = ? AND resolved_at IS NULL
		ORDER BY created_at DESC LIMIT 1
	`, id).Scan(&exceptionReason)
	o.ExceptionReason = exceptionReason

	return o, nil
}

func (s *WorkOrderService) Create(req *models.WorkOrderCreateRequest, user *models.User) (*models.WorkOrder, error) {
	if user.Role != models.RoleRegistrar {
		return nil, ErrPermissionDenied
	}

	orderNo := utils.GenerateOrderNo()
	now := time.Now()

	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO work_orders (
			order_no, appointment_clue, customer_name, phone, license_plate,
			car_model, mileage, fault_description, status,
			registrar_id, registrar_name, current_handler_id, current_handler_name,
			expected_complete_at, warning_level, is_overdue, version,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		orderNo, req.AppointmentClue, req.CustomerName, req.Phone, req.LicensePlate,
		req.CarModel, req.Mileage, req.FaultDescription, models.StatusDraft,
		user.ID, user.Name, user.ID, user.Name,
		req.ExpectedCompleteAt, "normal", 0, 1,
		now, now,
	)
	if err != nil {
		return nil, err
	}

	id, _ := res.LastInsertId()

	_, err = tx.Exec(`
		INSERT INTO processing_logs (
			work_order_id, operator_id, operator, action,
			from_status, to_status, remark
		) VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, user.ID, user.Name, "创建工单", "", models.StatusDraft, "工单创建成功")
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetByID(id)
}

func getUserIDByRole(tx *sql.Tx, role models.Role) (int64, string, error) {
	var id int64
	var name string
	err := tx.QueryRow(`
			SELECT id, name FROM users WHERE role = ? ORDER BY id LIMIT 1
		`, role).Scan(&id, &name)
	return id, name, err
}

func (s *WorkOrderService) Process(id int64, req *models.WorkOrderProcessRequest, user *models.User) (*models.WorkOrderDetail, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var currentStatus models.WorkOrderStatus
	var currentVersion int
	var currentHandlerID int64

	err = tx.QueryRow(`
		SELECT status, version, current_handler_id FROM work_orders WHERE id = ?
	`, id).Scan(&currentStatus, &currentVersion, &currentHandlerID)
	if err == sql.ErrNoRows {
		return nil, ErrWorkOrderNotFound
	}
	if err != nil {
		return nil, err
	}

	if req.Version != 0 && req.Version != currentVersion {
		return nil, ErrVersionMismatch
	}

	if currentHandlerID != user.ID {
		return nil, ErrInvalidHandler
	}

	var transition *StateTransition
	for _, t := range stateTransitions {
		if t.FromStatus == currentStatus && t.Action == req.Action {
			transition = &t
			break
		}
	}
	if transition == nil {
		return nil, ErrInvalidStatus
	}

	roleAllowed := false
	for _, r := range transition.AllowedRoles {
		if r == user.Role {
			roleAllowed = true
			break
		}
	}
	if !roleAllowed {
		return nil, ErrPermissionDenied
	}

	if req.Action == "reject" || req.Action == "send_back" {
		if req.ExceptionReason == "" {
			return nil, fmt.Errorf("退回补正操作必须填写异常原因")
		}
	}

	if transition.RequiredEvidence != nil && len(transition.RequiredEvidence) > 0 {
		var missingEvidence []string
		for _, evidenceType := range transition.RequiredEvidence {
			var count int
			tx.QueryRow(`
				SELECT COUNT(*) FROM attachments
				WHERE work_order_id = ? AND evidence_type = ?
			`, id, evidenceType).Scan(&count)
			if count == 0 {
				missingEvidence = append(missingEvidence, getEvidenceName(evidenceType))
			}
		}
		if len(missingEvidence) > 0 {
			return nil, fmt.Errorf("%w: 缺少 %s", ErrMissingEvidence, strings.Join(missingEvidence, "、"))
		}
	}

	var newHandlerID int64
	var newHandlerName string
	updateFields := []string{
		"status = ?",
		"current_handler_id = ?",
		"current_handler_name = ?",
		"version = version + 1",
		"updated_at = ?",
	}
	updateArgs := []interface{}{}

	switch transition.ToStatus {
	case models.StatusPendingAudit:
		newHandlerID, newHandlerName, err = getUserIDByRole(tx, models.RoleSupervisor)
		if err != nil {
			return nil, fmt.Errorf("failed to get supervisor: %w", err)
		}
	case models.StatusPendingReview:
		newHandlerID, newHandlerName, err = getUserIDByRole(tx, models.RoleManager)
		if err != nil {
			return nil, fmt.Errorf("failed to get manager: %w", err)
		}
		updateFields = append(updateFields, "supervisor_id = ?", "supervisor_name = ?")
	case models.StatusCorrection:
		newHandlerID, newHandlerName, err = getUserIDByRole(tx, models.RoleRegistrar)
		if err != nil {
			return nil, fmt.Errorf("failed to get registrar: %w", err)
		}
		reason := req.ExceptionReason
		if reason == "" {
			reason = "退回补正"
		}
		exceptionType := "correction"
		if req.Action == "reject" {
			exceptionType = "rejected"
		} else if req.Action == "send_back" {
			exceptionType = "send_back"
		}
		_, err = tx.Exec(`
			INSERT INTO exception_records (
				work_order_id, exception_type, reason,
				operator_id, operator, current_status
			) VALUES (?, ?, ?, ?, ?, ?)
		`, id, exceptionType, reason, user.ID, user.Name, currentStatus)
		if err != nil {
			return nil, err
		}
	case models.StatusCompleted:
		newHandlerID = user.ID
		newHandlerName = user.Name
		updateFields = append(updateFields, "manager_id = ?", "manager_name = ?")
	}

	updateArgs = append(updateArgs,
		transition.ToStatus, newHandlerID, newHandlerName,
		time.Now(),
	)

	if transition.ToStatus == models.StatusPendingReview {
		updateArgs = append(updateArgs, user.ID, user.Name)
	}
	if transition.ToStatus == models.StatusCompleted {
		updateArgs = append(updateArgs, user.ID, user.Name)
	}

	updateArgs = append(updateArgs, id, currentVersion)

	updateSQL := fmt.Sprintf(`
		UPDATE work_orders SET %s WHERE id = ? AND version = ?
	`, strings.Join(updateFields, ", "))

	_, err = tx.Exec(updateSQL, updateArgs...)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(`
		INSERT INTO processing_logs (
			work_order_id, operator_id, operator, action,
			from_status, to_status, remark
		) VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, user.ID, user.Name, getActionName(req.Action),
		currentStatus, transition.ToStatus, req.Remark)
	if err != nil {
		return nil, err
	}

	if transition.ToStatus == models.StatusCompleted {
		_, err = tx.Exec(`
			UPDATE exception_records SET resolved_at = ?, resolution = ?
			WHERE work_order_id = ? AND resolved_at IS NULL
		`, time.Now(), "工单完成归档", id)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetDetail(id, user)
}

func (s *WorkOrderService) BatchProcess(req *models.BatchOperationRequest, user *models.User) (*models.BatchOperationResponse, error) {
	response := &models.BatchOperationResponse{
		Total: len(req.IDs),
	}

	for _, id := range req.IDs {
		var orderNo string
		database.DB.QueryRow("SELECT order_no FROM work_orders WHERE id = ?", id).Scan(&orderNo)

		processReq := &models.WorkOrderProcessRequest{
			Action:          req.Action,
			Remark:          req.AuditNote,
			ExceptionReason: req.ExceptionReason,
			Version:         0,
		}

		_, err := s.Process(id, processReq, user)
		if err != nil {
			response.Failed++
			response.Results = append(response.Results, models.BatchResultItem{
				ID:      id,
				OrderNo: orderNo,
				Success: false,
				Message: err.Error(),
			})
		} else {
			response.Success++
			response.Results = append(response.Results, models.BatchResultItem{
				ID:      id,
				OrderNo: orderNo,
				Success: true,
				Message: "处理成功",
			})
		}
	}

	return response, nil
}

func (s *WorkOrderService) AddAuditNote(id int64, note string, user *models.User) error {
	_, err := database.DB.Exec(`
		INSERT INTO audit_notes (work_order_id, operator_id, operator, note)
		VALUES (?, ?, ?, ?)
	`, id, user.ID, user.Name, note)
	return err
}

func (s *WorkOrderService) GetStatistics(user *models.User) (*models.Statistics, error) {
	database.UpdateWarningLevels()

	where := "WHERE 1=1"
	args := []interface{}{}

	if user.Role != models.RoleManager {
		where += " AND current_handler_id = ?"
		args = append(args, user.ID)
	}

	stats := &models.Statistics{}

	database.DB.QueryRow("SELECT COUNT(*) FROM work_orders "+where, args...).Scan(&stats.TotalCount)

	database.DB.QueryRow("SELECT COUNT(*) FROM work_orders "+where+" AND status = ?",
		append(args, models.StatusPendingAudit)...).Scan(&stats.PendingAudit)
	database.DB.QueryRow("SELECT COUNT(*) FROM work_orders "+where+" AND status = ?",
		append(args, models.StatusPendingReview)...).Scan(&stats.PendingReview)
	database.DB.QueryRow("SELECT COUNT(*) FROM work_orders "+where+" AND status = ?",
		append(args, models.StatusCorrection)...).Scan(&stats.Correction)
	database.DB.QueryRow("SELECT COUNT(*) FROM work_orders "+where+" AND status = ?",
		append(args, models.StatusCompleted)...).Scan(&stats.Completed)

	database.DB.QueryRow("SELECT COUNT(*) FROM work_orders "+where+" AND warning_level = ?",
		append(args, models.WarningNormal)...).Scan(&stats.Normal)
	database.DB.QueryRow("SELECT COUNT(*) FROM work_orders "+where+" AND warning_level = ?",
		append(args, models.WarningNearDue)...).Scan(&stats.NearDue)
	database.DB.QueryRow("SELECT COUNT(*) FROM work_orders "+where+" AND warning_level = ?",
		append(args, models.WarningOverdue)...).Scan(&stats.Overdue)

	return stats, nil
}

func (s *WorkOrderService) GetByID(id int64) (*models.WorkOrder, error) {
	o := &models.WorkOrder{}
	err := database.DB.QueryRow(`
		SELECT id, order_no, appointment_clue, customer_name, phone, license_plate,
			car_model, mileage, fault_description, status,
			registrar_id, registrar_name, current_handler_id, current_handler_name,
			supervisor_id, supervisor_name, manager_id, manager_name,
			expected_complete_at, warning_level, is_overdue, version,
			created_at, updated_at
		FROM work_orders WHERE id = ?
	`, id).Scan(
		&o.ID, &o.OrderNo, &o.AppointmentClue, &o.CustomerName, &o.Phone, &o.LicensePlate,
		&o.CarModel, &o.Mileage, &o.FaultDescription, &o.Status,
		&o.RegistrarID, &o.RegistrarName, &o.CurrentHandlerID, &o.CurrentHandlerName,
		&o.SupervisorID, &o.SupervisorName, &o.ManagerID, &o.ManagerName,
		&o.ExpectedCompleteAt, &o.WarningLevel, &o.IsOverdue, &o.Version,
		&o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return o, nil
}

func getActionName(action string) string {
	names := map[string]string{
		"submit":    "提交审核",
		"approve":   "审核通过",
		"reject":    "退回补正",
		"resubmit":  "重新提交",
		"archive":   "复核归档",
		"send_back": "退回补正",
	}
	if name, ok := names[action]; ok {
		return name
	}
	return action
}

func getEvidenceName(evidenceType string) string {
	names := map[string]string{
		"registration_form":     "工单登记表",
		"vehicle_checklist":     "车辆检测清单",
		"inspection_report":     "检测报告",
		"repair_quote":          "维修报价单",
		"parts_confirmation":    "配件确认单",
		"final_inspection":      "终检报告",
		"delivery_note":         "派修单",
		"customer_confirmation": "客户确认单",
	}
	if name, ok := names[evidenceType]; ok {
		return name
	}
	return evidenceType
}

func (s *WorkOrderService) UploadAttachment(workOrderID int64, file *multipart.FileHeader, evidenceType string, user *models.User) (*models.Attachment, error) {
	var count int
	database.DB.QueryRow("SELECT COUNT(*) FROM work_orders WHERE id = ?", workOrderID).Scan(&count)
	if count == 0 {
		return nil, ErrWorkOrderNotFound
	}

	uploadPath := config.AppConfig.UploadPath
	if err := os.MkdirAll(uploadPath, 0755); err != nil {
		return nil, fmt.Errorf("创建上传目录失败: %w", err)
	}

	subDir := filepath.Join(uploadPath, fmt.Sprintf("order_%d", workOrderID))
	if err := os.MkdirAll(subDir, 0755); err != nil {
		return nil, fmt.Errorf("创建工单目录失败: %w", err)
	}

	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".bin"
	}
	fileName := fmt.Sprintf("%s_%d%s", evidenceType, time.Now().UnixNano(), ext)
	filePath := filepath.Join(subDir, fileName)

	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("打开上传文件失败: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("创建目标文件失败: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return nil, fmt.Errorf("保存文件失败: %w", err)
	}

	relPath := filepath.Join(fmt.Sprintf("order_%d", workOrderID), fileName)

	result, err := database.DB.Exec(`
		INSERT INTO attachments (work_order_id, file_name, file_type, file_size, file_path, uploaded_by, uploader, evidence_type)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, workOrderID, file.Filename, file.Header.Get("Content-Type"), file.Size, relPath, user.ID, user.Name, evidenceType)
	if err != nil {
		os.Remove(filePath)
		return nil, fmt.Errorf("保存附件记录失败: %w", err)
	}

	id, _ := result.LastInsertId()

	_, err = database.DB.Exec(`
		INSERT INTO processing_logs (work_order_id, operator_id, operator, action, from_status, to_status, remark)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, workOrderID, user.ID, user.Name, "上传附件", "", "", fmt.Sprintf("上传证据附件: %s (%s)", getEvidenceName(evidenceType), file.Filename))
	if err != nil {
		return nil, err
	}

	attachment := &models.Attachment{
		ID:           id,
		WorkOrderID:  workOrderID,
		FileName:     file.Filename,
		FileType:     file.Header.Get("Content-Type"),
		FileSize:     file.Size,
		FilePath:     relPath,
		UploadedBy:   user.ID,
		Uploader:     user.Name,
		EvidenceType: evidenceType,
	}
	return attachment, nil
}

func (s *WorkOrderService) GetAttachments(workOrderID int64) ([]models.Attachment, error) {
	rows, err := database.DB.Query(`
		SELECT id, work_order_id, file_name, file_type, file_size, file_path,
			uploaded_by, uploader, evidence_type, created_at
		FROM attachments WHERE work_order_id = ? ORDER BY created_at DESC
	`, workOrderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []models.Attachment
	for rows.Next() {
		a := models.Attachment{}
		rows.Scan(&a.ID, &a.WorkOrderID, &a.FileName, &a.FileType, &a.FileSize,
			&a.FilePath, &a.UploadedBy, &a.Uploader, &a.EvidenceType, &a.CreatedAt)
		attachments = append(attachments, a)
	}
	return attachments, nil
}

func (s *WorkOrderService) GetAttachmentByID(attachmentID int64) (*models.Attachment, error) {
	a := &models.Attachment{}
	err := database.DB.QueryRow(`
		SELECT id, work_order_id, file_name, file_type, file_size, file_path,
			uploaded_by, uploader, evidence_type, created_at
		FROM attachments WHERE id = ?
	`, attachmentID).Scan(&a.ID, &a.WorkOrderID, &a.FileName, &a.FileType, &a.FileSize,
		&a.FilePath, &a.UploadedBy, &a.Uploader, &a.EvidenceType, &a.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("附件不存在")
	}
	if err != nil {
		return nil, err
	}
	return a, nil
}
