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

func jsonErrorDetail(w http.ResponseWriter, status int, message string, detail map[string]interface{}) {
	resp := map[string]interface{}{
		"success": false,
		"message": message,
	}
	if detail != nil {
		resp["detail"] = detail
	}
	jsonResponse(w, status, resp)
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

func getRoleName(role models.Role) string {
	m := map[models.Role]string{
		models.RoleClerk:        "消防文员",
		models.RoleSupervisor:   "防火监督员",
		models.RoleStationChief: "站点负责人",
	}
	if name, ok := m[role]; ok {
		return name
	}
	return string(role)
}

func getStatusName(status models.HazardStatus) string {
	m := map[models.HazardStatus]string{
		models.StatusDraft:         "草稿",
		models.StatusPendingAssign: "待分派",
		models.StatusAssigned:      "已分派",
		models.StatusTransferred:   "已转办",
		models.StatusRectifying:    "整改中",
		models.StatusRechecking:    "复查中",
		models.StatusReturned:      "已退回",
		models.StatusRevisited:     "已回访",
		models.StatusClosed:        "已销项",
		models.StatusArchived:      "已归档",
	}
	if name, ok := m[status]; ok {
		return name
	}
	return string(status)
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
	if hazard.AbnormalTags == nil {
		hazard.AbnormalTags = []string{}
	}
	hazard.WarningLevel = calcWarningLevel(hazard.Deadline)

	attachments := h.getAttachments(id)
	records := h.getProcessRecords(id)
	auditNotes := h.getAuditNotes(id)
	abnormalReasons := h.getAbnormalReasons(id)

	nextHandlers := h.getNextHandlers(hazard.Status)

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"hazard":           hazard,
			"attachments":      attachments,
			"process_records":  records,
			"audit_notes":      auditNotes,
			"abnormal_reasons": abnormalReasons,
			"next_handlers":    nextHandlers,
		},
	})
}

func (h *Handler) getNextHandlers(status models.HazardStatus) []map[string]interface{} {
	handlers := []map[string]interface{}{}
	transitions, ok := validTransitions[status]
	if !ok {
		return handlers
	}
	seen := map[models.Role]bool{}
	for _, roles := range transitions {
		for _, r := range roles {
			if !seen[r] {
				seen[r] = true
				handlers = append(handlers, map[string]interface{}{
					"role":      r,
					"role_name": getRoleName(r),
				})
			}
		}
	}
	return handlers
}

