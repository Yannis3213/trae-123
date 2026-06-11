package handlers

import (
	"database/sql"
	"encoding/json"
	"fire-hazard-system/internal/db"
	"fire-hazard-system/internal/middleware"
	"fire-hazard-system/internal/models"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, status int, message string) {
	jsonResponse(w, status, map[string]interface{}{
		"success": false,
		"message": message,
	})
}

func calcWarningLevel(deadline time.Time) models.WarningLevel {
	if deadline.IsZero() {
		return models.WarningNormal
	}
	now := time.Now()
	diff := deadline.Sub(now)
	if diff < 0 {
		return models.WarningOverdue
	}
	if diff.Hours() < 72 {
		return models.WarningNearDue
	}
	return models.WarningNormal
}

func generateHazardNo() string {
	now := time.Now()
	var count int
	db.DB.QueryRow("SELECT COUNT(*) FROM fire_hazards WHERE strftime('%Y%m%d', created_at) = ?",
		now.Format("20060102")).Scan(&count)
	return fmt.Sprintf("XFYH-%s-%04d", now.Format("20060102"), count+1)
}

func (h *Handler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    user,
	})
}

func (h *Handler) ListHazards(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	status := r.URL.Query().Get("status")
	warningLevel := r.URL.Query().Get("warning_level")
	priority := r.URL.Query().Get("priority")
	handler := r.URL.Query().Get("handler")
	responsible := r.URL.Query().Get("responsible")
	keyword := r.URL.Query().Get("keyword")

	query := `SELECT id, hazard_no, title, description, location, priority, responsible, 
		current_handler, status, deadline, warning_level, abnormal_tags, version, 
		created_by, created_at, updated_at FROM fire_hazards WHERE 1=1`
	args := []interface{}{}

	if status != "" {
		statuses := strings.Split(status, ",")
		placeholders := make([]string, len(statuses))
		for i, s := range statuses {
			placeholders[i] = "?"
			args = append(args, s)
		}
		query += fmt.Sprintf(" AND status IN (%s)", strings.Join(placeholders, ","))
	}
	if warningLevel != "" {
		query += " AND warning_level = ?"
		args = append(args, warningLevel)
	}
	if priority != "" {
		query += " AND priority = ?"
		args = append(args, priority)
	}
	if handler != "" {
		query += " AND current_handler = ?"
		args = append(args, handler)
	}
	if responsible != "" {
		query += " AND responsible = ?"
		args = append(args, responsible)
	}
	if keyword != "" {
		query += " AND (title LIKE ? OR hazard_no LIKE ? OR description LIKE ?)"
		kw := "%" + keyword + "%"
		args = append(args, kw, kw, kw)
	}

	query += " ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, deadline ASC, id DESC"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		log.Printf("查询隐患单失败: %v", err)
		jsonError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()

	hazards := []*models.FireHazard{}
	for rows.Next() {
		h := &models.FireHazard{}
		var abnormalTagsStr string
		var deadline sql.NullTime
		err := rows.Scan(&h.ID, &h.HazardNo, &h.Title, &h.Description, &h.Location,
			&h.Priority, &h.Responsible, &h.CurrentHandler, &h.Status, &deadline,
			&h.WarningLevel, &abnormalTagsStr, &h.Version, &h.CreatedBy,
			&h.CreatedAt, &h.UpdatedAt)
		if err != nil {
			log.Printf("扫描行失败: %v", err)
			continue
		}
		if deadline.Valid {
			h.Deadline = deadline.Time
		}
		json.Unmarshal([]byte(abnormalTagsStr), &h.AbnormalTags)
		if h.AbnormalTags == nil {
			h.AbnormalTags = []string{}
		}
		h.WarningLevel = calcWarningLevel(h.Deadline)
		hazards = append(hazards, h)
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    hazards,
		"total":   len(hazards),
		"user":    user,
	})
}

