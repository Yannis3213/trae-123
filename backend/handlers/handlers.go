package handlers

import (
	"database/sql"
	"net/http"
	"time"
	"vocational-school/database"
	"vocational-school/middleware"
	"vocational-school/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	var user models.User
	err := database.DB.QueryRow(
		"SELECT id, username, password, name, role FROM users WHERE username = ?",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.Password, &user.Name, &user.Role)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "数据库错误"})
		return
	}
	if user.Password != req.Password {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	token, err := middleware.GenerateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成令牌失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"name":     user.Name,
			"role":     user.Role,
		},
	})
}

func GetCurrentUser(c *gin.Context) {
	userID, username, name, role := middleware.GetCurrentUser(c)
	c.JSON(http.StatusOK, gin.H{
		"id":       userID,
		"username": username,
		"name":     name,
		"role":     role,
	})
}

func ListApplications(c *gin.Context) {
	userID, _, _, role := middleware.GetCurrentUser(c)
	status := c.Query("status")
	urgency := c.Query("urgency")

	query := `SELECT id, student_name, id_card, phone, program, status,
		current_handler, current_handler_name, current_handler_role,
		next_handler, next_handler_name, next_handler_role,
		assignment_deadline, audit_deadline, review_deadline,
		created_at, updated_at, version, urgency,
		responsible_person, responsible_person_name,
		materials_complete, class_assigned, payment_confirmed
		FROM student_applications WHERE 1=1`
	args := []interface{}{}

	if role == models.RoleRegistrar || role == models.RoleAuditor || role == models.RoleReviewer {
		query += " AND (current_handler = ? OR current_handler_role = ?)"
		args = append(args, userID, string(role))
	}

	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}
	if urgency != "" {
		query += " AND urgency = ?"
		args = append(args, urgency)
	}
	query += " ORDER BY urgency DESC, created_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败: " + err.Error()})
		return
	}
	defer rows.Close()

	apps := make([]*models.StudentApplication, 0)
	for rows.Next() {
		app, err := database.ScanApplication(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "扫描数据失败"})
			return
		}
		apps = append(apps, app)
	}

	c.JSON(http.StatusOK, apps)
}

