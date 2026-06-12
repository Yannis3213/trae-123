package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
	"trademark-system/internal/database"
	"trademark-system/internal/models"

	"github.com/go-chi/chi/v5"
)

type ApplicationHandler struct {
	db *sql.DB
}

func NewApplicationHandler(db *sql.DB) *ApplicationHandler {
	return &ApplicationHandler{db: db}
}

func (h *ApplicationHandler) List(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUserFromContext(r)

	page := getIntParam(r, "page", 1)
	pageSize := getIntParam(r, "page_size", 10)
	keyword := r.URL.Query().Get("keyword")
	status := r.URL.Query().Get("status")
	module := r.URL.Query().Get("module")
	warning := r.URL.Query().Get("warning")

	offset := (page - 1) * pageSize

	whereClauses := []string{"1=1"}
	args := []interface{}{}

	if keyword != "" {
		whereClauses = append(whereClauses, "(application_no LIKE ? OR trademark_name LIKE ? OR applicant_name LIKE ?)")
		kw := "%" + keyword + "%"
		args = append(args, kw, kw, kw)
	}

	if status != "" {
		whereClauses = append(whereClauses, "status = ?")
		args = append(args, status)
	}

	if warning != "" {
		whereClauses = append(whereClauses, "warning_status = ?")
		args = append(args, warning)
	}

	if module == "correction" {
		whereClauses = append(whereClauses, "status IN (?, ?)")
		args = append(args, string(models.StatusCorrection), string(models.StatusReturned))
	} else if module == "notification" {
		whereClauses = append(whereClauses, "status IN (?, ?, ?)")
		args = append(args, string(models.StatusTransferred), string(models.StatusVisited), string(models.StatusArchived))
	}

	if user.Role == models.RoleRegistrar {
		whereClauses = append(whereClauses, "current_handler IN (?, '')")
		args = append(args, string(models.RoleRegistrar))
	} else if user.Role == models.RoleAgent {
		whereClauses = append(whereClauses, "current_handler IN (?, '')")
		args = append(args, string(models.RoleAgent))
	} else if user.Role == models.RoleDirector {
		whereClauses = append(whereClauses, "current_handler IN (?, '')")
		args = append(args, string(models.RoleDirector))
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	var total int64
	countSQL := "SELECT COUNT(*) FROM trademark_applications WHERE " + whereSQL
	if err := h.db.QueryRow(countSQL, args...).Scan(&total); err != nil {
		respondError(w, http.StatusInternalServerError, "查询总数失败")
		return
	}

	listSQL := `
		SELECT id, application_no, trademark_name, applicant_name, applicant_contact,
			category, status, current_handler, created_by, created_at, updated_at,
			due_date, warning_status, last_opinion, last_handler_name, last_handle_time,
			version, material_complete, evidence_complete, current_node, node_due_date,
			node_overdue, node_responsible
		FROM trademark_applications
		WHERE ` + whereSQL + `
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`
	args = append(args, pageSize, offset)

	rows, err := h.db.Query(listSQL, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询列表失败")
		return
	}
	defer rows.Close()

	applications := []*models.TrademarkApplication{}
	for rows.Next() {
		app := &models.TrademarkApplication{}
		var createdAt, updatedAt, dueDate *time.Time
		var nodeDueDate, lastHandleTime *time.Time
		var nodeOverdue, materialComplete, evidenceComplete int
		var currentHandler, lastHandlerName, lastOpinion sql.NullString

		err := rows.Scan(
			&app.ID, &app.ApplicationNo, &app.TrademarkName, &app.ApplicantName, &app.ApplicantContact,
			&app.Category, &app.Status, &currentHandler, &app.CreatedBy, &createdAt, &updatedAt,
			&dueDate, &app.WarningStatus, &lastOpinion, &lastHandlerName, &lastHandleTime,
			&app.Version, &materialComplete, &evidenceComplete, &app.CurrentNode, &nodeDueDate,
			&nodeOverdue, &app.NodeResponsible,
		)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "解析数据失败")
			return
		}

		app.StatusName = database.GetStatusName(string(app.Status))
		app.CurrentHandler = currentHandler.String
		app.CurrentHandlerName = database.GetRoleName(currentHandler.String)
		app.CreatedByName = database.GetRoleName(app.CreatedBy)
		app.MaterialComplete = materialComplete == 1
		app.EvidenceComplete = evidenceComplete == 1
		app.NodeOverdue = nodeOverdue == 1
		app.LastOpinion = lastOpinion.String
		app.LastHandlerName = lastHandlerName.String

		if createdAt != nil {
			app.CreatedAt = *createdAt
		}
		if updatedAt != nil {
			app.UpdatedAt = *updatedAt
		}
		if dueDate != nil {
			app.DueDate = *dueDate
		}
		if nodeDueDate != nil {
			app.NodeDueDate = nodeDueDate
		}
		if lastHandleTime != nil {
			app.LastHandleTime = lastHandleTime
		}

		_, app.WarningText = database.CalculateWarning(app.DueDate)

		applications = append(applications, app)
	}

	respondSuccess(w, models.PaginationResponse{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		List:     applications,
	})
}