func (h *Handler) GetHazard(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, http.StatusBadRequest, "无效的ID")
		return
	}

	hazard := &models.FireHazard{}
	var abnormalTagsStr string
	var deadline sql.NullTime
	err = db.DB.QueryRow(`SELECT id, hazard_no, title, description, location, priority, responsible,
		current_handler, status, deadline, warning_level, abnormal_tags, rectify_notice,
		recheck_result, return_reason, version, created_by, created_at, updated_at
		FROM fire_hazards WHERE id = ?`, id).Scan(
		&hazard.ID, &hazard.HazardNo, &hazard.Title, &hazard.Description, &hazard.Location,
		&hazard.Priority, &hazard.Responsible, &hazard.CurrentHandler, &hazard.Status,
		&deadline, &hazard.WarningLevel, &abnormalTagsStr, &hazard.RectifyNotice,
		&hazard.RecheckResult, &hazard.ReturnReason, &hazard.Version, &hazard.CreatedBy,
		&hazard.CreatedAt, &hazard.UpdatedAt)
	if err == sql.ErrNoRows {
		jsonError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	if deadline.Valid {
		hazard.Deadline = deadline.Time
	}
	json.Unmarshal([]byte(abnormalTagsStr), &hazard.AbnormalTags)
	hazard.WarningLevel = calcWarningLevel(hazard.Deadline)

	attachments := h.getAttachments(id)
	records := h.getProcessRecords(id)
	auditNotes := h.getAuditNotes(id)
	abnormalReasons := h.getAbnormalReasons(id)

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"hazard":           hazard,
			"attachments":      attachments,
			"process_records":  records,
			"audit_notes":      auditNotes,
			"abnormal_reasons": abnormalReasons,
		},
	})
}

func (h *Handler) CreateHazard(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user.Role != models.RoleClerk {
		jsonError(w, http.StatusForbidden, "只有消防文员可以新建隐患单")
		return
	}

	var req struct {
		Title       string          `json:"title"`
		Description string          `json:"description"`
		Location    string          `json:"location"`
		Priority    models.Priority `json:"priority"`
		Responsible string          `json:"responsible"`
		Deadline    string          `json:"deadline"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	if req.Title == "" {
		jsonError(w, http.StatusBadRequest, "标题不能为空")
		return
	}
	if req.Priority == "" {
		req.Priority = models.PriorityMedium
	}

	hazardNo := generateHazardNo()
	var deadlineVal interface{}
	if req.Deadline != "" {
		deadlineVal = req.Deadline
	} else {
		deadlineVal = nil
	}

	result, err := db.DB.Exec(`INSERT INTO fire_hazards 
		(hazard_no, title, description, location, priority, responsible, current_handler, status, deadline, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		hazardNo, req.Title, req.Description, req.Location, req.Priority,
		req.Responsible, user.Name, models.StatusDraft, deadlineVal, user.Name)
	if err != nil {
		log.Printf("创建隐患单失败: %v", err)
		jsonError(w, http.StatusInternalServerError, "创建失败")
		return
	}

	id, _ := result.LastInsertId()
	h.insertProcessRecord(id, "create", "", models.StatusDraft, user, "新建隐患单", nil)

	jsonResponse(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "创建成功",
		"data":    map[string]interface{}{"id": id, "hazard_no": hazardNo},
	})
}

var validTransitions = map[models.HazardStatus]map[models.HazardStatus][]models.Role{
	models.StatusDraft: {
		models.StatusPendingAssign: {models.RoleClerk},
	},
	models.StatusPendingAssign: {
		models.StatusAssigned:    {models.RoleClerk},
		models.StatusTransferred: {models.RoleClerk},
	},
	models.StatusAssigned: {
		models.StatusRectifying: {models.RoleSupervisor},
		models.StatusReturned:   {models.RoleSupervisor},
	},
	models.StatusTransferred: {
		models.StatusRectifying: {models.RoleSupervisor},
	},
	models.StatusRectifying: {
		models.StatusRechecking: {models.RoleSupervisor},
		models.StatusReturned:   {models.RoleSupervisor},
	},
	models.StatusRechecking: {
		models.StatusRevisited: {models.RoleStationChief},
		models.StatusClosed:    {models.RoleStationChief},
		models.StatusReturned:  {models.RoleStationChief},
	},
	models.StatusReturned: {
		models.StatusRectifying: {models.RoleSupervisor},
		models.StatusRechecking: {models.RoleSupervisor},
	},
	models.StatusRevisited: {
		models.StatusClosed: {models.RoleStationChief},
	},
}