func GetApplication(c *gin.Context) {
	id := c.Param("id")
	_, _, _, role := middleware.GetCurrentUser(c)

	query := `SELECT id, student_name, id_card, phone, program, status,
		current_handler, current_handler_name, current_handler_role,
		next_handler, next_handler_name, next_handler_role,
		assignment_deadline, audit_deadline, review_deadline,
		created_at, updated_at, version, urgency,
		responsible_person, responsible_person_name,
		materials_complete, class_assigned, payment_confirmed
		FROM student_applications WHERE id = ?`
	row := database.DB.QueryRow(query, id)
	app, err := database.ScanApplicationRow(row)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "报名单不存在"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}

	attachments := make([]*models.Attachment, 0)
	attRows, err := database.DB.Query(
		"SELECT id, application_id, type, name, uploaded_by, uploaded_at, verified FROM attachments WHERE application_id = ? ORDER BY uploaded_at",
		id,
	)
	if err == nil {
		defer attRows.Close()
		for attRows.Next() {
			var att models.Attachment
			var verified int
			attRows.Scan(&att.ID, &att.ApplicationID, &att.Type, &att.Name, &att.UploadedBy, &att.UploadedAt, &verified)
			att.Verified = verified == 1
			attachments = append(attachments, &att)
		}
	}

	records := make([]*models.ProcessingRecord, 0)
	recRows, err := database.DB.Query(
		`SELECT id, application_id, action, handler_id, handler_name, handler_role,
		 previous_status, new_status, previous_handler, new_handler,
		 remark, created_at, version, is_correction
		 FROM processing_records WHERE application_id = ? ORDER BY created_at, version`,
		id,
	)
	if err == nil {
		defer recRows.Close()
		for recRows.Next() {
			var rec models.ProcessingRecord
			var isCorrection int
			recRows.Scan(&rec.ID, &rec.ApplicationID, &rec.Action, &rec.HandlerID, &rec.HandlerName, &rec.HandlerRole,
				&rec.PreviousStatus, &rec.NewStatus, &rec.PreviousHandler, &rec.NewHandler,
				&rec.Remark, &rec.CreatedAt, &rec.Version, &isCorrection)
			rec.IsCorrection = isCorrection == 1
			records = append(records, &rec)
		}
	}

	notes := make([]*models.AuditNote, 0)
	noteRows, err := database.DB.Query(
		"SELECT id, application_id, user_id, user_name, content, created_at FROM audit_notes WHERE application_id = ? ORDER BY created_at",
		id,
	)
	if err == nil {
		defer noteRows.Close()
		for noteRows.Next() {
			var note models.AuditNote
			noteRows.Scan(&note.ID, &note.ApplicationID, &note.UserID, &note.UserName, &note.Content, &note.CreatedAt)
			notes = append(notes, &note)
		}
	}

	exceptions := make([]*models.ExceptionRecord, 0)
	excRows, err := database.DB.Query(
		`SELECT id, application_id, type, reason, triggered_by, triggered_by_name, triggered_at, resolved, 
		 COALESCE(resolved_at, '0001-01-01 00:00:00'), COALESCE(resolution_note, '')
		 FROM exception_records WHERE application_id = ? ORDER BY triggered_at DESC`,
		id,
	)
	if err == nil {
		defer excRows.Close()
		for excRows.Next() {
			var exc models.ExceptionRecord
			var resolved int
			excRows.Scan(&exc.ID, &exc.ApplicationID, &exc.Type, &exc.Reason, &exc.TriggeredBy, &exc.TriggeredByName,
				&exc.TriggeredAt, &resolved, &exc.ResolvedAt, &exc.ResolutionNote)
			exc.Resolved = resolved == 1
			exceptions = append(exceptions, &exc)
		}
	}

	var evidenceSummary models.EvidenceSummary
	evidenceSummary.MaterialsCount = len(attachments)
	evidenceSummary.MaterialsOK = app.MaterialsComplete && len(attachments) >= 4
	evidenceSummary.ClassOK = app.ClassAssigned
	evidenceSummary.PaymentOK = app.PaymentConfirmed
	evidenceSummary.AllComplete = evidenceSummary.MaterialsOK && evidenceSummary.ClassOK && evidenceSummary.PaymentOK

	c.JSON(http.StatusOK, gin.H{
		"application":      app,
		"attachments":      attachments,
		"records":          records,
		"notes":            notes,
		"exceptions":       exceptions,
		"evidence_summary": evidenceSummary,
		"current_role":     role,
	})
}

type ProcessRequest struct {
	Action  string `json:"action" binding:"required"`
	Remark  string `json:"remark"`
	Version int    `json:"version" binding:"required"`
}

func validateEvidence(app *models.StudentApplication) (bool, string) {
	if !app.MaterialsComplete {
		return false, "报名资料不完整，缺少必要材料"
	}
	if !app.ClassAssigned {
		return false, "班级未分配，请先完成班级分配"
	}
	if !app.PaymentConfirmed {
		return false, "缴费未确认，请先确认缴费"
	}
	return true, ""
}

func checkDeadline(app *models.StudentApplication, role models.Role) (bool, string) {
	now := time.Now()
	switch role {
	case models.RoleRegistrar:
		if now.After(app.AssignmentDeadline) {
			return false, "分派节点已逾期"
		}
	case models.RoleAuditor:
		if now.After(app.AuditDeadline) {
			return false, "审核节点已逾期"
		}
	case models.RoleReviewer:
		if now.After(app.ReviewDeadline) {
			return false, "复核节点已逾期"
		}
	}
	return true, ""
}

type ValidationResult struct {
	Pass     bool
	HTTPStatus int
	ErrorMsg string
	ExcType  string
}

type ActionConfig struct {
	RequiredRole          models.Role
	RequiredStatus        models.ApplicationStatus
	NeedsEvidence         bool
	NeedsDeadline         bool
	IsCorrection          bool
	TargetStatus          models.ApplicationStatus
	TargetHandlerRole     models.Role
	NextHandlerRole       models.Role
	UpdateResponsible     bool
}

