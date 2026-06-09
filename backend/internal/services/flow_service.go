package services

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"prescription-flow/internal/db"
	"prescription-flow/internal/models"
)

type FlowService struct{}

func NewFlowService() *FlowService {
	return &FlowService{}
}

func (s *FlowService) GetUsers() ([]models.User, error) {
	rows, err := db.GetDB().Query("SELECT id, username, name, role FROM users ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		err := rows.Scan(&u.ID, &u.Username, &u.Name, &u.Role)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func (s *FlowService) generateFlowNo() string {
	now := time.Now()
	var seq int
	db.GetDB().QueryRow(
		"SELECT COUNT(*) + 1 FROM prescription_flows WHERE strftime('%Y%m%d', created_at) = ?",
		now.Format("20060102"),
	).Scan(&seq)
	return fmt.Sprintf("PF%s%03d", now.Format("20060102"), seq)
}

func (s *FlowService) checkMaterialComplete(prescription, decoction, delivery string) bool {
	return prescription != "" && decoction != "" && delivery != ""
}

func (s *FlowService) calculateUrgency(dueAt time.Time) models.UrgencyLevel {
	now := time.Now()
	diff := dueAt.Sub(now)
	if diff < 0 {
		return models.UrgencyOverdue
	}
	if diff < 6*time.Hour {
		return models.UrgencyWarning
	}
	return models.UrgencyNormal
}

func (s *FlowService) canHandle(role models.Role, status models.PrescriptionStatus) bool {
	switch status {
	case models.StatusDraft, models.StatusReturned:
		return role == models.RoleRegistrar || role == models.RoleAssistant
	case models.StatusToConfirm:
		return role == models.RoleReviewSupervisor || role == models.RolePhysician
	case models.StatusAbnormal:
		return role == models.RoleAssistant || role == models.RoleRegistrar
	case models.StatusProcessing:
		return role == models.RolePhysician || role == models.RoleReviewSupervisor
	case models.StatusRecheck:
		return role == models.RoleArchivist || role == models.RolePharmacist
	}
	return false
}

func (s *FlowService) nextRoleForStatus(status models.PrescriptionStatus) models.Role {
	switch status {
	case models.StatusDraft, models.StatusReturned:
		return models.RoleRegistrar
	case models.StatusToConfirm:
		return models.RoleReviewSupervisor
	case models.StatusProcessing:
		return models.RolePhysician
	case models.StatusRecheck:
		return models.RoleArchivist
	case models.StatusAbnormal:
		return models.RoleAssistant
	}
	return ""
}

func (s *FlowService) CreateFlow(req *models.CreateFlowRequest) (*models.PrescriptionFlow, error) {
	if req.OperatorRole != models.RoleRegistrar && req.OperatorRole != models.RoleAssistant {
		return nil, errors.New("只有处方流转登记员或接诊助理可以发起处方流转单")
	}

	materialComplete := s.checkMaterialComplete(req.PrescriptionInfo, req.DecoctionInfo, req.DeliveryInfo)
	status := models.StatusDraft
	if materialComplete {
		status = models.StatusToConfirm
	} else {
		status = models.StatusAbnormal
	}

	flowNo := s.generateFlowNo()
	now := time.Now()
	dueAt := now.Add(24 * time.Hour)
	urgency := s.calculateUrgency(dueAt)

	var nextHandler string
	var nextRole models.Role
	if status == models.StatusToConfirm {
		nextRole = models.RoleReviewSupervisor
		nextHandler = "supervisor01"
	} else if status == models.StatusAbnormal {
		nextRole = models.RoleAssistant
		nextHandler = "assistant01"
	} else {
		nextRole = req.OperatorRole
		nextHandler = req.Operator
	}

	tx, err := db.GetDB().Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	abnormalReasonText := ""
	if !materialComplete {
		abnormalReasonText = "处方开具、煎药配送信息不齐全"
	}

	result, err := tx.Exec(
		`INSERT INTO prescription_flows 
		(flow_no, patient_name, prescription_info, decoction_info, delivery_info,
		 status, urgency, current_handler, current_role, version, created_by,
		 created_at, updated_at, due_at, is_material_complete, abnormal_reason)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
		flowNo, req.PatientName, req.PrescriptionInfo, req.DecoctionInfo, req.DeliveryInfo,
		status, urgency, nextHandler, nextRole, req.Operator,
		now, now, dueAt,
		map[bool]int{true: 1, false: 0}[materialComplete],
		abnormalReasonText,
	)
	if err != nil {
		return nil, err
	}

	flowID, _ := result.LastInsertId()

	_, err = tx.Exec(
		`INSERT INTO process_records 
		(flow_id, action, operator, operator_role, from_status, to_status, remark, evidence, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		flowID, "create", req.Operator, req.OperatorRole, "", status, "创建处方流转单", "登记发起", now,
	)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(
		`INSERT INTO audit_notes 
		(flow_id, note, operator, created_at)
		VALUES (?, ?, ?, ?)`,
		flowID, fmt.Sprintf("[→%s] 操作人:%s 动作:创建处方流转单", status, req.Operator), req.Operator, now,
	)
	if err != nil {
		return nil, err
	}

	if !materialComplete {
		_, err = tx.Exec(
			`INSERT INTO abnormal_reasons 
			(flow_id, reason, type, operator, created_at)
			VALUES (?, ?, ?, ?, ?)`,
			flowID, abnormalReasonText, "material_missing", req.Operator, now,
		)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetFlowByID(flowID)
}

func (s *FlowService) GetFlowByID(id int64) (*models.PrescriptionFlow, error) {
	var flow models.PrescriptionFlow
	var materialCompleteInt int
	err := db.GetDB().QueryRow(
		`SELECT id, flow_no, patient_name, prescription_info, decoction_info, delivery_info,
		 status, urgency, current_handler, current_role, version, created_by,
		 created_at, updated_at, due_at, abnormal_reason, return_reason, is_material_complete
		 FROM prescription_flows WHERE id = ?`,
		id,
	).Scan(
		&flow.ID, &flow.FlowNo, &flow.PatientName, &flow.PrescriptionInfo,
		&flow.DecoctionInfo, &flow.DeliveryInfo, &flow.Status, &flow.Urgency,
		&flow.CurrentHandler, &flow.CurrentRole, &flow.Version, &flow.CreatedBy,
		&flow.CreatedAt, &flow.UpdatedAt, &flow.DueAt, &flow.AbnormalReason,
		&flow.ReturnReason, &materialCompleteInt,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("处方流转单不存在")
	}
	if err != nil {
		return nil, err
	}
	flow.IsMaterialComplete = materialCompleteInt == 1
	return &flow, nil
}

func (s *FlowService) ListFlows(statusFilter, urgencyFilter, roleFilter, operator string) ([]models.PrescriptionFlow, error) {
	query := `SELECT id, flow_no, patient_name, prescription_info, decoction_info, delivery_info,
		status, urgency, current_handler, current_role, version, created_by,
		created_at, updated_at, due_at, abnormal_reason, return_reason, is_material_complete
		FROM prescription_flows WHERE 1=1`
	args := []interface{}{}

	if statusFilter != "" && statusFilter != "all" {
		query += " AND status = ?"
		args = append(args, statusFilter)
	}
	if urgencyFilter != "" && urgencyFilter != "all" {
		query += " AND urgency = ?"
		args = append(args, urgencyFilter)
	}
	if roleFilter != "" && roleFilter != "all" {
		query += " AND current_role = ?"
		args = append(args, roleFilter)
	}
	if operator != "" && operator != "all" {
		query += " AND current_handler = ?"
		args = append(args, operator)
	}

	query += " ORDER BY CASE urgency WHEN 'overdue' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC"

	rows, err := db.GetDB().Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var flows []models.PrescriptionFlow
	for rows.Next() {
		var f models.PrescriptionFlow
		var matInt int
		err := rows.Scan(
			&f.ID, &f.FlowNo, &f.PatientName, &f.PrescriptionInfo,
			&f.DecoctionInfo, &f.DeliveryInfo, &f.Status, &f.Urgency,
			&f.CurrentHandler, &f.CurrentRole, &f.Version, &f.CreatedBy,
			&f.CreatedAt, &f.UpdatedAt, &f.DueAt, &f.AbnormalReason,
			&f.ReturnReason, &matInt,
		)
		if err != nil {
			return nil, err
		}
		f.IsMaterialComplete = matInt == 1
		f.Urgency = s.calculateUrgency(f.DueAt)
		flows = append(flows, f)
	}
	return flows, nil
}

func (s *FlowService) GetProcessRecords(flowID int64) ([]models.ProcessRecord, error) {
	rows, err := db.GetDB().Query(
		`SELECT id, flow_id, action, operator, operator_role, from_status, to_status, remark, evidence, created_at
		 FROM process_records WHERE flow_id = ? ORDER BY id DESC`,
		flowID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.ProcessRecord
	for rows.Next() {
		var r models.ProcessRecord
		err := rows.Scan(
			&r.ID, &r.FlowID, &r.Action, &r.Operator, &r.OperatorRole,
			&r.FromStatus, &r.ToStatus, &r.Remark, &r.Evidence, &r.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	return records, nil
}

func (s *FlowService) GetAbnormalReasons(flowID int64) ([]models.AbnormalReason, error) {
	rows, err := db.GetDB().Query(
		`SELECT id, flow_id, reason, type, operator, created_at
		 FROM abnormal_reasons WHERE flow_id = ? ORDER BY id DESC`,
		flowID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reasons []models.AbnormalReason
	for rows.Next() {
		var r models.AbnormalReason
		err := rows.Scan(&r.ID, &r.FlowID, &r.Reason, &r.Type, &r.Operator, &r.CreatedAt)
		if err != nil {
			return nil, err
		}
		reasons = append(reasons, r)
	}
	return reasons, nil
}

func (s *FlowService) GetAuditNotes(flowID int64) ([]models.AuditNote, error) {
	rows, err := db.GetDB().Query(
		`SELECT id, flow_id, note, operator, created_at
		 FROM audit_notes WHERE flow_id = ? ORDER BY id DESC`,
		flowID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []models.AuditNote
	for rows.Next() {
		var n models.AuditNote
		err := rows.Scan(&n.ID, &n.FlowID, &n.Note, &n.Operator, &n.CreatedAt)
		if err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, nil
}

func (s *FlowService) validateRequest(flow *models.PrescriptionFlow, req *models.ProcessFlowRequest) error {
	if flow.Version != req.Version {
		return fmt.Errorf("版本冲突：当前版本为 %d，您提交的是 %d，请刷新后重试", flow.Version, req.Version)
	}

	if flow.Status == models.StatusArchived || flow.Status == models.StatusCompleted {
		return fmt.Errorf("该处方流转单已%s，无法再进行操作", STATUS_LABEL_CN[flow.Status])
	}

	if !s.canHandle(req.OperatorRole, flow.Status) {
		return fmt.Errorf("越权操作：当前状态 [%s] 不允许角色 [%s] 处理", STATUS_LABEL_CN[flow.Status], ROLE_LABEL_CN[req.OperatorRole])
	}

	if flow.CurrentHandler != req.Operator && flow.CurrentHandler != "" {
		return fmt.Errorf("越权操作：该单据当前处理人是 [%s]，您 [%s] 无权处理", flow.CurrentHandler, req.Operator)
	}

	if flow.Urgency == models.UrgencyOverdue {
		if req.Action != "resubmit" && req.Action != "correct" && req.Action != "return" && req.Action != "supplement" {
			return errors.New("该单据已逾期，仅能执行补正或退回操作")
		}
	}

	allowedActions := s.getAllowedActions(flow.Status)
	found := false
	for _, a := range allowedActions {
		if a == req.Action {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("当前状态 [%s] 不允许执行动作 [%s]", STATUS_LABEL_CN[flow.Status], req.Action)
	}

	switch req.Action {
	case "submit", "resubmit":
		if req.Evidence == "" {
			return errors.New("提交操作必须上传证据材料")
		}
	case "approve", "process", "archive", "complete":
		if req.Evidence == "" {
			return errors.New("审批/办理/归档操作必须提供办理依据")
		}
	case "return":
		if req.ReturnReason == "" {
			return errors.New("退回操作必须填写退回原因")
		}
		if req.Evidence == "" {
			return errors.New("退回操作必须提供证据")
		}
	case "correct", "supplement":
		if req.Evidence == "" {
			return errors.New("补正资料操作必须提供补正证据")
		}
		prescription := req.PrescriptionInfo
		if prescription == "" {
			prescription = flow.PrescriptionInfo
		}
		decoction := req.DecoctionInfo
		if decoction == "" {
			decoction = flow.DecoctionInfo
		}
		delivery := req.DeliveryInfo
		if delivery == "" {
			delivery = flow.DeliveryInfo
		}
		if !s.checkMaterialComplete(prescription, decoction, delivery) {
			return errors.New("资料仍不齐全，处方开具、煎药配送信息必须全部填写")
		}
	}

	return nil
}

func (s *FlowService) getAllowedActions(status models.PrescriptionStatus) []string {
	switch status {
	case models.StatusDraft:
		return []string{"submit"}
	case models.StatusReturned:
		return []string{"resubmit", "correct", "supplement"}
	case models.StatusAbnormal:
		return []string{"correct", "supplement", "submit"}
	case models.StatusToConfirm:
		return []string{"approve", "return"}
	case models.StatusProcessing:
		return []string{"process", "return"}
	case models.StatusRecheck:
		return []string{"archive", "complete", "return"}
	default:
		return []string{}
	}
}

var STATUS_LABEL_CN = map[models.PrescriptionStatus]string{
	models.StatusDraft:      "草稿",
	models.StatusPending:    "待处理",
	models.StatusToConfirm:  "待确认",
	models.StatusAbnormal:   "异常",
	models.StatusProcessing: "办理中",
	models.StatusRecheck:    "待复查",
	models.StatusReturned:   "已退回",
	models.StatusCompleted:  "已完成",
	models.StatusArchived:   "已归档",
}

var ROLE_LABEL_CN = map[models.Role]string{
	models.RoleRegistrar:        "处方流转登记员",
	models.RoleReviewSupervisor: "处方流转审核主管",
	models.RoleArchivist:        "中医馆复核负责人",
	models.RoleAssistant:        "接诊助理",
	models.RolePhysician:        "坐诊医师",
	models.RolePharmacist:       "药房管理员",
}

func (s *FlowService) ProcessFlow(req *models.ProcessFlowRequest) (*models.PrescriptionFlow, error) {
	flow, err := s.GetFlowByID(req.FlowID)
	if err != nil {
		return nil, err
	}

	if err := s.validateRequest(flow, req); err != nil {
		return nil, err
	}

	tx, err := db.GetDB().Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	fromStatus := flow.Status
	toStatus := flow.Status
	nextHandler := flow.CurrentHandler
	nextRole := flow.CurrentRole
	abnormalReason := flow.AbnormalReason
	returnReason := flow.ReturnReason
	dueAt := flow.DueAt

	prescription := flow.PrescriptionInfo
	if req.PrescriptionInfo != "" {
		prescription = req.PrescriptionInfo
	}
	decoction := flow.DecoctionInfo
	if req.DecoctionInfo != "" {
		decoction = req.DecoctionInfo
	}
	delivery := flow.DeliveryInfo
	if req.DeliveryInfo != "" {
		delivery = req.DeliveryInfo
	}

	materialComplete := s.checkMaterialComplete(prescription, decoction, delivery)

	switch req.Action {
	case "submit":
		if !materialComplete {
			toStatus = models.StatusAbnormal
			nextRole = models.RoleAssistant
			nextHandler = "assistant01"
			abnormalReason = "处方开具、煎药配送信息不齐全"
		} else {
			toStatus = models.StatusToConfirm
			nextRole = models.RoleReviewSupervisor
			nextHandler = "supervisor01"
			abnormalReason = ""
		}
	case "resubmit":
		if !materialComplete {
			toStatus = models.StatusAbnormal
			nextRole = models.RoleAssistant
			nextHandler = "assistant01"
			abnormalReason = "处方开具、煎药配送信息不齐全"
		} else {
			toStatus = models.StatusToConfirm
			nextRole = models.RoleReviewSupervisor
			nextHandler = "supervisor01"
			abnormalReason = ""
			returnReason = ""
			dueAt = time.Now().Add(24 * time.Hour)
		}
	case "approve":
		toStatus = models.StatusProcessing
		nextRole = models.RolePhysician
		nextHandler = "physician01"
		abnormalReason = ""
	case "process":
		toStatus = models.StatusRecheck
		nextRole = models.RoleArchivist
		nextHandler = "archivist01"
		abnormalReason = ""
	case "return":
		toStatus = models.StatusReturned
		nextRole = models.RoleRegistrar
		nextHandler = "registrar01"
		returnReason = req.ReturnReason
	case "correct", "supplement":
		toStatus = models.StatusToConfirm
		nextRole = models.RoleReviewSupervisor
		nextHandler = "supervisor01"
		abnormalReason = ""
		dueAt = time.Now().Add(24 * time.Hour)
	case "archive", "complete":
		toStatus = models.StatusArchived
		nextHandler = ""
		nextRole = ""
		abnormalReason = ""
	}

	urgency := s.calculateUrgency(dueAt)
	now := time.Now()

	remarkVal := req.Remark
	if remarkVal == "" {
		remarkVal = "无备注"
	}
	evidenceVal := req.Evidence
	if evidenceVal == "" {
		evidenceVal = "未提供"
	}

	auditNote := fmt.Sprintf("[%s→%s] 操作人:%s 动作:%s",
		fromStatus, toStatus, req.Operator, req.Action)
	if req.Remark != "" {
		auditNote += " 备注:" + req.Remark
	}
	if req.Evidence != "" {
		auditNote += " 证据:" + req.Evidence
	}

	_, err = tx.Exec(
		`UPDATE prescription_flows SET 
		 prescription_info = ?, decoction_info = ?, delivery_info = ?,
		 status = ?, urgency = ?, current_handler = ?, current_role = ?,
		 version = version + 1, updated_at = ?, due_at = ?,
		 abnormal_reason = ?, return_reason = ?, is_material_complete = ?
		 WHERE id = ? AND version = ?`,
		prescription, decoction, delivery,
		toStatus, urgency, nextHandler, nextRole,
		now, dueAt,
		abnormalReason, returnReason,
		func() int {
			if materialComplete {
				return 1
			}
			return 0
		}(),
		flow.ID, flow.Version,
	)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(
		`INSERT INTO process_records 
		(flow_id, action, operator, operator_role, from_status, to_status, remark, evidence, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		flow.ID, req.Action, req.Operator, req.OperatorRole,
		fromStatus, toStatus, remarkVal, evidenceVal, now,
	)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(
		`INSERT INTO audit_notes 
		(flow_id, note, operator, created_at)
		VALUES (?, ?, ?, ?)`,
		flow.ID, auditNote, req.Operator, now,
	)
	if err != nil {
		return nil, err
	}

	if toStatus == models.StatusAbnormal && abnormalReason != "" {
		_, err = tx.Exec(
			`INSERT INTO abnormal_reasons 
			(flow_id, reason, type, operator, created_at)
			VALUES (?, ?, ?, ?, ?)`,
			flow.ID, abnormalReason, "material_missing", req.Operator, now,
		)
		if err != nil {
			return nil, err
		}
	}

	if req.Action == "return" {
		_, err = tx.Exec(
			`INSERT INTO abnormal_reasons 
			(flow_id, reason, type, operator, created_at)
			VALUES (?, ?, ?, ?, ?)`,
			flow.ID, req.ReturnReason, "returned", req.Operator, now,
		)
		if err != nil {
			return nil, err
		}
	}

	if (req.Action == "correct" || req.Action == "supplement") && flow.AbnormalReason != "" {
		_, err = tx.Exec(
			`INSERT INTO abnormal_reasons 
			(flow_id, reason, type, operator, created_at)
			VALUES (?, ?, ?, ?, ?)`,
			flow.ID, "已补正资料："+flow.AbnormalReason, "corrected", req.Operator, now,
		)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetFlowByID(flow.ID)
}

func (s *FlowService) BatchProcess(req *models.BatchProcessRequest) ([]models.BatchResult, error) {
	var results []models.BatchResult

	for _, flowID := range req.FlowIDs {
		flow, err := s.GetFlowByID(flowID)
		if err != nil {
			results = append(results, models.BatchResult{
				FlowID:  flowID,
				Success: false,
				Message: err.Error(),
			})
			continue
		}

		processReq := &models.ProcessFlowRequest{
			FlowID:       flowID,
			Action:       req.Action,
			Operator:     req.Operator,
			OperatorRole: req.OperatorRole,
			Remark:       req.Remark,
			Evidence:     req.Evidence,
			Version:      flow.Version,
		}

		_, err = s.ProcessFlow(processReq)
		if err != nil {
			results = append(results, models.BatchResult{
				FlowID:  flowID,
				FlowNo:  flow.FlowNo,
				Success: false,
				Message: err.Error(),
			})
		} else {
			updatedFlow, _ := s.GetFlowByID(flowID)
			results = append(results, models.BatchResult{
				FlowID:  flowID,
				FlowNo:  flow.FlowNo,
				Success: true,
				Message: "处理成功，当前状态：" + string(updatedFlow.Status),
			})
		}
	}

	return results, nil
}

func (s *FlowService) GetStatistics() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	groups := []struct {
		key    string
		status string
	}{
		{"to_confirm", "to_confirm"},
		{"abnormal", "abnormal"},
		{"recheck", "recheck"},
	}

	for _, g := range groups {
		var count int
		db.GetDB().QueryRow(
			"SELECT COUNT(*) FROM prescription_flows WHERE status = ?", g.status,
		).Scan(&count)
		stats[g.key] = count
	}

	urgencyGroups := []struct {
		key     string
		urgency string
	}{
		{"normal", "normal"},
		{"warning", "warning"},
		{"overdue", "overdue"},
	}

	urgencyStats := make(map[string]int)
	for _, g := range urgencyGroups {
		var count int
		db.GetDB().QueryRow(
			"SELECT COUNT(*) FROM prescription_flows WHERE urgency = ?", g.urgency,
		).Scan(&count)
		urgencyStats[g.key] = count
	}
	stats["urgency"] = urgencyStats

	var total int
	db.GetDB().QueryRow("SELECT COUNT(*) FROM prescription_flows").Scan(&total)
	stats["total"] = total

	return stats, nil
}