func (h *Handler) validateTransition(from, to models.HazardStatus, user *models.User) (bool, string) {
	if from == to {
		return false, "状态未发生变化"
	}
	transitions, ok := validTransitions[from]
	if !ok {
		return false, fmt.Sprintf("当前状态 %s 不允许流转", from)
	}
	allowedRoles, ok := transitions[to]
	if !ok {
		return false, fmt.Sprintf("不允许从 %s 流转到 %s", from, to)
	}
	for _, role := range allowedRoles {
		if user.Role == role {
			return true, ""
		}
	}
	roleNames := map[models.Role]string{
		models.RoleClerk:        "消防文员",
		models.RoleSupervisor:   "防火监督员",
		models.RoleStationChief: "站点负责人",
	}
	allowedNames := []string{}
	for _, r := range allowedRoles {
		allowedNames = append(allowedNames, roleNames[r])
	}
	return false, fmt.Sprintf("只有 %s 可以执行此操作", strings.Join(allowedNames, "、"))
}

type ProcessActionRequest struct {
	Action         string              `json:"action"`
	ToStatus       models.HazardStatus `json:"to_status"`
	Remark         string              `json:"remark"`
	ReturnReason   string              `json:"return_reason"`
	RectifyNotice  string              `json:"rectify_notice"`
	RecheckResult  string              `json:"recheck_result"`
	CurrentHandler string              `json:"current_handler"`
	Evidence       []string            `json:"evidence"`
	AbnormalTags   []string            `json:"abnormal_tags"`
	Version        int64               `json:"version"`
}

func (h *Handler) ProcessHazard(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, http.StatusBadRequest, "无效的ID")
		return
	}

	var req ProcessActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "请求格式错误")
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "事务启动失败")
		return
	}
	defer tx.Rollback()

	var currentStatus models.HazardStatus
	var currentVersion int64
	var currentHandler string
	err = tx.QueryRow("SELECT status, version, current_handler FROM fire_hazards WHERE id = ?", id).
		Scan(&currentStatus, &currentVersion, &currentHandler)
	if err == sql.ErrNoRows {
		jsonError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "查询失败")
		return
	}

	if req.Version > 0 && req.Version != currentVersion {
		jsonError(w, http.StatusConflict, fmt.Sprintf("版本冲突：当前版本为%d，请刷新后重试", currentVersion))
		return
	}

	if req.ToStatus != "" {
		valid, msg := h.validateTransition(currentStatus, req.ToStatus, user)
		if !valid {
			jsonError(w, http.StatusBadRequest, msg)
			return
		}
	}

	requiredEvidence := map[models.HazardStatus][]string{
		models.StatusRectifying: {"rectify_notice"},
		models.StatusRechecking: {"recheck_result"},
		models.StatusClosed:     {"recheck_result", "evidence"},
	}
	if fields, ok := requiredEvidence[req.ToStatus]; ok {
		for _, f := range fields {
			switch f {
			case "rectify_notice":
				if req.RectifyNotice == "" && req.ToStatus == models.StatusRectifying {
					jsonError(w, http.StatusBadRequest, "整改通知内容必填")
					return
				}
			case "recheck_result":
				if req.RecheckResult == "" {
					jsonError(w, http.StatusBadRequest, "复查结果必填")
					return
				}
			case "evidence":
				if len(req.Evidence) == 0 {
					jsonError(w, http.StatusBadRequest, "必须上传佐证材料")
					return
				}
			}
		}
	}

	newStatus := currentStatus
	if req.ToStatus != "" {
		newStatus = req.ToStatus
	}
	newHandler := currentHandler
	if req.CurrentHandler != "" {
		newHandler = req.CurrentHandler
	}

	updateFields := []string{"version = version + 1", "updated_at = CURRENT_TIMESTAMP"}
	updateArgs := []interface{}{}

	if newStatus != currentStatus {
		updateFields = append(updateFields, "status = ?")
		updateArgs = append(updateArgs, newStatus)
	}
	if newHandler != currentHandler {
		updateFields = append(updateFields, "current_handler = ?")
		updateArgs = append(updateArgs, newHandler)
	}
	if req.RectifyNotice != "" {
		updateFields = append(updateFields, "rectify_notice = ?")
		updateArgs = append(updateArgs, req.RectifyNotice)
	}
	if req.RecheckResult != "" {
		updateFields = append(updateFields, "recheck_result = ?")
		updateArgs = append(updateArgs, req.RecheckResult)
	}
	if req.ReturnReason != "" {
		updateFields = append(updateFields, "return_reason = ?")
		updateArgs = append(updateArgs, req.ReturnReason)
	}
	if len(req.AbnormalTags) > 0 {
		tagsJSON, _ := json.Marshal(req.AbnormalTags)
		updateFields = append(updateFields, "abnormal_tags = ?")
		updateArgs = append(updateArgs, string(tagsJSON))
	}

	updateArgs = append(updateArgs, id)
	updateSQL := fmt.Sprintf("UPDATE fire_hazards SET %s WHERE id = ?", strings.Join(updateFields, ", "))
	_, err = tx.Exec(updateSQL, updateArgs...)
	if err != nil {
		log.Printf("更新隐患单失败: %v", err)
		jsonError(w, http.StatusInternalServerError, "处理失败")
		return
	}

	h.insertProcessRecordTx(tx, id, req.Action, currentStatus, newStatus, user, req.Remark, req.Evidence)

	if err = tx.Commit(); err != nil {
		jsonError(w, http.StatusInternalServerError, "提交失败")
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "处理成功",
		"data": map[string]interface{}{
			"id":              id,
			"status":          newStatus,
			"version":         currentVersion + 1,
			"current_handler": newHandler,
		},
	})
}