func (h *Handler) CreateHazard(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user.Role != models.RoleClerk {
		jsonErrorDetail(w, http.StatusForbidden, "只有消防文员可以新建隐患单",
			map[string]interface{}{
				"fix_by_role": models.RoleClerk,
				"fix_by_name": getRoleName(models.RoleClerk),
				"error_code":  "permission_denied",
			})
		return
	}

	var req struct {
		Title       string          `json:"title"`
		Description string          `json:"description"`
		Location    string          `json:"location"`
		Priority    models.Priority `json:"priority"`
		Responsible string          `json:"responsible"`
		Deadline    string          `json:"deadline"`
		Attachments []string        `json:"attachments"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		jsonErrorDetail(w, http.StatusBadRequest, "标题不能为空",
			map[string]interface{}{"field": "title", "error_code": "required"})
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

	tx, err := db.DB.Begin()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "事务启动失败")
		return
	}
	defer tx.Rollback()

	result, err := tx.Exec(`INSERT INTO fire_hazards 
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

	for _, attName := range req.Attachments {
		if strings.TrimSpace(attName) != "" {
			tx.Exec(`INSERT INTO attachments (hazard_id, file_name, file_type, file_size, file_url, uploaded_by)
				VALUES (?, ?, ?, ?, ?, ?)`, id, attName, "描述附件", 0, "", user.Name)
		}
	}

	h.insertProcessRecordTx(tx, id, "create", "", models.StatusDraft, user, "新建隐患单", req.Attachments)

	if err = tx.Commit(); err != nil {
		jsonError(w, http.StatusInternalServerError, "提交失败")
		return
	}

	jsonResponse(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "创建成功",
		"data": map[string]interface{}{
			"id":        id,
			"hazard_no": hazardNo,
			"status":    models.StatusDraft,
			"version":   1,
		},
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

type ValidateResult struct {
	Valid        bool
	Message      string
	ErrorCode    string
	FixByRole    models.Role
	FixByName    string
	CurrentState interface{}
}

func (h *Handler) validateTransition(from, to models.HazardStatus, user *models.User) ValidateResult {
	if from == to {
		return ValidateResult{
			Valid:     false,
			Message:   "状态未发生变化",
			ErrorCode: "status_unchanged",
		}
	}
	transitions, ok := validTransitions[from]
	if !ok {
		return ValidateResult{
			Valid:     false,
			Message:   fmt.Sprintf("当前状态「%s」不允许流转", getStatusName(from)),
			ErrorCode: "invalid_from_status",
		}
	}
	allowedRoles, ok := transitions[to]
	if !ok {
		return ValidateResult{
			Valid:     false,
			Message:   fmt.Sprintf("不允许从「%s」流转到「%s」", getStatusName(from), getStatusName(to)),
			ErrorCode: "invalid_transition",
		}
	}
	for _, role := range allowedRoles {
		if user.Role == role {
			return ValidateResult{Valid: true}
		}
	}
	allowedNames := []string{}
	for _, r := range allowedRoles {
		allowedNames = append(allowedNames, getRoleName(r))
	}
	firstRole := models.Role("")
	if len(allowedRoles) > 0 {
		firstRole = allowedRoles[0]
	}
	return ValidateResult{
		Valid:     false,
		Message:   fmt.Sprintf("只有 %s 可以执行此操作，请切换角色或联系对应人员处理", strings.Join(allowedNames, "、")),
		ErrorCode: "role_permission",
		FixByRole: firstRole,
		FixByName: strings.Join(allowedNames, "、"),
	}
}

type ProcessActionRequest struct {
	Action         string              `json:"action"`
	ToStatus       models.HazardStatus `json:"to_status"`
	PageStatus     models.HazardStatus `json:"page_status"`
	Remark         string              `json:"remark"`
	ReturnReason   string              `json:"return_reason"`
	RectifyNotice  string              `json:"rectify_notice"`
	RecheckResult  string              `json:"recheck_result"`
	CurrentHandler string              `json:"current_handler"`
	Evidence       []string            `json:"evidence"`
	Attachments    []string            `json:"attachments"`
	AbnormalTags   []string            `json:"abnormal_tags"`
	Version        int64               `json:"version"`
}

func (h *Handler) validateRequiredEvidence(toStatus models.HazardStatus, req *ProcessActionRequest) ValidateResult {
	hasEvidence := len(req.Evidence) > 0 || len(req.Attachments) > 0

	switch toStatus {
	case models.StatusRectifying:
		if strings.TrimSpace(req.RectifyNotice) == "" {
			return ValidateResult{
				Valid:     false,
				Message:   "整改通知内容为必填证据，请补充后再提交",
				ErrorCode: "missing_rectify_notice",
				FixByRole: models.RoleSupervisor,
				FixByName: getRoleName(models.RoleSupervisor),
			}
		}
		if !hasEvidence {
			return ValidateResult{
				Valid:     false,
				Message:   "下发整改通知必须上传佐证材料（现场照片、整改通知书等）",
				ErrorCode: "missing_evidence",
				FixByRole: models.RoleSupervisor,
				FixByName: getRoleName(models.RoleSupervisor),
			}
		}
	case models.StatusRechecking:
		if strings.TrimSpace(req.RecheckResult) == "" {
			return ValidateResult{
				Valid:     false,
				Message:   "复查结果为必填证据，请补充后再提交",
				ErrorCode: "missing_recheck_result",
				FixByRole: models.RoleSupervisor,
				FixByName: getRoleName(models.RoleSupervisor),
			}
		}
		if !hasEvidence {
			return ValidateResult{
				Valid:     false,
				Message:   "提交复查销项必须上传佐证材料（复查照片、整改完成证明等）",
				ErrorCode: "missing_evidence",
				FixByRole: models.RoleSupervisor,
				FixByName: getRoleName(models.RoleSupervisor),
			}
		}
	case models.StatusRevisited:
		if !hasEvidence {
			return ValidateResult{
				Valid:     false,
				Message:   "确认回访必须上传佐证材料（回访记录、签字确认等）",
				ErrorCode: "missing_evidence",
				FixByRole: models.RoleStationChief,
				FixByName: getRoleName(models.RoleStationChief),
			}
		}
	case models.StatusClosed:
		if strings.TrimSpace(req.RecheckResult) == "" {
			return ValidateResult{
				Valid:     false,
				Message:   "销项归档必须填写复查结果",
				ErrorCode: "missing_recheck_result",
				FixByRole: models.RoleStationChief,
				FixByName: getRoleName(models.RoleStationChief),
			}
		}
		if !hasEvidence {
			return ValidateResult{
				Valid:     false,
				Message:   "销项归档必须上传完整佐证材料（复查记录、销项审批等）",
				ErrorCode: "missing_evidence",
				FixByRole: models.RoleStationChief,
				FixByName: getRoleName(models.RoleStationChief),
			}
		}
	case models.StatusReturned:
		if strings.TrimSpace(req.ReturnReason) == "" {
			return ValidateResult{
				Valid:     false,
				Message:   "退回补正必须填写退回原因",
				ErrorCode: "missing_return_reason",
			}
		}
	case models.StatusAssigned, models.StatusTransferred:
		if strings.TrimSpace(req.CurrentHandler) == "" {
			return ValidateResult{
				Valid:     false,
				Message:   "分派/转办必须指定处理人",
				ErrorCode: "missing_handler",
				FixByRole: models.RoleClerk,
				FixByName: getRoleName(models.RoleClerk),
			}
		}
	}
	return ValidateResult{Valid: true}
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
	var currentDeadline sql.NullTime
	var currentHazardNo string
	var currentTitle string
	err = tx.QueryRow("SELECT id, hazard_no, title, status, version, current_handler, deadline FROM fire_hazards WHERE id = ?", id).
		Scan(&id, &currentHazardNo, &currentTitle, &currentStatus, &currentVersion, &currentHandler, &currentDeadline)
	if err == sql.ErrNoRows {
		jsonError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "查询失败")
		return
	}

	if req.Version > 0 && req.Version != currentVersion {
		h.handleFailure(tx, id,
			fmt.Sprintf("版本冲突：页面 v%d / 后端 v%d", req.Version, currentVersion),
			"版本冲突", user.Name)
		jsonErrorDetail(w, http.StatusConflict,
			fmt.Sprintf("版本冲突：页面版本 v%d 与后端最新版本 v%d 不一致，请刷新后重试", req.Version, currentVersion),
			map[string]interface{}{
				"error_code":          "version_conflict",
				"page_version":        req.Version,
				"current_version":     currentVersion,
				"current_status":      currentStatus,
				"current_status_name": getStatusName(currentStatus),
				"fix_by_name":         currentHandler,
				"fix_suggestion":      "请刷新页面获取最新数据后再操作",
			})
		return
	}

	if req.PageStatus != "" && req.PageStatus != currentStatus {
		h.handleFailure(tx, id,
			fmt.Sprintf("状态冲突：页面「%s」/ 后端「%s」",
				getStatusName(req.PageStatus), getStatusName(currentStatus)),
			"状态冲突", user.Name)
		jsonErrorDetail(w, http.StatusConflict,
			fmt.Sprintf("状态冲突：页面状态「%s」与后端状态「%s」不一致，请刷新后重试",
				getStatusName(req.PageStatus), getStatusName(currentStatus)),
			map[string]interface{}{
				"error_code":          "status_conflict",
				"page_status":         req.PageStatus,
				"page_status_name":    getStatusName(req.PageStatus),
				"current_status":      currentStatus,
				"current_status_name": getStatusName(currentStatus),
				"current_version":     currentVersion,
				"fix_by_name":         currentHandler,
				"fix_suggestion":      "页面状态已过期，请刷新后重新操作",
			})
		return
	}

	deadline := time.Time{}
	if currentDeadline.Valid {
		deadline = currentDeadline.Time
	}
	warningLevel := calcWarningLevel(deadline)
	if warningLevel == models.WarningOverdue && req.ToStatus != models.StatusReturned && req.ToStatus != "" {
		h.handleFailure(tx, id, "已逾期不能直接推进", "逾期", user.Name)
		jsonErrorDetail(w, http.StatusBadRequest,
			"该隐患单已逾期，不能直接推进状态。请先在详情页补正或走退回补正流程",
			map[string]interface{}{
				"error_code":     "overdue_blocked",
				"deadline":       deadline.Format("2006-01-02 15:04"),
				"warning_level":  "overdue",
				"fix_by_role":    models.RoleSupervisor,
				"fix_by_name":    getRoleName(models.RoleSupervisor),
				"fix_suggestion": "可在详情页记录异常原因，或由防火监督员退回补正后重新推进",
			})
		return
	}

	handlerCheckStatus := []models.HazardStatus{
		models.StatusAssigned, models.StatusTransferred,
		models.StatusRectifying, models.StatusRechecking,
		models.StatusRevisited, models.StatusReturned,
	}
	isHandlerCheckRequired := false
	for _, s := range handlerCheckStatus {
		if currentStatus == s {
			isHandlerCheckRequired = true
			break
		}
	}
	if isHandlerCheckRequired && strings.TrimSpace(currentHandler) != "" &&
		strings.TrimSpace(currentHandler) != user.Name &&
		req.ToStatus != models.StatusReturned {
		h.handleFailure(tx, id,
			fmt.Sprintf("非当前处理人操作：%s 尝试操作，处理人为 %s", user.Name, currentHandler),
			"越权操作", user.Name)
		jsonErrorDetail(w, http.StatusForbidden,
			fmt.Sprintf("该隐患单当前处理人为「%s」，需由本人办理。请切换到对应用户或由当前处理人操作", currentHandler),
			map[string]interface{}{
				"error_code":      "not_current_handler",
				"current_handler": currentHandler,
				"operator":        user.Name,
				"fix_by_role":     "",
				"fix_by_name":     currentHandler,
				"fix_suggestion":  "请由当前处理人登录操作，或重新分派处理人",
			})
		return
	}

	if req.ToStatus != "" {
		vr := h.validateTransition(currentStatus, req.ToStatus, user)
		if !vr.Valid {
			h.handleFailure(tx, id,
				fmt.Sprintf("状态流转校验失败：%s → %s，原因：%s", currentStatus, req.ToStatus, vr.Message),
				"状态冲突", user.Name)
			detail := map[string]interface{}{
				"error_code":        vr.ErrorCode,
				"from_status":       currentStatus,
				"from_status_name":  getStatusName(currentStatus),
				"to_status":         req.ToStatus,
				"to_status_name":    getStatusName(req.ToStatus),
				"current_role":      user.Role,
				"current_role_name": getRoleName(user.Role),
			}
			if vr.FixByRole != "" {
				detail["fix_by_role"] = vr.FixByRole
				detail["fix_by_name"] = vr.FixByName
			}
			jsonErrorDetail(w, http.StatusForbidden, vr.Message, detail)
			return
		}
	}

	evr := h.validateRequiredEvidence(req.ToStatus, &req)
	if !evr.Valid {
		h.handleFailure(tx, id,
			fmt.Sprintf("必填证据缺失：%s", evr.Message),
			"缺材料", user.Name)
		detail := map[string]interface{}{
			"error_code":     evr.ErrorCode,
			"to_status":      req.ToStatus,
			"to_status_name": getStatusName(req.ToStatus),
		}
		if evr.FixByRole != "" {
			detail["fix_by_role"] = evr.FixByRole
			detail["fix_by_name"] = evr.FixByName
		}
		jsonErrorDetail(w, http.StatusBadRequest, evr.Message, detail)
		return
	}

	newStatus := currentStatus
	if req.ToStatus != "" {
		newStatus = req.ToStatus
	}
	newHandler := currentHandler
	if strings.TrimSpace(req.CurrentHandler) != "" {
		newHandler = strings.TrimSpace(req.CurrentHandler)
	}

	newTags := []string{}
	if len(req.AbnormalTags) > 0 {
		newTags = req.AbnormalTags
	}
	if warningLevel == models.WarningOverdue {
		hasOverdueTag := false
		for _, t := range newTags {
			if t == "已逾期" {
				hasOverdueTag = true
				break
			}
		}
		if !hasOverdueTag {
			newTags = append(newTags, "已逾期")
		}
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
	if strings.TrimSpace(req.RectifyNotice) != "" {
		updateFields = append(updateFields, "rectify_notice = ?")
		updateArgs = append(updateArgs, strings.TrimSpace(req.RectifyNotice))
	}
	if strings.TrimSpace(req.RecheckResult) != "" {
		updateFields = append(updateFields, "recheck_result = ?")
		updateArgs = append(updateArgs, strings.TrimSpace(req.RecheckResult))
	}
	if strings.TrimSpace(req.ReturnReason) != "" {
		updateFields = append(updateFields, "return_reason = ?")
		updateArgs = append(updateArgs, strings.TrimSpace(req.ReturnReason))
	}
	if len(newTags) > 0 {
		tagsJSON, _ := json.Marshal(newTags)
		updateFields = append(updateFields, "abnormal_tags = ?")
		updateArgs = append(updateArgs, string(tagsJSON))
	}

	updateArgs = append(updateArgs, id)
	updateArgs = append(updateArgs, currentVersion)
	updateSQL := fmt.Sprintf("UPDATE fire_hazards SET %s WHERE id = ? AND version = ?", strings.Join(updateFields, ", "))

	res, err := tx.Exec(updateSQL, updateArgs...)
	if err != nil {
		h.handleFailure(tx, id,
			fmt.Sprintf("更新数据库失败：%s", err.Error()),
			"系统错误", user.Name)
		log.Printf("更新隐患单失败: %v", err)
		jsonError(w, http.StatusInternalServerError, "处理失败")
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		h.handleFailure(tx, id,
			"更新冲突：状态或版本已在别处被修改",
			"更新冲突", user.Name)
		jsonErrorDetail(w, http.StatusConflict,
			"更新失败：状态或版本已在别处被修改，请刷新后重试",
			map[string]interface{}{
				"error_code":     "update_conflict",
				"fix_by_name":    currentHandler,
				"fix_suggestion": "请刷新页面获取最新状态后再操作",
			})
		return
	}

	for _, attName := range req.Attachments {
		if strings.TrimSpace(attName) != "" {
			tx.Exec(`INSERT INTO attachments (hazard_id, file_name, file_type, file_size, file_url, uploaded_by)
				VALUES (?, ?, ?, ?, ?, ?)`, id, attName, "办理附件", 0, "", user.Name)
		}
	}

	allEvidence := append([]string{}, req.Evidence...)
	allEvidence = append(allEvidence, req.Attachments...)
	h.insertProcessRecordTx(tx, id, req.Action, currentStatus, newStatus, user, req.Remark, allEvidence)

	if err = tx.Commit(); err != nil {
		jsonError(w, http.StatusInternalServerError, "提交失败")
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "处理成功",
		"data": map[string]interface{}{
			"id":              id,
			"hazard_no":       currentHazardNo,
			"title":           currentTitle,
			"status":          newStatus,
			"status_name":     getStatusName(newStatus),
			"version":         currentVersion + 1,
			"current_handler": newHandler,
		},
	})
}

type BatchItemRequest struct {
	ID         int64               `json:"id"`
	PageStatus models.HazardStatus `json:"page_status"`
	Version    int64               `json:"version"`
	Evidence   []string            `json:"evidence"`
}

type BatchRequest struct {
	Items          []BatchItemRequest  `json:"items"`
	Action         string              `json:"action"`
	ToStatus       models.HazardStatus `json:"to_status"`
	Remark         string              `json:"remark"`
	ReturnReason   string              `json:"return_reason"`
	RectifyNotice  string              `json:"rectify_notice"`
	RecheckResult  string              `json:"recheck_result"`
	CurrentHandler string              `json:"current_handler"`
	Evidence       []string            `json:"evidence"`
	Attachments    []string            `json:"attachments"`
}

type BatchResultItem struct {
	ID             int64               `json:"id"`
	HazardNo       string              `json:"hazard_no"`
	Title          string              `json:"title"`
	Success        bool                `json:"success"`
	Message        string              `json:"message"`
	ErrorCode      string              `json:"error_code"`
	FromStatus     models.HazardStatus `json:"from_status"`
	FromStatusName string              `json:"from_status_name"`
	ToStatus       models.HazardStatus `json:"to_status"`
	ToStatusName   string              `json:"to_status_name"`
	FixByRole      string              `json:"fix_by_role"`
	FixByName      string              `json:"fix_by_name"`
	CurrentVersion int64               `json:"current_version"`
	PageVersion    int64               `json:"page_version"`
	WarningLevel   string              `json:"warning_level"`
	Responsible    string              `json:"responsible"`
	CurrentHandler string              `json:"current_handler"`
}

func (h *Handler) BatchProcess(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	var req BatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	if len(req.Items) == 0 {
		jsonError(w, http.StatusBadRequest, "请选择要处理的隐患单")
		return
	}

	results := make([]BatchResultItem, 0, len(req.Items))

	for _, item := range req.Items {
		result := BatchResultItem{
			ID:          item.ID,
			Success:     false,
			PageVersion: item.Version,
		}

		tx, err := db.DB.Begin()
		if err != nil {
			result.Message = "事务启动失败"
			result.ErrorCode = "tx_error"
			results = append(results, result)
			continue
		}

		var currentStatus models.HazardStatus
		var currentVersion int64
		var currentHandler string
		var currentDeadline sql.NullTime
		var currentResponsible string
		var currentHazardNo string
		var currentTitle string
		err = tx.QueryRow("SELECT id, hazard_no, title, status, version, current_handler, deadline, responsible FROM fire_hazards WHERE id = ?", item.ID).
			Scan(&item.ID, &currentHazardNo, &currentTitle, &currentStatus, &currentVersion, &currentHandler, &currentDeadline, &currentResponsible)
		if err == sql.ErrNoRows {
			result.Message = "隐患单不存在"
			result.ErrorCode = "not_found"
			tx.Rollback()
			results = append(results, result)
			continue
		}
		if err != nil {
			result.Message = "查询失败"
			result.ErrorCode = "db_error"
			tx.Rollback()
			results = append(results, result)
			continue
		}

		result.HazardNo = currentHazardNo
		result.Title = currentTitle
		result.FromStatus = currentStatus
		result.FromStatusName = getStatusName(currentStatus)
		result.CurrentVersion = currentVersion
		result.CurrentHandler = currentHandler
		result.Responsible = currentResponsible
		result.ToStatus = req.ToStatus
		result.ToStatusName = getStatusName(req.ToStatus)

		if item.Version > 0 && item.Version != currentVersion {
			h.handleFailure(tx, item.ID,
				fmt.Sprintf("版本冲突：页面 v%d / 后端 v%d", item.Version, currentVersion),
				"版本冲突", user.Name)
			result.Message = fmt.Sprintf("版本冲突：页面 v%d / 后端 v%d", item.Version, currentVersion)
			result.ErrorCode = "version_conflict"
			if result.FixByRole == "" {
				result.FixByRole = string(user.Role)
			}
			if strings.TrimSpace(result.FixByName) == "" {
				if strings.TrimSpace(currentHandler) != "" {
					result.FixByName = currentHandler
				} else if strings.TrimSpace(currentResponsible) != "" {
					result.FixByName = currentResponsible
				}
			}
			results = append(results, result)
			continue
		}

		if item.PageStatus != "" && item.PageStatus != currentStatus {
			h.handleFailure(tx, item.ID,
				fmt.Sprintf("状态冲突：页面「%s」/ 后端「%s」",
					getStatusName(item.PageStatus), getStatusName(currentStatus)),
				"状态冲突", user.Name)
			result.Message = fmt.Sprintf("状态冲突：页面「%s」/ 后端「%s」",
				getStatusName(item.PageStatus), getStatusName(currentStatus))
			result.ErrorCode = "status_conflict"
			if strings.TrimSpace(result.FixByName) == "" {
				if strings.TrimSpace(currentHandler) != "" {
					result.FixByName = currentHandler
				} else if strings.TrimSpace(currentResponsible) != "" {
					result.FixByName = currentResponsible
				}
			}
			results = append(results, result)
			continue
		}

		deadline := time.Time{}
		if currentDeadline.Valid {
			deadline = currentDeadline.Time
		}
		warningLevel := calcWarningLevel(deadline)
		result.WarningLevel = string(warningLevel)

		if warningLevel == models.WarningOverdue && req.ToStatus != models.StatusReturned && req.ToStatus != "" {
			h.handleFailure(tx, item.ID, "已逾期不能直接推进", "逾期", user.Name)
			result.Message = "已逾期，不能直接推进。请先到详情页补正或退回"
			result.ErrorCode = "overdue_blocked"
			if result.FixByRole == "" {
				result.FixByRole = string(models.RoleSupervisor)
			}
			if strings.TrimSpace(result.FixByName) == "" {
				if strings.TrimSpace(currentHandler) != "" {
					result.FixByName = currentHandler
				} else if strings.TrimSpace(currentResponsible) != "" {
					result.FixByName = currentResponsible
				} else {
					result.FixByName = getRoleName(models.RoleSupervisor)
				}
			}
			results = append(results, result)
			continue
		}

		handlerCheckStatus := []models.HazardStatus{
			models.StatusAssigned, models.StatusTransferred,
			models.StatusRectifying, models.StatusRechecking,
			models.StatusRevisited, models.StatusReturned,
		}
		isHandlerCheckRequired := false
		for _, s := range handlerCheckStatus {
			if currentStatus == s {
				isHandlerCheckRequired = true
				break
			}
		}
		if isHandlerCheckRequired && strings.TrimSpace(currentHandler) != "" &&
			strings.TrimSpace(currentHandler) != user.Name &&
			req.ToStatus != models.StatusReturned {
			h.handleFailure(tx, item.ID,
				fmt.Sprintf("非当前处理人操作：%s 尝试操作，处理人为 %s", user.Name, currentHandler),
				"越权操作", user.Name)
			result.Message = fmt.Sprintf("非当前处理人：该单据处理人为「%s」", currentHandler)
			result.ErrorCode = "not_current_handler"
			if strings.TrimSpace(result.FixByName) == "" {
				result.FixByName = currentHandler
			}
			results = append(results, result)
			continue
		}

		if req.ToStatus != "" {
			vr := h.validateTransition(currentStatus, req.ToStatus, user)
			if !vr.Valid {
				h.handleFailure(tx, item.ID,
					fmt.Sprintf("状态流转校验失败：%s → %s，原因：%s", currentStatus, req.ToStatus, vr.Message),
					"状态冲突", user.Name)
				result.Message = vr.Message
				result.ErrorCode = vr.ErrorCode
				if vr.FixByRole != "" && result.FixByRole == "" {
					result.FixByRole = string(vr.FixByRole)
				}
				if vr.FixByName != "" && strings.TrimSpace(result.FixByName) == "" {
					result.FixByName = vr.FixByName
				}
				if strings.TrimSpace(result.FixByName) == "" {
					if strings.TrimSpace(currentHandler) != "" {
						result.FixByName = currentHandler
					} else if strings.TrimSpace(currentResponsible) != "" {
						result.FixByName = currentResponsible
					}
				}
				results = append(results, result)
				continue
			}
		}

		itemEvidence := item.Evidence
		if len(itemEvidence) == 0 {
			itemEvidence = req.Evidence
		}
		paReq := &ProcessActionRequest{
			ToStatus:       req.ToStatus,
			Remark:         req.Remark,
			ReturnReason:   req.ReturnReason,
			RectifyNotice:  req.RectifyNotice,
			RecheckResult:  req.RecheckResult,
			CurrentHandler: req.CurrentHandler,
			Evidence:       itemEvidence,
			Attachments:    req.Attachments,
		}
		evr := h.validateRequiredEvidence(req.ToStatus, paReq)
		if !evr.Valid {
			h.handleFailure(tx, item.ID,
				fmt.Sprintf("必填证据缺失：%s", evr.Message),
				"缺材料", user.Name)
			result.Message = evr.Message
			result.ErrorCode = evr.ErrorCode
			if evr.FixByRole != "" {
				result.FixByRole = string(evr.FixByRole)
			}
			if evr.FixByName != "" {
				result.FixByName = evr.FixByName
			} else if strings.TrimSpace(currentHandler) != "" {
				result.FixByName = currentHandler
			} else if strings.TrimSpace(currentResponsible) != "" {
				result.FixByName = currentResponsible
			}
			results = append(results, result)
			continue
		}

		newStatus := currentStatus
		if req.ToStatus != "" {
			newStatus = req.ToStatus
		}
		newHandler := currentHandler
		if strings.TrimSpace(req.CurrentHandler) != "" {
			newHandler = strings.TrimSpace(req.CurrentHandler)
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
		if strings.TrimSpace(req.RectifyNotice) != "" {
			updateFields = append(updateFields, "rectify_notice = ?")
			updateArgs = append(updateArgs, strings.TrimSpace(req.RectifyNotice))
		}
		if strings.TrimSpace(req.RecheckResult) != "" {
			updateFields = append(updateFields, "recheck_result = ?")
			updateArgs = append(updateArgs, strings.TrimSpace(req.RecheckResult))
		}
		if strings.TrimSpace(req.ReturnReason) != "" {
			updateFields = append(updateFields, "return_reason = ?")
			updateArgs = append(updateArgs, strings.TrimSpace(req.ReturnReason))
		}
		updateArgs = append(updateArgs, item.ID)
		updateArgs = append(updateArgs, currentVersion)
		updateSQL := fmt.Sprintf("UPDATE fire_hazards SET %s WHERE id = ? AND version = ?", strings.Join(updateFields, ", "))

		res, err := tx.Exec(updateSQL, updateArgs...)
		if err != nil {
			h.handleFailure(tx, item.ID,
				fmt.Sprintf("更新数据库失败：%s", err.Error()),
				"系统错误", user.Name)
			result.Message = "更新失败：" + err.Error()
			result.ErrorCode = "update_error"
			if strings.TrimSpace(result.FixByName) == "" {
				if strings.TrimSpace(currentHandler) != "" {
					result.FixByName = currentHandler
				} else if strings.TrimSpace(currentResponsible) != "" {
					result.FixByName = currentResponsible
				}
			}
			results = append(results, result)
			continue
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			h.handleFailure(tx, item.ID,
				"更新冲突：状态或版本已在别处被修改",
				"更新冲突", user.Name)
			result.Message = "状态冲突或已被他人修改，请刷新后重试"
			result.ErrorCode = "update_conflict"
			if strings.TrimSpace(result.FixByName) == "" {
				if strings.TrimSpace(currentHandler) != "" {
					result.FixByName = currentHandler
				} else if strings.TrimSpace(currentResponsible) != "" {
					result.FixByName = currentResponsible
				}
			}
			results = append(results, result)
			continue
		}

		for _, attName := range req.Attachments {
			if strings.TrimSpace(attName) != "" {
				tx.Exec(`INSERT INTO attachments (hazard_id, file_name, file_type, file_size, file_url, uploaded_by)
					VALUES (?, ?, ?, ?, ?, ?)`, item.ID, attName, "批量办理附件", 0, "", user.Name)
			}
		}

		allEvidence := append([]string{}, itemEvidence...)
		allEvidence = append(allEvidence, req.Attachments...)
		h.insertProcessRecordTx(tx, item.ID, req.Action, currentStatus, newStatus, user, req.Remark, allEvidence)

		if err = tx.Commit(); err != nil {
			h.handleFailure(tx, item.ID,
				fmt.Sprintf("事务提交失败：%s", err.Error()),
				"系统错误", user.Name)
			result.Message = "提交失败"
			result.ErrorCode = "commit_error"
			if strings.TrimSpace(result.FixByName) == "" {
				if strings.TrimSpace(currentHandler) != "" {
					result.FixByName = currentHandler
				} else if strings.TrimSpace(currentResponsible) != "" {
					result.FixByName = currentResponsible
				}
			}
			results = append(results, result)
			continue
		}

		result.Success = true
		result.Message = fmt.Sprintf("处理成功：%s → %s", getStatusName(currentStatus), getStatusName(newStatus))
		result.CurrentVersion = currentVersion + 1
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

func (h *Handler) AddAttachment(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, http.StatusBadRequest, "无效的ID")
		return
	}

	var req struct {
		FileName string `json:"file_name"`
		FileType string `json:"file_type"`
		FileURL  string `json:"file_url"`
		FileSize int64  `json:"file_size"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	if strings.TrimSpace(req.FileName) == "" {
		jsonError(w, http.StatusBadRequest, "文件名不能为空")
		return
	}

	result, err := db.DB.Exec(`INSERT INTO attachments (hazard_id, file_name, file_type, file_size, file_url, uploaded_by)
		VALUES (?, ?, ?, ?, ?, ?)`,
		id, strings.TrimSpace(req.FileName), req.FileType, req.FileSize, req.FileURL, user.Name)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "添加附件失败")
		return
	}

	attID, _ := result.LastInsertId()
	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "附件已添加",
		"data": map[string]interface{}{
			"id":          attID,
			"hazard_id":   id,
			"file_name":   req.FileName,
			"uploaded_by": user.Name,
		},
	})
}

func (h *Handler) DeleteAttachment(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	attID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, http.StatusBadRequest, "无效的ID")
		return
	}

	_, err = db.DB.Exec("DELETE FROM attachments WHERE id = ?", attID)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "删除失败")
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "附件已删除",
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
	if strings.TrimSpace(req.Content) == "" {
		jsonError(w, http.StatusBadRequest, "备注内容不能为空")
		return
	}

	result, err := db.DB.Exec(`INSERT INTO audit_notes (hazard_id, content, auditor, auditor_role) VALUES (?, ?, ?, ?)`,
		id, strings.TrimSpace(req.Content), user.Name, user.Role)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "添加备注失败")
		return
	}

	noteID, _ := result.LastInsertId()
	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "备注已添加",
		"data": map[string]interface{}{
			"id":      noteID,
			"auditor": user.Name,
			"content": req.Content,
		},
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
	if strings.TrimSpace(req.Reason) == "" {
		jsonError(w, http.StatusBadRequest, "异常原因不能为空")
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "事务启动失败")
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`INSERT INTO abnormal_reasons (hazard_id, reason, category, reported_by) VALUES (?, ?, ?, ?)`,
		id, strings.TrimSpace(req.Reason), req.Category, user.Name)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "添加异常原因失败")
		return
	}

	var abnormalTagsStr string
	tx.QueryRow("SELECT abnormal_tags FROM fire_hazards WHERE id = ?", id).Scan(&abnormalTagsStr)
	tags := []string{}
	json.Unmarshal([]byte(abnormalTagsStr), &tags)
	if req.Category != "" {
		hasCat := false
		for _, t := range tags {
			if t == req.Category {
				hasCat = true
				break
			}
		}
		if !hasCat {
			tags = append(tags, req.Category)
		}
	}
	if len(tags) > 0 {
		tagsJSON, _ := json.Marshal(tags)
		tx.Exec("UPDATE fire_hazards SET abnormal_tags = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
			string(tagsJSON), id)
	}

	tx.Commit()

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
		statusDist = append(statusDist, map[string]interface{}{
			"status":      s,
			"status_name": getStatusName(models.HazardStatus(s)),
			"count":       c,
		})
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
		if r.Evidence == nil {
			r.Evidence = []string{}
		}
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

func (h *Handler) insertAbnormalReasonTx(tx *sql.Tx, hazardID int64, reason string, category string, reportedBy string) {
	if tx == nil {
		return
	}
	tx.Exec(`INSERT INTO abnormal_reasons (hazard_id, reason, category, reported_by, resolved) 
		VALUES (?, ?, ?, ?, 0)`, hazardID, reason, category, reportedBy)
}

func (h *Handler) insertAbnormalReason(hazardID int64, reason string, category string, reportedBy string) {
	db.DB.Exec(`INSERT INTO abnormal_reasons (hazard_id, reason, category, reported_by, resolved) 
		VALUES (?, ?, ?, ?, 0)`, hazardID, reason, category, reportedBy)
	if category != "" {
		var abnormalTagsStr string
		db.DB.QueryRow("SELECT abnormal_tags FROM fire_hazards WHERE id = ?", hazardID).Scan(&abnormalTagsStr)
		tags := []string{}
		json.Unmarshal([]byte(abnormalTagsStr), &tags)
		hasCat := false
		for _, t := range tags {
			if t == category {
				hasCat = true
				break
			}
		}
		if !hasCat {
			tags = append(tags, category)
			tagsJSON, _ := json.Marshal(tags)
			db.DB.Exec("UPDATE fire_hazards SET abnormal_tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
				string(tagsJSON), hazardID)
		}
	}
}

func (h *Handler) handleFailure(tx *sql.Tx, hazardID int64, reason string, category string, reportedBy string) {
	if tx != nil {
		tx.Rollback()
	}
	h.insertAbnormalReason(hazardID, reason, category, reportedBy)
}