var actionConfigs = map[string]ActionConfig{
	"assign": {
		RequiredRole:      models.RoleRegistrar,
		RequiredStatus:    models.StatusPending,
		NeedsEvidence:     true,
		NeedsDeadline:     true,
		IsCorrection:      false,
		TargetStatus:      models.StatusTransferred,
		TargetHandlerRole: models.RoleAuditor,
		NextHandlerRole:   models.RoleReviewer,
		UpdateResponsible: true,
	},
	"audit_pass": {
		RequiredRole:      models.RoleAuditor,
		RequiredStatus:    models.StatusTransferred,
		NeedsEvidence:     true,
		NeedsDeadline:     true,
		IsCorrection:      false,
		TargetStatus:      models.StatusVisited,
		TargetHandlerRole: models.RoleReviewer,
		NextHandlerRole:   "",
		UpdateResponsible: true,
	},
	"audit_reject": {
		RequiredRole:      models.RoleAuditor,
		RequiredStatus:    models.StatusTransferred,
		NeedsEvidence:     false,
		NeedsDeadline:     false,
		IsCorrection:      true,
		TargetStatus:      models.StatusPending,
		TargetHandlerRole: models.RoleRegistrar,
		NextHandlerRole:   models.RoleAuditor,
		UpdateResponsible: true,
	},
	"review_archive": {
		RequiredRole:      models.RoleReviewer,
		RequiredStatus:    models.StatusVisited,
		NeedsEvidence:     true,
		NeedsDeadline:     true,
		IsCorrection:      false,
		TargetStatus:      models.StatusVisited,
		TargetHandlerRole: "",
		NextHandlerRole:   "",
		UpdateResponsible: false,
	},
	"supplement": {
		RequiredRole:      models.RoleRegistrar,
		RequiredStatus:    models.StatusPending,
		NeedsEvidence:     false,
		NeedsDeadline:     false,
		IsCorrection:      true,
		TargetStatus:      models.StatusPending,
		TargetHandlerRole: models.RoleRegistrar,
		NextHandlerRole:   models.RoleAuditor,
		UpdateResponsible: false,
	},
}

func validateAndPrepare(action string, app *models.StudentApplication, userID string, userName string, role models.Role, version int) ValidationResult {
	cfg, ok := actionConfigs[action]
	if !ok {
		return ValidationResult{Pass: false, HTTPStatus: http.StatusBadRequest, ErrorMsg: "未知操作类型", ExcType: "invalid_action"}
	}

	if version != app.Version {
		return ValidationResult{Pass: false, HTTPStatus: http.StatusConflict, ErrorMsg: "版本冲突：当前数据已更新，请刷新后重试", ExcType: "version_conflict"}
	}

	if app.CurrentHandler != userID && app.CurrentHandlerRole != role {
		return ValidationResult{Pass: false, HTTPStatus: http.StatusForbidden, ErrorMsg: "权限不足，您不是当前处理人", ExcType: "permission_denied"}
	}

	if role != cfg.RequiredRole {
		return ValidationResult{Pass: false, HTTPStatus: http.StatusForbidden, ErrorMsg: "角色权限不匹配", ExcType: "permission_denied"}
	}

	if app.Status != cfg.RequiredStatus {
		return ValidationResult{Pass: false, HTTPStatus: http.StatusBadRequest, ErrorMsg: "状态冲突：当前状态不是" + string(cfg.RequiredStatus), ExcType: "status_conflict"}
	}

	if cfg.NeedsEvidence {
		ok, reason := validateEvidence(app)
		if !ok {
			return ValidationResult{Pass: false, HTTPStatus: http.StatusBadRequest, ErrorMsg: reason, ExcType: "missing_evidence"}
		}
	}

	if cfg.NeedsDeadline {
		ok, reason := checkDeadline(app, role)
		if !ok {
			return ValidationResult{Pass: false, HTTPStatus: http.StatusBadRequest, ErrorMsg: reason, ExcType: "overdue"}
		}
	}

	return ValidationResult{Pass: true}
}

func getUserByRole(role models.Role) (string, string) {
	var id, name string
	database.DB.QueryRow("SELECT id, name FROM users WHERE role = ?", string(role)).Scan(&id, &name)
	return id, name
}