func (h *Handler) BatchProcess(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	var req struct {
		IDs            []int64             `json:"ids"`
		Action         string              `json:"action"`
		ToStatus       models.HazardStatus `json:"to_status"`
		Remark         string              `json:"remark"`
		ReturnReason   string              `json:"return_reason"`
		RectifyNotice  string              `json:"rectify_notice"`
		RecheckResult  string              `json:"recheck_result"`
		CurrentHandler string              `json:"current_handler"`
		Evidence       []string            `json:"evidence"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	if len(req.IDs) == 0 {
		jsonError(w, http.StatusBadRequest, "请选择要处理的隐患单")
		return
	}

	results := make([]models.BatchResult, 0, len(req.IDs))

	for _, id := range req.IDs {
		result := models.BatchResult{ID: id, Success: false, Message: ""}

		tx, err := db.DB.Begin()
		if err != nil {
			result.Message = "事务启动失败"
			results = append(results, result)
			continue
		}

		var currentStatus models.HazardStatus
		var currentVersion int64
		var currentHandler string
		err = tx.QueryRow("SELECT status, version, current_handler FROM fire_hazards WHERE id = ?", id).
			Scan(&currentStatus, &currentVersion, &currentHandler)
		if err == sql.ErrNoRows {
			result.Message = "隐患单不存在"
			tx.Rollback()
			results = append(results, result)
			continue
		}
		if err != nil {
			result.Message = "查询失败"
			tx.Rollback()
			results = append(results, result)
			continue
		}

		if req.ToStatus != "" {
			valid, msg := h.validateTransition(currentStatus, req.ToStatus, user)
			if !valid {
				result.Message = msg
				tx.Rollback()
				results = append(results, result)
				continue
			}
		}

		wl := calcWarningLevel(h.getDeadline(id))
		if wl == models.WarningOverdue && req.ToStatus != models.StatusReturned {
			result.Message = "已逾期，请先到详情页补正后再处理"
			tx.Rollback()
			results = append(results, result)
			continue
		}

		newStatus := currentStatus
		if req.ToStatus != "" {
			newStatus = req.ToStatus
		}
		newHandler := currentHandler
		if req.CurrentHandler != "" {
			newHandler = req.CurrentHandler
		}

		updateFields := []string{"version = version + 1", "updated_at = CURRENT_TIMESTAMP"}
		updateArgs := []interface{}{}
		if newStatus != currentStatus {
			updateFields = append(updateFields, "status = ?")
			updateArgs = append(updateArgs, newStatus)
		}
		if newHandler != currentHandler {
			updateFields = append(updateFields, "current_handler = ?")
			updateArgs = append(updateArgs, newHandler)
		}
		if req.RectifyNotice != "" {
			updateFields = append(updateFields, "rectify_notice = ?")
			updateArgs = append(updateArgs, req.RectifyNotice)
		}
		if req.RecheckResult != "" {
			updateFields = append(updateFields, "recheck_result = ?")
			updateArgs = append(updateArgs, req.RecheckResult)
		}
		if req.ReturnReason != "" {
			updateFields = append(updateFields, "return_reason = ?")
			updateArgs = append(updateArgs, req.ReturnReason)
		}
		updateArgs = append(updateArgs, id)
		updateSQL := fmt.Sprintf("UPDATE fire_hazards SET %s WHERE id = ? AND version = ?", strings.Join(updateFields, ", "))
		updateArgs = append(updateArgs, currentVersion)

		res, err := tx.Exec(updateSQL, updateArgs...)
		if err != nil {
			result.Message = "更新失败：" + err.Error()
			tx.Rollback()
			results = append(results, result)
			continue
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			result.Message = "状态冲突或已被他人修改，请刷新后重试"
			tx.Rollback()
			results = append(results, result)
			continue
		}

		h.insertProcessRecordTx(tx, id, req.Action, currentStatus, newStatus, user, req.Remark, req.Evidence)

		if err = tx.Commit(); err != nil {
			result.Message = "提交失败"
			results = append(results, result)
			continue
		}

		result.Success = true
		result.Message = "处理成功"
		results = append(results, result)
	}

	successCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		}
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success":       true,
		"message":       fmt.Sprintf("批量处理完成：成功 %d 条，失败 %d 条", successCount, len(results)-successCount),
		"success_count": successCount,
		"fail_count":    len(results) - successCount,
		"data":          results,
	})
}

func (h *Handler) AddAuditNote(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, http.StatusBadRequest, "无效的ID")
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	if req.Content == "" {
		jsonError(w, http.StatusBadRequest, "备注内容不能为空")
		return
	}

	_, err = db.DB.Exec(`INSERT INTO audit_notes (hazard_id, content, auditor, auditor_role) VALUES (?, ?, ?, ?)`,
		id, req.Content, user.Name, user.Role)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "添加备注失败")
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "备注已添加",
	})
}

func (h *Handler) AddAbnormalReason(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, http.StatusBadRequest, "无效的ID")
		return
	}

	var req struct {
		Reason   string `json:"reason"`
		Category string `json:"category"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	if req.Reason == "" {
		jsonError(w, http.StatusBadRequest, "异常原因不能为空")
		return
	}

	_, err = db.DB.Exec(`INSERT INTO abnormal_reasons (hazard_id, reason, category, reported_by) VALUES (?, ?, ?, ?)`,
		id, req.Reason, req.Category, user.Name)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "添加异常原因失败")
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "异常原因已记录",
	})
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	var total, pendingAssign, transferred, revisited, overdue, nearDue int
	db.DB.QueryRow("SELECT COUNT(*) FROM fire_hazards").Scan(&total)
	db.DB.QueryRow("SELECT COUNT(*) FROM fire_hazards WHERE status = 'pending_assign'").Scan(&pendingAssign)
	db.DB.QueryRow("SELECT COUNT(*) FROM fire_hazards WHERE status = 'transferred'").Scan(&transferred)
	db.DB.QueryRow("SELECT COUNT(*) FROM fire_hazards WHERE status = 'revisited'").Scan(&revisited)

	now := time.Now()
	nearDueTime := now.Add(72 * time.Hour)
	db.DB.QueryRow("SELECT COUNT(*) FROM fire_hazards WHERE deadline IS NOT NULL AND deadline < ?", now).Scan(&overdue)
	db.DB.QueryRow("SELECT COUNT(*) FROM fire_hazards WHERE deadline IS NOT NULL AND deadline >= ? AND deadline <= ?", now, nearDueTime).Scan(&nearDue)

	statusDist := []map[string]interface{}{}
	rows, _ := db.DB.Query("SELECT status, COUNT(*) as cnt FROM fire_hazards GROUP BY status")
	for rows.Next() {
		var s string
		var c int
		rows.Scan(&s, &c)
		statusDist = append(statusDist, map[string]interface{}{"status": s, "count": c})
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"total":          total,
			"pending_assign": pendingAssign,
			"transferred":    transferred,
			"revisited":      revisited,
			"overdue":        overdue,
			"near_due":       nearDue,
			"status_dist":    statusDist,
		},
	})
}