func (h *ApplicationHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	appSQL := `
		SELECT id, application_no, trademark_name, applicant_name, applicant_contact,
			category, status, current_handler, created_by, created_at, updated_at,
			due_date, warning_status, last_opinion, last_handler_name, last_handle_time,
			version, material_complete, evidence_complete, current_node, node_due_date,
			node_overdue, node_responsible
		FROM trademark_applications WHERE id = ?
	`

	app := &models.TrademarkApplication{}
	var createdAt, updatedAt, dueDate *time.Time
	var nodeDueDate, lastHandleTime *time.Time
	var nodeOverdue, materialComplete, evidenceComplete int
	var currentHandler, lastHandlerName, lastOpinion sql.NullString

	err := h.db.QueryRow(appSQL, id).Scan(
		&app.ID, &app.ApplicationNo, &app.TrademarkName, &app.ApplicantName, &app.ApplicantContact,
		&app.Category, &app.Status, &currentHandler, &app.CreatedBy, &createdAt, &updatedAt,
		&dueDate, &app.WarningStatus, &lastOpinion, &lastHandlerName, &lastHandleTime,
		&app.Version, &materialComplete, &evidenceComplete, &app.CurrentNode, &nodeDueDate,
		&nodeOverdue, &app.NodeResponsible,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			respondError(w, http.StatusNotFound, "商标申请单不存在")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询详情失败")
		return
	}

	app.StatusName = database.GetStatusName(string(app.Status))
	app.CurrentHandler = currentHandler.String
	app.CurrentHandlerName = database.GetRoleName(currentHandler.String)
	app.CreatedByName = database.GetRoleName(app.CreatedBy)
	app.MaterialComplete = materialComplete == 1
	app.EvidenceComplete = evidenceComplete == 1
	app.NodeOverdue = nodeOverdue == 1
	app.LastOpinion = lastOpinion.String
	app.LastHandlerName = lastHandlerName.String

	if createdAt != nil {
		app.CreatedAt = *createdAt
	}
	if updatedAt != nil {
		app.UpdatedAt = *updatedAt
	}
	if dueDate != nil {
		app.DueDate = *dueDate
	}
	if nodeDueDate != nil {
		app.NodeDueDate = nodeDueDate
	}
	if lastHandleTime != nil {
		app.LastHandleTime = lastHandleTime
	}

	_, app.WarningText = database.CalculateWarning(app.DueDate)

	attachSQL := `
		SELECT id, file_name, file_type, file_size, module_type, uploaded_by, uploaded_at, evidence_type
		FROM attachments WHERE application_id = ? ORDER BY uploaded_at DESC
	`
	attachRows, err := h.db.Query(attachSQL, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询附件失败")
		return
	}
	defer attachRows.Close()

	attachments := []*models.Attachment{}
	for attachRows.Next() {
		att := &models.Attachment{}
		var uploadedAt *time.Time
		err := attachRows.Scan(
			&att.ID, &att.FileName, &att.FileType, &att.FileSize,
			&att.ModuleType, &att.UploadedBy, &uploadedAt, &att.EvidenceType,
		)
		if err == nil {
			att.ApplicationID = id
			att.UploadedByName = database.GetRoleName(att.UploadedBy)
			if uploadedAt != nil {
				att.UploadedAt = *uploadedAt
			}
			attachments = append(attachments, att)
		}
	}

	exceptionSQL := `
		SELECT id, reason, reason_type, created_by, created_at, module_type, resolved, resolved_at,
			material_complete, evidence_complete, opinion, summary
		FROM exception_reasons WHERE application_id = ? ORDER BY created_at DESC
	`
	excRows, err := h.db.Query(exceptionSQL, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询异常原因失败")
		return
	}
	defer excRows.Close()

	exceptions := []*models.ExceptionReason{}
	for excRows.Next() {
		exc := &models.ExceptionReason{}
		var createdAt, resolvedAt *time.Time
		var resolved int
		var materialComplete, evidenceComplete sql.NullInt64
		var opinion, summary sql.NullString
		err := excRows.Scan(
			&exc.ID, &exc.Reason, &exc.ReasonType, &exc.CreatedBy, &createdAt,
			&exc.ModuleType, &resolved, &resolvedAt,
			&materialComplete, &evidenceComplete, &opinion, &summary,
		)
		if err == nil {
			exc.ApplicationID = id
			exc.CreatedByName = database.GetRoleName(exc.CreatedBy)
			if createdAt != nil {
				exc.CreatedAt = *createdAt
			}
			exc.Resolved = resolved == 1
			if resolvedAt != nil {
				exc.ResolvedAt = resolvedAt
			}
			if materialComplete.Valid {
				b := materialComplete.Int64 == 1
				exc.MaterialComplete = &b
			}
			if evidenceComplete.Valid {
				b := evidenceComplete.Int64 == 1
				exc.EvidenceComplete = &b
			}
			if opinion.Valid {
				exc.Opinion = opinion.String
			}
			if summary.Valid {
				exc.Summary = summary.String
			}
			exceptions = append(exceptions, exc)
		}
	}

	remarkSQL := `
		SELECT id, content, created_by, created_at
		FROM audit_remarks WHERE application_id = ? ORDER BY created_at DESC
	`
	remarkRows, err := h.db.Query(remarkSQL, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询审计备注失败")
		return
	}
	defer remarkRows.Close()

	auditRemarks := []*models.AuditRemark{}
	for remarkRows.Next() {
		remark := &models.AuditRemark{}
		var createdAt *time.Time
		err := remarkRows.Scan(&remark.ID, &remark.Content, &remark.CreatedBy, &createdAt)
		if err == nil {
			remark.ApplicationID = id
			remark.CreatedByName = database.GetRoleName(remark.CreatedBy)
			if createdAt != nil {
				remark.CreatedAt = *createdAt
			}
			auditRemarks = append(auditRemarks, remark)
		}
	}

	respondSuccess(w, map[string]interface{}{
		"application":    app,
		"attachments":    attachments,
		"exceptions":     exceptions,
		"audit_remarks":  auditRemarks,
	})
}