func recordExceptionPersistence(appID, excType, reason, userID, userName string) {
	database.DB.Exec(`INSERT INTO exception_records 
		(id, application_id, type, reason, triggered_by, triggered_by_name, triggered_at, resolved)
		VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
		uuid.NewString(), appID, excType, reason, userID, userName, time.Now(),
	)
}

func ProcessApplication(c *gin.Context) {
	id := c.Param("id")
	userID, userName, _, role := middleware.GetCurrentUser(c)

	var req ProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误", "success": false})
		return
	}

	cfg, cfgOk := actionConfigs[req.Action]
	if !cfgOk {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未知操作类型", "success": false})
		return
	}

	var app models.StudentApplication
	var materialsOK, classOK, paymentOK int
	err := database.DB.QueryRow(`SELECT id, student_name, id_card, phone, program, status,
		current_handler, current_handler_name, current_handler_role,
		next_handler, next_handler_name, next_handler_role,
		assignment_deadline, audit_deadline, review_deadline,
		created_at, updated_at, version, urgency,
		responsible_person, responsible_person_name,
		materials_complete, class_assigned, payment_confirmed
		FROM student_applications WHERE id = ?`, id).Scan(
		&app.ID, &app.StudentName, &app.IdCard, &app.Phone, &app.Program,
		&app.Status, &app.CurrentHandler, &app.CurrentHandlerName, &app.CurrentHandlerRole,
		&app.NextHandler, &app.NextHandlerName, &app.NextHandlerRole,
		&app.AssignmentDeadline, &app.AuditDeadline, &app.ReviewDeadline,
		&app.CreatedAt, &app.UpdatedAt, &app.Version, &app.Urgency,
		&app.ResponsiblePerson, &app.ResponsiblePersonName,
		&materialsOK, &classOK, &paymentOK,
	)
	app.MaterialsComplete = materialsOK == 1
	app.ClassAssigned = classOK == 1
	app.PaymentConfirmed = paymentOK == 1

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "报名单不存在", "success": false})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败", "success": false})
		return
	}

	vr := validateAndPrepare(req.Action, &app, userID, userName, role, req.Version)
	if !vr.Pass {
		recordExceptionPersistence(id, vr.ExcType, vr.ErrorMsg, userID, userName)
		c.JSON(vr.HTTPStatus, gin.H{"error": vr.ErrorMsg, "success": false})
		return
	}

	newStatus := cfg.TargetStatus
	newHandlerID, newHandlerName := getUserByRole(cfg.TargetHandlerRole)
	nextHandlerID, nextHandlerName := "", ""
	if cfg.NextHandlerRole != "" {
		nextHandlerID, nextHandlerName = getUserByRole(cfg.NextHandlerRole)
	}
	isCorrection := cfg.IsCorrection

	responsiblePerson := app.ResponsiblePerson
	responsiblePersonName := app.ResponsiblePersonName
	if cfg.UpdateResponsible && cfg.TargetHandlerRole != "" {
		responsiblePerson = newHandlerID
		responsiblePersonName = newHandlerName
	}

	if req.Action == "audit_reject" {
		recordExceptionPersistence(id, "return_correction", "退回补正: "+req.Remark, userID, userName)
	}

	now := time.Now()
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "事务启动失败", "success": false})
		return
	}
	defer tx.Rollback()

	result, err := tx.Exec(`UPDATE student_applications SET 
		status = ?, current_handler = ?, current_handler_name = ?, current_handler_role = ?,
		next_handler = ?, next_handler_name = ?, next_handler_role = ?,
		responsible_person = ?, responsible_person_name = ?,
		updated_at = ?, version = version + 1
		WHERE id = ? AND version = ?`,
		string(newStatus), newHandlerID, newHandlerName, string(cfg.TargetHandlerRole),
		nextHandlerID, nextHandlerName, string(cfg.NextHandlerRole),
		responsiblePerson, responsiblePersonName,
		now, id, req.Version,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败: " + err.Error(), "success": false})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		recordExceptionPersistence(id, "version_conflict", "版本冲突：更新时数据已变化", userID, userName)
		c.JSON(http.StatusConflict, gin.H{"error": "版本冲突：数据已被修改，请刷新后重试", "success": false})
		return
	}

	_, err = tx.Exec(`INSERT INTO processing_records 
		(id, application_id, action, handler_id, handler_name, handler_role,
		 previous_status, new_status, previous_handler, new_handler,
		 remark, created_at, version, is_correction)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), id, req.Action, userID, userName, string(role),
		string(app.Status), string(newStatus), app.CurrentHandler, newHandlerID,
		req.Remark, now, req.Version+1, isCorrection,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "记录处理日志失败: " + err.Error(), "success": false})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "提交事务失败", "success": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"new_status":    newStatus,
		"new_handler":   newHandlerName,
		"next_handler":  nextHandlerName,
		"new_version":   req.Version + 1,
		"application_id": id,
		"message":       "操作成功",
	})
}