func (h *Handler) getDeadline(id int64) time.Time {
	var t sql.NullTime
	db.DB.QueryRow("SELECT deadline FROM fire_hazards WHERE id = ?", id).Scan(&t)
	if t.Valid {
		return t.Time
	}
	return time.Time{}
}

func (h *Handler) getAttachments(hazardID int64) []*models.Attachment {
	rows, _ := db.DB.Query(`SELECT id, hazard_id, file_name, file_type, file_size, file_url, uploaded_by, uploaded_at 
		FROM attachments WHERE hazard_id = ? ORDER BY uploaded_at DESC`, hazardID)
	defer rows.Close()
	list := []*models.Attachment{}
	for rows.Next() {
		a := &models.Attachment{}
		rows.Scan(&a.ID, &a.HazardID, &a.FileName, &a.FileType, &a.FileSize, &a.FileURL, &a.UploadedBy, &a.UploadedAt)
		list = append(list, a)
	}
	return list
}

func (h *Handler) getProcessRecords(hazardID int64) []*models.ProcessRecord {
	rows, _ := db.DB.Query(`SELECT id, hazard_id, action, from_status, to_status, operator, operator_role, remark, evidence, created_at 
		FROM process_records WHERE hazard_id = ? ORDER BY created_at DESC`, hazardID)
	defer rows.Close()
	list := []*models.ProcessRecord{}
	for rows.Next() {
		r := &models.ProcessRecord{}
		var evidenceStr string
		rows.Scan(&r.ID, &r.HazardID, &r.Action, &r.FromStatus, &r.ToStatus, &r.Operator, &r.OperatorRole, &r.Remark, &evidenceStr, &r.CreatedAt)
		json.Unmarshal([]byte(evidenceStr), &r.Evidence)
		list = append(list, r)
	}
	return list
}