func (h *ApplicationHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUserFromContext(r)

	if user.Role != models.RoleRegistrar {
		respondError(w, http.StatusForbidden, "只有商标申请登记员可以创建申请单")
		return
	}

	var req models.CreateApplicationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	if req.ApplicationNo == "" || req.TrademarkName == "" || req.ApplicantName == "" {
		respondError(w, http.StatusBadRequest, "申请号、商标名称、申请人名称为必填项")
		return
	}

	var existing int
	h.db.QueryRow("SELECT COUNT(*) FROM trademark_applications WHERE application_no = ?", req.ApplicationNo).Scan(&existing)
	if existing > 0 {
		respondError(w, http.StatusBadRequest, "申请号已存在")
		return
	}

	id := generateID()
	now := time.Now()
	dueDate := now.AddDate(0, 0, 15)
	warningStatus, warningText := database.CalculateWarning(dueDate)

	tx, err := h.db.Begin()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO trademark_applications (
			id, application_no, trademark_name, applicant_name, applicant_contact,
			category, status, current_handler, created_by, created_at, updated_at,
			due_date, warning_status, warning_text, version, material_complete,
			evidence_complete, current_node, node_due_date, node_responsible
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		id, req.ApplicationNo, req.TrademarkName, req.ApplicantName, req.ApplicantContact,
		req.Category, string(models.StatusPendingAssign), string(models.RoleRegistrar), user.ID, now, now,
		dueDate, warningStatus, warningText, 1, req.MaterialComplete,
		false, "待分派", dueDate, "商标申请登记员",
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建申请单失败")
		return
	}

	recordID := generateID()
	_, err = tx.Exec(`
		INSERT INTO processing_records (
			id, application_id, action, old_status, new_status,
			handler, opinion, created_at, module_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		recordID, id, "create", "", string(models.StatusPendingAssign),
		user.ID, "创建商标申请单", now, string(models.ModuleApplication),
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建处理记录失败")
		return
	}

	if !req.MaterialComplete {
		excID := generateID()
		_, err = tx.Exec(`
			INSERT INTO exception_reasons (
				id, application_id, reason, reason_type, created_by,
				created_at, module_type, resolved
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`,
			excID, id, "创建时材料不完整", "material_missing", user.ID,
			now, string(models.ModuleApplication), false,
		)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "创建异常记录失败")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	respondSuccess(w, map[string]interface{}{
		"id":      id,
		"version": 1,
	})
}

func (h *ApplicationHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetCurrentUserFromContext(r)

	var req models.UpdateApplicationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	var currentStatus, currentHandler string
	var currentVersion int
	err := h.db.QueryRow(`
		SELECT status, current_handler, version FROM trademark_applications WHERE id = ?
	`, id).Scan(&currentStatus, &currentHandler, &currentVersion)
	if err != nil {
		respondError(w, http.StatusNotFound, "申请单不存在")
		return
	}

	if currentHandler != string(user.Role) && currentHandler != "" {
		respondError(w, http.StatusForbidden, "您不是当前处理人，无法修改")
		return
	}

	if currentStatus != string(models.StatusPendingAssign) &&
		currentStatus != string(models.StatusCorrection) &&
		currentStatus != string(models.StatusReturned) {
		respondError(w, http.StatusBadRequest, "当前状态不允许修改基本信息")
		return
	}

	now := time.Now()
	_, err = h.db.Exec(`
		UPDATE trademark_applications SET
			trademark_name = ?, applicant_name = ?, applicant_contact = ?,
			category = ?, material_complete = ?, updated_at = ?, version = ?
		WHERE id = ?
	`,
		req.TrademarkName, req.ApplicantName, req.ApplicantContact,
		req.Category, req.MaterialComplete, now, currentVersion+1, id,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新失败")
		return
	}

	insertProcessingRecord(h.db, id, "update", currentStatus, currentStatus, user.ID, "修改申请单基本信息", string(models.ModuleApplication))

	respondSuccess(w, map[string]interface{}{
		"id":      id,
		"version": currentVersion + 1,
	})
}

func (h *ApplicationHandler) Assign(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetCurrentUserFromContext(r)

	if user.Role != models.RoleRegistrar {
		respondError(w, http.StatusForbidden, "只有商标申请登记员可以分派")
		return
	}

	var req models.ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	var currentStatus, currentHandler string
	var version int
	var materialComplete bool
	err := h.db.QueryRow(`
		SELECT status, current_handler, version, material_complete 
		FROM trademark_applications WHERE id = ?
	`, id).Scan(&currentStatus, &currentHandler, &version, &materialComplete)
	if err != nil {
		respondError(w, http.StatusNotFound, "申请单不存在")
		return
	}

	if currentHandler != string(user.Role) {
		respondError(w, http.StatusForbidden, "您不是当前处理人")
		return
	}

	if currentStatus != string(models.StatusPendingAssign) &&
		currentStatus != string(models.StatusCorrection) &&
		currentStatus != string(models.StatusReturned) {
		respondError(w, http.StatusBadRequest, "当前状态不允许分派")
		return
	}

	if currentStatus == string(models.StatusReturned) {
		if !materialComplete {
			respondError(w, http.StatusBadRequest, "退回重新提交需要商标申请材料完整")
			return
		}
	}

	newStatus := string(models.StatusTransferred)
	newHandler := string(models.RoleAgent)
	nodeName, nodeResponsible := getNodeInfo(newStatus)
	now := time.Now()
	nodeDueDate := now.AddDate(0, 0, 10)

	tx, err := h.db.Begin()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	opinion := req.Opinion
	if opinion == "" {
		opinion = "材料齐全，分派代理人处理"
	}

	_, err = tx.Exec(`
		UPDATE trademark_applications SET
			status = ?, current_handler = ?, updated_at = ?, version = ?,
			last_opinion = ?, last_handler_name = ?, last_handle_time = ?,
			current_node = ?, node_due_date = ?, node_responsible = ?
		WHERE id = ?
	`,
		newStatus, newHandler, now, version+1,
		opinion, user.Name, now,
		nodeName, nodeDueDate, nodeResponsible, id,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新状态失败")
		return
	}

	recordID := generateID()
	_, err = tx.Exec(`
		INSERT INTO processing_records (
			id, application_id, action, old_status, new_status,
			handler, opinion, created_at, module_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		recordID, id, "assign", currentStatus, newStatus,
		user.ID, opinion, now, string(models.ModuleApplication),
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建处理记录失败")
		return
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	updateWarningStatus(h.db, id, nodeDueDate.Format("2006-01-02 15:04:05"))

	respondSuccess(w, map[string]interface{}{
		"id":      id,
		"status":  newStatus,
		"version": version + 1,
	})
}

func (h *ApplicationHandler) Transfer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetCurrentUserFromContext(r)

	if user.Role != models.RoleAgent {
		respondError(w, http.StatusForbidden, "只有商标申请审核主管可以转办")
		return
	}

	var req models.ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	var currentStatus, currentHandler string
	var version int
	err := h.db.QueryRow(`
		SELECT status, current_handler, version FROM trademark_applications WHERE id = ?
	`, id).Scan(&currentStatus, &currentHandler, &version)
	if err != nil {
		respondError(w, http.StatusNotFound, "申请单不存在")
		return
	}

	if currentHandler != string(user.Role) {
		respondError(w, http.StatusForbidden, "您不是当前处理人")
		return
	}

	if currentStatus != string(models.StatusTransferred) {
		respondError(w, http.StatusBadRequest, "当前状态不允许转办操作，应为已转办状态")
		return
	}

	newStatus := string(models.StatusTransferred)
	now := time.Now()

	tx, err := h.db.Begin()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	opinion := req.Opinion
	if opinion == "" {
		opinion = "已转办处理"
	}

	_, err = tx.Exec(`
		UPDATE trademark_applications SET
			updated_at = ?, version = ?,
			last_opinion = ?, last_handler_name = ?, last_handle_time = ?
		WHERE id = ?
	`,
		now, version+1, opinion, user.Name, now, id,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新失败")
		return
	}

	recordID := generateID()
	_, err = tx.Exec(`
		INSERT INTO processing_records (
			id, application_id, action, old_status, new_status,
			handler, opinion, created_at, module_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		recordID, id, "transfer", currentStatus, newStatus,
		user.ID, opinion, now, string(models.ModuleApplication),
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建处理记录失败")
		return
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	respondSuccess(w, map[string]interface{}{
		"id":      id,
		"version": version + 1,
	})
}

func (h *ApplicationHandler) Visit(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetCurrentUserFromContext(r)

	if user.Role != models.RoleAgent {
		respondError(w, http.StatusForbidden, "只有商标申请审核主管可以回访")
		return
	}

	var req models.ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	var currentStatus, currentHandler string
	var version int
	var evidenceComplete bool
	err := h.db.QueryRow(`
		SELECT status, current_handler, version, evidence_complete 
		FROM trademark_applications WHERE id = ?
	`, id).Scan(&currentStatus, &currentHandler, &version, &evidenceComplete)
	if err != nil {
		respondError(w, http.StatusNotFound, "申请单不存在")
		return
	}

	if currentHandler != string(user.Role) {
		respondError(w, http.StatusForbidden, "您不是当前处理人")
		return
	}

	if currentStatus != string(models.StatusTransferred) {
		respondError(w, http.StatusBadRequest, "当前状态不允许回访操作，应为已转办状态")
		return
	}

	if req.EvidenceComplete != nil && !*req.EvidenceComplete && !evidenceComplete {
		respondError(w, http.StatusBadRequest, "递交通知需要证据完整，请先上传递交通知回执")
		return
	}

	if req.EvidenceComplete != nil {
		evidenceComplete = *req.EvidenceComplete
	}

	if !evidenceComplete {
		respondError(w, http.StatusBadRequest, "递交通知需要证据完整，请先上传递交通知回执")
		return
	}

	newStatus := string(models.StatusVisited)
	newHandler := string(models.RoleDirector)
	nodeName, nodeResponsible := getNodeInfo(newStatus)
	now := time.Now()
	nodeDueDate := now.AddDate(0, 0, 5)

	tx, err := h.db.Begin()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	opinion := req.Opinion
	if opinion == "" {
		opinion = "已完成回访，材料齐全，请复核归档"
	}

	_, err = tx.Exec(`
		UPDATE trademark_applications SET
			status = ?, current_handler = ?, updated_at = ?, version = ?,
			last_opinion = ?, last_handler_name = ?, last_handle_time = ?,
			current_node = ?, node_due_date = ?, node_responsible = ?,
			evidence_complete = ?
		WHERE id = ?
	`,
		newStatus, newHandler, now, version+1,
		opinion, user.Name, now,
		nodeName, nodeDueDate, nodeResponsible,
		evidenceComplete, id,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新状态失败")
		return
	}

	recordID := generateID()
	_, err = tx.Exec(`
		INSERT INTO processing_records (
			id, application_id, action, old_status, new_status,
			handler, opinion, created_at, module_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		recordID, id, "visit", currentStatus, newStatus,
		user.ID, opinion, now, string(models.ModuleNotification),
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建处理记录失败")
		return
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	updateWarningStatus(h.db, id, nodeDueDate.Format("2006-01-02 15:04:05"))

	respondSuccess(w, map[string]interface{}{
		"id":      id,
		"status":  newStatus,
		"version": version + 1,
	})
}

func (h *ApplicationHandler) Correct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetCurrentUserFromContext(r)

	if user.Role != models.RoleRegistrar {
		respondError(w, http.StatusForbidden, "只有商标申请登记员可以补正")
		return
	}

	var req models.CorrectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	var currentStatus, currentHandler string
	var version int
	err := h.db.QueryRow(`
		SELECT status, current_handler, version FROM trademark_applications WHERE id = ?
	`, id).Scan(&currentStatus, &currentHandler, &version)
	if err != nil {
		respondError(w, http.StatusNotFound, "申请单不存在")
		return
	}

	if currentHandler != string(user.Role) {
		respondError(w, http.StatusForbidden, "您不是当前处理人")
		return
	}

	if currentStatus != string(models.StatusCorrection) && currentStatus != string(models.StatusReturned) {
		respondError(w, http.StatusBadRequest, "当前状态不允许补正操作，应为待补正或已退回状态")
		return
	}

	now := time.Now()
	newStatus := string(models.StatusPendingAssign)
	nodeName, nodeResponsible := getNodeInfo(newStatus)
	nodeDueDate := now.AddDate(0, 0, 15)

	tx, err := h.db.Begin()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	opinion := req.Opinion
	if opinion == "" {
		opinion = "已完成补正"
	}

	_, err = tx.Exec(`
		UPDATE trademark_applications SET
			status = ?, current_handler = ?, updated_at = ?, version = ?,
			last_opinion = ?, last_handler_name = ?, last_handle_time = ?,
			material_complete = ?, evidence_complete = ?,
			current_node = ?, node_due_date = ?, node_responsible = ?
		WHERE id = ?
	`,
		newStatus, string(models.RoleRegistrar), now, version+1,
		opinion, user.Name, now,
		req.MaterialComplete, req.EvidenceComplete,
		nodeName, nodeDueDate, nodeResponsible, id,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新状态失败")
		return
	}

	recordID := generateID()
	moduleType := string(models.ModuleCorrection)
	if currentStatus == string(models.StatusReturned) {
		moduleType = string(models.ModuleApplication)
	}
	_, err = tx.Exec(`
		INSERT INTO processing_records (
			id, application_id, action, old_status, new_status,
			handler, opinion, created_at, module_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		recordID, id, "correct", currentStatus, newStatus,
		user.ID, opinion, now, moduleType,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建处理记录失败")
		return
	}

	if req.ExceptionReason != "" {
		mc := req.MaterialComplete
		ec := req.EvidenceComplete
		correctSummary := fmt.Sprintf("[补正] 异常类型:correction_note | 材料完整:%v | 证据完整:%v | 说明:%s | 处理意见:%s",
			mc, ec, req.ExceptionReason, opinion)
		excID := generateID()
		_, err = tx.Exec(`
			INSERT INTO exception_reasons (
				id, application_id, reason, reason_type, created_by,
				created_at, module_type, resolved,
				material_complete, evidence_complete, opinion, summary
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			excID, id, req.ExceptionReason, "correction_note", user.ID,
			now, moduleType, false,
			boolToInt(mc), boolToInt(ec), opinion, correctSummary,
		)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "创建异常记录失败")
			return
		}
	}

	_, err = tx.Exec(`
		UPDATE exception_reasons SET resolved = 1, resolved_at = ?
		WHERE application_id = ? AND resolved = 0
	`, now, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新异常状态失败")
		return
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	updateWarningStatus(h.db, id, nodeDueDate.Format("2006-01-02 15:04:05"))

	respondSuccess(w, map[string]interface{}{
		"id":      id,
		"status":  newStatus,
		"version": version + 1,
	})
}

func (h *ApplicationHandler) Return(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetCurrentUserFromContext(r)

	if user.Role != models.RoleAgent && user.Role != models.RoleDirector {
		respondError(w, http.StatusForbidden, "只有商标申请审核主管或复核负责人可以退回")
		return
	}

	var req models.ReturnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	var currentStatus, currentHandler string
	var version int
	var materialComplete, evidenceComplete bool
	err := h.db.QueryRow(`
		SELECT status, current_handler, version, material_complete, evidence_complete
		FROM trademark_applications WHERE id = ?
	`, id).Scan(&currentStatus, &currentHandler, &version, &materialComplete, &evidenceComplete)
	if err != nil {
		respondError(w, http.StatusNotFound, "申请单不存在")
		return
	}

	if currentHandler != string(user.Role) {
		respondError(w, http.StatusForbidden, "您不是当前处理人")
		return
	}

	if currentStatus != string(models.StatusTransferred) && currentStatus != string(models.StatusVisited) {
		respondError(w, http.StatusBadRequest, "当前状态不允许退回操作，应为已转办或已回访状态")
		return
	}

	if req.MaterialComplete != nil {
		materialComplete = *req.MaterialComplete
	}
	if req.EvidenceComplete != nil {
		evidenceComplete = *req.EvidenceComplete
	}

	exceptionReason := req.ExceptionReason
	if exceptionReason == "" {
		exceptionReason = req.Reason
	}
	if exceptionReason == "" {
		if !materialComplete {
			exceptionReason = "商标申请材料不完整"
		} else if !evidenceComplete {
			exceptionReason = "递交通知证据不完整"
		} else {
			exceptionReason = "其他原因"
		}
	}

	reasonType := "other"
	if !materialComplete {
		reasonType = "material_missing"
	} else if !evidenceComplete {
		reasonType = "evidence_missing"
	}

	var newStatus string
	var moduleType string
	if !materialComplete {
		newStatus = string(models.StatusCorrection)
		moduleType = string(models.ModuleCorrection)
	} else if !evidenceComplete {
		newStatus = string(models.StatusReturned)
		moduleType = string(models.ModuleNotification)
	} else {
		newStatus = string(models.StatusReturned)
		moduleType = string(models.ModuleApplication)
	}

	newHandler := string(models.RoleRegistrar)
	nodeName, nodeResponsible := getNodeInfo(newStatus)
	now := time.Now()
	nodeDueDate := now.AddDate(0, 0, 7)

	tx, err := h.db.Begin()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	opinion := req.Opinion
	if opinion == "" {
		if !materialComplete {
			opinion = "材料不完整，请补正后重新提交"
		} else if !evidenceComplete {
			opinion = "缺少递交通知证据，请补正后重新提交"
		} else {
			opinion = "申请存在问题，请修改后重新提交"
		}
	}

	recordOpinion := fmt.Sprintf("[退回] 异常类型:%s | 材料完整:%v | 证据完整:%v | 异常说明:%s | 处理意见:%s",
		reasonType, materialComplete, evidenceComplete, exceptionReason, opinion)

	_, err = tx.Exec(`
		UPDATE trademark_applications SET
			status = ?, current_handler = ?, updated_at = ?, version = ?,
			last_opinion = ?, last_handler_name = ?, last_handle_time = ?,
			material_complete = ?, evidence_complete = ?,
			current_node = ?, node_due_date = ?, node_responsible = ?
		WHERE id = ?
	`,
		newStatus, newHandler, now, version+1,
		opinion, user.Name, now,
		materialComplete, evidenceComplete,
		nodeName, nodeDueDate, nodeResponsible, id,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新状态失败")
		return
	}

	recordID := generateID()
	_, err = tx.Exec(`
		INSERT INTO processing_records (
			id, application_id, action, old_status, new_status,
			handler, opinion, created_at, module_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		recordID, id, "return", currentStatus, newStatus,
		user.ID, recordOpinion, now, moduleType,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建处理记录失败")
		return
	}

	excID := generateID()
	_, err = tx.Exec(`
		INSERT INTO exception_reasons (
			id, application_id, reason, reason_type, created_by,
			created_at, module_type, resolved,
			material_complete, evidence_complete, opinion, summary
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		excID, id, exceptionReason, reasonType, user.ID,
		now, moduleType, false,
		boolToInt(materialComplete), boolToInt(evidenceComplete),
		opinion, recordOpinion,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建异常记录失败")
		return
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	updateWarningStatus(h.db, id, nodeDueDate.Format("2006-01-02 15:04:05"))

	respondSuccess(w, map[string]interface{}{
		"id":      id,
		"status":  newStatus,
		"version": version + 1,
	})
}

func (h *ApplicationHandler) Review(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetCurrentUserFromContext(r)

	if user.Role != models.RoleDirector {
		respondError(w, http.StatusForbidden, "只有知识产权代理所复核负责人可以复核")
		return
	}

	var req models.ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	var currentStatus, currentHandler string
	var version int
	var materialComplete, evidenceComplete bool
	err := h.db.QueryRow(`
		SELECT status, current_handler, version, material_complete, evidence_complete
		FROM trademark_applications WHERE id = ?
	`, id).Scan(&currentStatus, &currentHandler, &version, &materialComplete, &evidenceComplete)
	if err != nil {
		respondError(w, http.StatusNotFound, "申请单不存在")
		return
	}

	if currentHandler != string(user.Role) {
		respondError(w, http.StatusForbidden, "您不是当前处理人")
		return
	}

	if currentStatus != string(models.StatusVisited) {
		respondError(w, http.StatusBadRequest, "当前状态不允许复核操作，应为已回访状态")
		return
	}

	if !materialComplete {
		respondError(w, http.StatusBadRequest, "商标申请材料不完整，无法归档")
		return
	}

	if !evidenceComplete {
		respondError(w, http.StatusBadRequest, "递交通知证据不完整，无法归档")
		return
	}

	newStatus := string(models.StatusArchived)
	newHandler := ""
	nodeName, nodeResponsible := getNodeInfo(newStatus)
	now := time.Now()

	tx, err := h.db.Begin()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	opinion := req.Opinion
	if opinion == "" {
		opinion = "已完成复核归档"
	}

	_, err = tx.Exec(`
		UPDATE trademark_applications SET
			status = ?, current_handler = ?, updated_at = ?, version = ?,
			last_opinion = ?, last_handler_name = ?, last_handle_time = ?,
			current_node = ?, node_due_date = NULL, node_responsible = ?,
			warning_status = 'normal', warning_text = ''
		WHERE id = ?
	`,
		newStatus, newHandler, now, version+1,
		opinion, user.Name, now,
		nodeName, nodeResponsible, id,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新状态失败")
		return
	}

	recordID := generateID()
	_, err = tx.Exec(`
		INSERT INTO processing_records (
			id, application_id, action, old_status, new_status,
			handler, opinion, created_at, module_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		recordID, id, "review", currentStatus, newStatus,
		user.ID, opinion, now, string(models.ModuleApplication),
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建处理记录失败")
		return
	}

	_, err = tx.Exec(`
		UPDATE exception_reasons SET resolved = 1, resolved_at = ?
		WHERE application_id = ? AND resolved = 0
	`, now, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新异常状态失败")
		return
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	respondSuccess(w, map[string]interface{}{
		"id":      id,
		"status":  newStatus,
		"version": version + 1,
	})
}

func (h *ApplicationHandler) GetAuditTrail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	sql := `
		SELECT id, action, old_status, new_status, handler, opinion, created_at, module_type
		FROM processing_records WHERE application_id = ? ORDER BY created_at DESC
	`

	rows, err := h.db.Query(sql, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询审计轨迹失败")
		return
	}
	defer rows.Close()

	records := []*models.ProcessingRecord{}
	for rows.Next() {
		rec := &models.ProcessingRecord{}
		var createdAt *time.Time
		err := rows.Scan(
			&rec.ID, &rec.Action, &rec.OldStatus, &rec.NewStatus,
			&rec.Handler, &rec.Opinion, &createdAt, &rec.ModuleType,
		)
		if err == nil {
			rec.ApplicationID = id
			rec.ActionName = database.GetActionName(rec.Action)
			rec.HandlerName = database.GetRoleName(rec.Handler)
			if createdAt != nil {
				rec.CreatedAt = *createdAt
			}
			records = append(records, rec)
		}
	}

	respondSuccess(w, records)
}

func (h *ApplicationHandler) AddAuditRemark(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetCurrentUserFromContext(r)

	var req models.AddAuditRemarkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	if req.Content == "" {
		respondError(w, http.StatusBadRequest, "备注内容不能为空")
		return
	}

	var version int
	err := h.db.QueryRow("SELECT version FROM trademark_applications WHERE id = ?", id).Scan(&version)
	if err != nil {
		respondError(w, http.StatusNotFound, "申请单不存在")
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	now := time.Now()
	remarkID := generateID()

	_, err = tx.Exec(`
		INSERT INTO audit_remarks (
			id, application_id, content, created_by, created_at
		) VALUES (?, ?, ?, ?, ?)
	`, remarkID, id, req.Content, user.ID, now)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "添加审计备注失败")
		return
	}

	_, err = tx.Exec(`
		UPDATE trademark_applications SET version = ?, updated_at = ? WHERE id = ?
	`, version+1, now, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新版本失败")
		return
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	respondSuccess(w, map[string]interface{}{
		"id":      remarkID,
		"version": version + 1,
	})
}

func (h *ApplicationHandler) UploadEvidence(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetCurrentUserFromContext(r)

	var req models.UploadEvidenceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	fileName := req.FileName
	if fileName == "" {
		fileName = req.Name
	}
	if fileName == "" {
		respondError(w, http.StatusBadRequest, "文件名称不能为空")
		return
	}

	var currentStatus, currentHandler string
	var version int
	var materialComplete, evidenceComplete bool
	err := h.db.QueryRow(`
		SELECT status, current_handler, version, material_complete, evidence_complete
		FROM trademark_applications WHERE id = ?
	`, id).Scan(&currentStatus, &currentHandler, &version, &materialComplete, &evidenceComplete)
	if err != nil {
		respondError(w, http.StatusNotFound, "申请单不存在")
		return
	}

	if currentHandler != string(user.Role) && currentHandler != "" {
		respondError(w, http.StatusForbidden, "您不是当前处理人")
		return
	}

	moduleType := req.ModuleType
	if moduleType == "" {
		moduleType = string(models.ModuleNotification)
	}

	evidenceType := req.EvidenceType
	if evidenceType == "" {
		if moduleType == string(models.ModuleApplication) {
			evidenceType = "application_form"
		} else if moduleType == string(models.ModuleCorrection) {
			evidenceType = "correction_material"
		} else {
			evidenceType = "notification_evidence"
		}
	}

	now := time.Now()
	attachID := generateID()

	tx, err := h.db.Begin()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO attachments (
			id, application_id, file_name, file_type, file_size,
			module_type, uploaded_by, uploaded_at, evidence_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		attachID, id, fileName, req.FileType, req.FileSize,
		moduleType, user.ID, now, evidenceType,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "上传证据失败")
		return
	}

	newMaterialComplete := materialComplete
	newEvidenceComplete := evidenceComplete

	if evidenceType == "notification_evidence" {
		newEvidenceComplete = true
	}

	if evidenceType == "application_form" || evidenceType == "trademark_image" {
		var count int
		tx.QueryRow(`
			SELECT COUNT(*) FROM attachments WHERE application_id = ? AND evidence_type IN ('application_form', 'trademark_image')
		`, id).Scan(&count)
		if count >= 2 {
			newMaterialComplete = true
		}
	}

	if evidenceType == "correction_material" {
		newMaterialComplete = true
	}

	_, err = tx.Exec(`
		UPDATE trademark_applications SET
			material_complete = ?, evidence_complete = ?,
			updated_at = ?, version = ?
		WHERE id = ?
	`, newMaterialComplete, newEvidenceComplete, now, version+1, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新状态失败")
		return
	}

	recordID := generateID()
	opinion := "上传证据：" + fileName
	_, err = tx.Exec(`
		INSERT INTO processing_records (
			id, application_id, action, old_status, new_status,
			handler, opinion, created_at, module_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		recordID, id, "upload_evidence", currentStatus, currentStatus,
		user.ID, opinion, now, moduleType,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建处理记录失败")
		return
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	respondSuccess(w, map[string]interface{}{
		"id":       attachID,
		"version":  version + 1,
		"material_complete": newMaterialComplete,
		"evidence_complete": newEvidenceComplete,
	})
}

func (h *ApplicationHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUserFromContext(r)

	whereSQL := "1=1"
	args := []interface{}{}

	if user.Role == models.RoleRegistrar {
		whereSQL = "current_handler IN (?, '')"
		args = append(args, string(models.RoleRegistrar))
	} else if user.Role == models.RoleAgent {
		whereSQL = "current_handler IN (?, '')"
		args = append(args, string(models.RoleAgent))
	} else if user.Role == models.RoleDirector {
		whereSQL = "current_handler IN (?, '')"
		args = append(args, string(models.RoleDirector))
	}

	var total, totalApplication, totalCorrection, totalNotification int64
	var pendingAssign, transferred, visited, correction, returned, archived int64
	var normal, approaching, overdue int64

	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE `+whereSQL, args...).Scan(&total)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE status IN ('pending_assign', 'transferred', 'visited', 'archived') AND `+whereSQL, args...).Scan(&totalApplication)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE status IN ('correction', 'returned') AND `+whereSQL, args...).Scan(&totalCorrection)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE status IN ('transferred', 'visited') AND `+whereSQL, args...).Scan(&totalNotification)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE status = 'pending_assign' AND `+whereSQL, args...).Scan(&pendingAssign)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE status = 'transferred' AND `+whereSQL, args...).Scan(&transferred)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE status = 'visited' AND `+whereSQL, args...).Scan(&visited)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE status = 'correction' AND `+whereSQL, args...).Scan(&correction)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE status = 'returned' AND `+whereSQL, args...).Scan(&returned)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE status = 'archived' AND `+whereSQL, args...).Scan(&archived)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE warning_status = 'normal' AND `+whereSQL, args...).Scan(&normal)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE warning_status = 'approaching' AND `+whereSQL, args...).Scan(&approaching)
	h.db.QueryRow(`SELECT COUNT(*) FROM trademark_applications WHERE warning_status = 'overdue' AND `+whereSQL, args...).Scan(&overdue)

	respondSuccess(w, models.StatsResponse{
		Total:             total,
		TotalApplication:  totalApplication,
		TotalCorrection:   totalCorrection,
		TotalNotification: totalNotification,
		PendingAssign:     pendingAssign,
		Transferred:       transferred,
		Visited:           visited,
		Correction:        correction,
		Returned:          returned,
		Archived:          archived,
		Normal:            normal,
		Approaching:       approaching,
		Overdue:           overdue,
	})
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
