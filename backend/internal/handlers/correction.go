package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
	"trademark-system/internal/database"
	"trademark-system/internal/models"

	"github.com/go-chi/chi/v5"
)

type CorrectionHandler struct {
	db *sql.DB
}

func NewCorrectionHandler(db *sql.DB) *CorrectionHandler {
	return &CorrectionHandler{db: db}
}

func (h *CorrectionHandler) List(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUserFromContext(r)

	page := getIntParam(r, "page", 1)
	pageSize := getIntParam(r, "page_size", 10)
	keyword := r.URL.Query().Get("keyword")
	status := r.URL.Query().Get("status")
	warning := r.URL.Query().Get("warning")

	offset := (page - 1) * pageSize

	whereClauses := []string{"status IN (?, ?)"}
	args := []interface{}{string(models.StatusCorrection), string(models.StatusReturned)}

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

	whereSQL := "1=1"
	if len(whereClauses) > 0 {
		whereSQL = whereClauses[0]
		for i := 1; i < len(whereClauses); i++ {
			whereSQL += " AND " + whereClauses[i]
		}
	}

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
			continue
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

func (h *CorrectionHandler) Submit(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetCurrentUserFromContext(r)

	if user.Role != models.RoleRegistrar {
		respondError(w, http.StatusForbidden, "只有商标申请登记员可以提交补正材料")
		return
	}

	var req struct {
		Opinion          string `json:"opinion"`
		MaterialComplete bool   `json:"material_complete"`
		EvidenceComplete bool   `json:"evidence_complete"`
		Version          int    `json:"version"`
		ExceptionReason  string `json:"exception_reason"`
	}
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
		respondError(w, http.StatusBadRequest, "当前状态不允许提交补正材料")
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
		opinion = "已完成材料补正"
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
		excID := generateID()
		_, err = tx.Exec(`
			INSERT INTO exception_reasons (
				id, application_id, reason, reason_type, created_by,
				created_at, module_type, resolved
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`,
			excID, id, req.ExceptionReason, "correction_note", user.ID,
			now, moduleType, false,
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