func (h *Handler) getAuditNotes(hazardID int64) []*models.AuditNote {
	rows, _ := db.DB.Query(`SELECT id, hazard_id, content, auditor, auditor_role, created_at 
		FROM audit_notes WHERE hazard_id = ? ORDER BY created_at DESC`, hazardID)
	defer rows.Close()
	list := []*models.AuditNote{}
	for rows.Next() {
		n := &models.AuditNote{}
		rows.Scan(&n.ID, &n.HazardID, &n.Content, &n.Auditor, &n.AuditorRole, &n.CreatedAt)
		list = append(list, n)
	}
	return list
}

func (h *Handler) getAbnormalReasons(hazardID int64) []*models.AbnormalReason {
	rows, _ := db.DB.Query(`SELECT id, hazard_id, reason, category, reported_by, created_at, resolved 
		FROM abnormal_reasons WHERE hazard_id = ? ORDER BY created_at DESC`, hazardID)
	defer rows.Close()
	list := []*models.AbnormalReason{}
	for rows.Next() {
		a := &models.AbnormalReason{}
		var resolvedInt int
		rows.Scan(&a.ID, &a.HazardID, &a.Reason, &a.Category, &a.ReportedBy, &a.CreatedAt, &resolvedInt)
		a.Resolved = resolvedInt == 1
		list = append(list, a)
	}
	return list
}

func (h *Handler) insertProcessRecord(hazardID int64, action string, from, to models.HazardStatus, user *models.User, remark string, evidence []string) {
	evidenceJSON, _ := json.Marshal(evidence)
	if evidenceJSON == nil {
		evidenceJSON = []byte("[]")
	}
	db.DB.Exec(`INSERT INTO process_records (hazard_id, action, from_status, to_status, operator, operator_role, remark, evidence) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, hazardID, action, from, to, user.Name, user.Role, remark, string(evidenceJSON))
}

func (h *Handler) insertProcessRecordTx(tx *sql.Tx, hazardID int64, action string, from, to models.HazardStatus, user *models.User, remark string, evidence []string) {
	evidenceJSON, _ := json.Marshal(evidence)
	if evidenceJSON == nil {
		evidenceJSON = []byte("[]")
	}
	tx.Exec(`INSERT INTO process_records (hazard_id, action, from_status, to_status, operator, operator_role, remark, evidence) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, hazardID, action, from, to, user.Name, user.Role, remark, string(evidenceJSON))
}