func BatchProcess(c *gin.Context) {
	userID, userName, _, role := middleware.GetCurrentUser(c)

	var req struct {
		IDs    []string `json:"ids" binding:"required"`
		Action string   `json:"action" binding:"required"`
		Remark string   `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	_, cfgOk := actionConfigs[req.Action]
	if !cfgOk {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的批量操作: " + req.Action})
		return
	}

	results := make([]*models.BatchResult, 0)

	for _, id := range req.IDs {
		result := &models.BatchResult{ApplicationID: id}

		var app models.StudentApplication
		var materialsOK, classOK, paymentOK int
		err := database.DB.QueryRow(`SELECT id, student_name, id_card, phone, program, status,
			current_handler, current_handler_name, current_handler_role,
			next_handler, next_handler_name, next_handler_role,
			assignment_deadline, audit_deadline, review_deadline,
			created_at, updated_at, version, urgency,
			responsible_person, responsible_person_name,
			materials_complete, class_assigned, payment_confirmed
			FROM student_applications WHERE id = ?`, id).Scan(
			&app.ID, &app.StudentName, &app.IdCard, &app.Phone, &app.Program,
			&app.Status, &app.CurrentHandler, &app.CurrentHandlerName, &app.CurrentHandlerRole,
			&app.NextHandler, &app.NextHandlerName, &app.NextHandlerRole,
			&app.AssignmentDeadline, &app.AuditDeadline, &app.ReviewDeadline,
			&app.CreatedAt, &app.UpdatedAt, &app.Version, &app.Urgency,
			&app.ResponsiblePerson, &app.ResponsiblePersonName,
			&materialsOK, &classOK, &paymentOK,
		)
		app.MaterialsComplete = materialsOK == 1
		app.ClassAssigned = classOK == 1
		app.PaymentConfirmed = paymentOK == 1

		result.StudentName = app.StudentName

		if err == sql.ErrNoRows {
			result.Success = false
			result.Reason = "报名单不存在"
			results = append(results, result)
			continue
		}
		if err != nil {
			result.Success = false
			result.Reason = "查询失败: " + err.Error()
			results = append(results, result)
			continue
		}

		vr := validateAndPrepare(req.Action, &app, userID, userName, role, app.Version)
		if !vr.Pass {
			recordExceptionPersistence(id, vr.ExcType, vr.ErrorMsg, userID, userName)
			result.Success = false
			result.Reason = vr.ErrorMsg
			results = append(results, result)
			continue
		}

		cfg := actionConfigs[req.Action]
		newStatus := cfg.TargetStatus
		newHandlerID, newHandlerName := getUserByRole(cfg.TargetHandlerRole)
		nextHandlerID, nextHandlerName := "", ""
		if cfg.NextHandlerRole != "" {
			nextHandlerID, nextHandlerName = getUserByRole(cfg.NextHandlerRole)
		}
		isCorrection := cfg.IsCorrection

		responsiblePerson := app.ResponsiblePerson
		responsiblePersonName := app.ResponsiblePersonName
		if cfg.UpdateResponsible && cfg.TargetHandlerRole != "" {
			responsiblePerson = newHandlerID
			responsiblePersonName = newHandlerName
		}

		now := time.Now()
		tx, err := database.DB.Begin()
		if err != nil {
			result.Success = false
			result.Reason = "事务启动失败"
			results = append(results, result)
			continue
		}

		updateResult, err := tx.Exec(`UPDATE student_applications SET 
			status = ?, current_handler = ?, current_handler_name = ?, current_handler_role = ?,
			next_handler = ?, next_handler_name = ?, next_handler_role = ?,
			responsible_person = ?, responsible_person_name = ?,
			updated_at = ?, version = version + 1
			WHERE id = ? AND version = ?`,
			string(newStatus), newHandlerID, newHandlerName, string(cfg.TargetHandlerRole),
			nextHandlerID, nextHandlerName, string(cfg.NextHandlerRole),
			responsiblePerson, responsiblePersonName,
			now, id, app.Version,
		)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Reason = "更新失败: " + err.Error()
			results = append(results, result)
			continue
		}
		affected, _ := updateResult.RowsAffected()
		if affected == 0 {
			tx.Rollback()
			recordExceptionPersistence(id, "version_conflict", "批量处理版本冲突", userID, userName)
			result.Success = false
			result.Reason = "版本冲突：数据已被修改"
			results = append(results, result)
			continue
		}

		_, err = tx.Exec(`INSERT INTO processing_records 
			(id, application_id, action, handler_id, handler_name, handler_role,
			 previous_status, new_status, previous_handler, new_handler,
			 remark, created_at, version, is_correction)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			uuid.NewString(), id, req.Action, userID, userName, string(role),
			string(app.Status), string(newStatus), app.CurrentHandler, newHandlerID,
			req.Remark, now, app.Version+1, isCorrection,
		)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Reason = "记录处理日志失败"
			results = append(results, result)
			continue
		}

		if err := tx.Commit(); err != nil {
			result.Success = false
			result.Reason = "提交事务失败"
			results = append(results, result)
			continue
		}

		result.Success = true
		if newHandlerName != "" {
			result.Reason = "处理成功，流转至：" + newHandlerName
		} else {
			result.Reason = "处理成功，已归档"
		}
		results = append(results, result)
	}

	successCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"results":       results,
		"total":         len(results),
		"success_count": successCount,
		"fail_count":    len(results) - successCount,
	})
}

func GetStatistics(c *gin.Context) {
	userID, _, _, role := middleware.GetCurrentUser(c)

	var total, pending, transferred, visited int
	var normal, warning, overdue int

	query := "SELECT COUNT(*) FROM student_applications WHERE 1=1"
	args := []interface{}{}
	if role == models.RoleRegistrar || role == models.RoleAuditor || role == models.RoleReviewer {
		query += " AND (current_handler = ? OR current_handler_role = ?)"
		args = append(args, userID, string(role))
	}
	database.DB.QueryRow(query, args...).Scan(&total)

	database.DB.QueryRow(query+" AND status = '待分派'", args...).Scan(&pending)
	database.DB.QueryRow(query+" AND status = '已转办'", args...).Scan(&transferred)
	database.DB.QueryRow(query+" AND status = '已回访'", args...).Scan(&visited)

	database.DB.QueryRow(query+" AND urgency = 'normal'", args...).Scan(&normal)
	database.DB.QueryRow(query+" AND urgency = 'warning'", args...).Scan(&warning)
	database.DB.QueryRow(query+" AND urgency = 'overdue'", args...).Scan(&overdue)

	c.JSON(http.StatusOK, gin.H{
		"total":       total,
		"pending":     pending,
		"transferred": transferred,
		"visited":     visited,
		"urgency": gin.H{
			"normal":  normal,
			"warning": warning,
			"overdue": overdue,
		},
	})
}

func AddAuditNote(c *gin.Context) {
	id := c.Param("id")
	userID, userName, _, _ := middleware.GetCurrentUser(c)

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	var exists int
	database.DB.QueryRow("SELECT COUNT(*) FROM student_applications WHERE id = ?", id).Scan(&exists)
	if exists == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "报名单不存在"})
		return
	}

	_, err := database.DB.Exec(
		"INSERT INTO audit_notes (id, application_id, user_id, user_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		uuid.NewString(), id, userID, userName, req.Content, time.Now(),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "添加备注失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "备注添加成功"})
}

func ListUsers(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, username, name, role FROM users ORDER BY role")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询用户失败"})
		return
	}
	defer rows.Close()

	users := make([]gin.H, 0)
	for rows.Next() {
		var u models.User
		rows.Scan(&u.ID, &u.Username, &u.Name, &u.Role)
		users = append(users, gin.H{
			"id":       u.ID,
			"username": u.Username,
			"name":     u.Name,
			"role":     u.Role,
		})
	}
	c.JSON(http.StatusOK, users)
}
