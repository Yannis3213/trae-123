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
			"id":   user.ID,
			"username": user.Username,
			"name": user.Name,
			"role": user.Role,
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
		query += " AND (current_handler = ? OR current_handler_role = ? OR ? = '')"
		args = append(args, userID, string(role), "")
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
		`SELECT id, application_id, type, reason, triggered_by, triggered_by_name, triggered_at, resolved, COALESCE(resolved_at, ''), COALESCE(resolution_note, '')
		 FROM exception_records WHERE application_id = ? ORDER BY triggered_at`,
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
		"application":     app,
		"attachments":     attachments,
		"records":         records,
		"notes":           notes,
		"exceptions":      exceptions,
		"evidence_summary": evidenceSummary,
		"current_role":    role,
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

func ProcessApplication(c *gin.Context) {
	id := c.Param("id")
	userID, userName, _, role := middleware.GetCurrentUser(c)

	var req ProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "事务启动失败"})
		return
	}
	defer tx.Rollback()

	var app models.StudentApplication
	var materialsOK, classOK, paymentOK int
	err = tx.QueryRow(`SELECT id, student_name, id_card, phone, program, status,
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

	if app.Version != req.Version {
		recordException(tx, id, "version_conflict", "版本冲突：当前数据已更新，请刷新后重试", userID, userName)
		c.JSON(http.StatusConflict, gin.H{"error": "版本冲突，当前数据已更新，请刷新后重试", "success": false})
		return
	}

	if app.CurrentHandler != userID && app.CurrentHandlerRole != role {
		recordException(tx, id, "permission_denied", "越权操作：不是当前处理人", userID, userName)
		c.JSON(http.StatusForbidden, gin.H{"error": "权限不足，您不是当前处理人", "success": false})
		return
	}

	newStatus := app.Status
	newHandler := app.CurrentHandler
	newHandlerName := app.CurrentHandlerName
	newHandlerRole := app.CurrentHandlerRole
	nextHandler := app.NextHandler
	nextHandlerName := app.NextHandlerName
	nextHandlerRole := app.NextHandlerRole
	isCorrection := false

	switch req.Action {
	case "assign":
		if role != models.RoleRegistrar {
			c.JSON(http.StatusForbidden, gin.H{"error": "只有登记员可以分派", "success": false})
			return
		}
		if app.Status != models.StatusPending {
			c.JSON(http.StatusBadRequest, gin.H{"error": "状态冲突：当前状态不是待分派", "success": false})
			return
		}
		ok, reason := validateEvidence(&app)
		if !ok {
			recordException(tx, id, "missing_evidence", reason, userID, userName)
			c.JSON(http.StatusBadRequest, gin.H{"error": reason, "success": false})
			return
		}
		ok, reason = checkDeadline(&app, role)
		if !ok {
			recordException(tx, id, "overdue", reason, userID, userName)
			c.JSON(http.StatusBadRequest, gin.H{"error": reason, "success": false})
			return
		}
		newStatus = models.StatusTransferred
		newHandler = app.NextHandler
		newHandlerName = app.NextHandlerName
		newHandlerRole = app.NextHandlerRole
		nextHandler = ""
		nextHandlerName = ""
		nextHandlerRole = ""

		var reviewerID, reviewerName string
		database.DB.QueryRow("SELECT id, name FROM users WHERE role = 'reviewer'").Scan(&reviewerID, &reviewerName)
		nextHandler = reviewerID
		nextHandlerName = reviewerName
		nextHandlerRole = models.RoleReviewer

	case "audit_pass":
		if role != models.RoleAuditor {
			c.JSON(http.StatusForbidden, gin.H{"error": "只有审核主管可以审核通过", "success": false})
			return
		}
		if app.Status != models.StatusTransferred {
			c.JSON(http.StatusBadRequest, gin.H{"error": "状态冲突：当前状态不是已转办", "success": false})
			return
		}
		ok, reason := validateEvidence(&app)
		if !ok {
			recordException(tx, id, "missing_evidence", reason, userID, userName)
			c.JSON(http.StatusBadRequest, gin.H{"error": reason, "success": false})
			return
		}
		ok, reason = checkDeadline(&app, role)
		if !ok {
			recordException(tx, id, "overdue", reason, userID, userName)
			c.JSON(http.StatusBadRequest, gin.H{"error": reason, "success": false})
			return
		}
		newStatus = models.StatusVisited
		newHandler = app.NextHandler
		newHandlerName = app.NextHandlerName
		newHandlerRole = app.NextHandlerRole
		nextHandler = ""
		nextHandlerName = ""
		nextHandlerRole = ""

	case "audit_reject":
		if role != models.RoleAuditor {
			c.JSON(http.StatusForbidden, gin.H{"error": "只有审核主管可以退回补正", "success": false})
			return
		}
		if app.Status != models.StatusTransferred {
			c.JSON(http.StatusBadRequest, gin.H{"error": "状态冲突：当前状态不是已转办", "success": false})
			return
		}
		isCorrection = true
		newStatus = models.StatusPending
		var registrarID, registrarName string
		database.DB.QueryRow("SELECT id, name FROM users WHERE role = 'registrar'").Scan(&registrarID, &registrarName)
		newHandler = registrarID
		newHandlerName = registrarName
		newHandlerRole = models.RoleRegistrar
		var auditorID, auditorName string
		database.DB.QueryRow("SELECT id, name FROM users WHERE role = 'auditor'").Scan(&auditorID, &auditorName)
		nextHandler = auditorID
		nextHandlerName = auditorName
		nextHandlerRole = models.RoleAuditor
		recordException(tx, id, "return_correction", "退回补正: "+req.Remark, userID, userName)

	case "review_archive":
		if role != models.RoleReviewer {
			c.JSON(http.StatusForbidden, gin.H{"error": "只有复核负责人可以归档", "success": false})
			return
		}
		if app.Status != models.StatusVisited {
			c.JSON(http.StatusBadRequest, gin.H{"error": "状态冲突：当前状态不是已回访", "success": false})
			return
		}
		ok, reason := validateEvidence(&app)
		if !ok {
			recordException(tx, id, "missing_evidence", reason, userID, userName)
			c.JSON(http.StatusBadRequest, gin.H{"error": reason, "success": false})
			return
		}
		ok, reason = checkDeadline(&app, role)
		if !ok {
			recordException(tx, id, "overdue", reason, userID, userName)
			c.JSON(http.StatusBadRequest, gin.H{"error": reason, "success": false})
			return
		}
		newHandler = ""
		newHandlerName = ""
		newHandlerRole = ""

	case "supplement":
		if role != models.RoleRegistrar {
			c.JSON(http.StatusForbidden, gin.H{"error": "只有登记员可以补正", "success": false})
			return
		}
		isCorrection = true

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "未知操作类型", "success": false})
		return
	}

	now := time.Now()
	_, err = tx.Exec(`UPDATE student_applications SET 
		status = ?, current_handler = ?, current_handler_name = ?, current_handler_role = ?,
		next_handler = ?, next_handler_name = ?, next_handler_role = ?,
		updated_at = ?, version = version + 1
		WHERE id = ? AND version = ?`,
		string(newStatus), newHandler, newHandlerName, string(newHandlerRole),
		nextHandler, nextHandlerName, string(nextHandlerRole),
		now, id, req.Version,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败", "success": false})
		return
	}

	_, err = tx.Exec(`INSERT INTO processing_records 
		(id, application_id, action, handler_id, handler_name, handler_role,
		 previous_status, new_status, previous_handler, new_handler,
		 remark, created_at, version, is_correction)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), id, req.Action, userID, userName, string(role),
		string(app.Status), string(newStatus), app.CurrentHandler, newHandler,
		req.Remark, now, req.Version+1, isCorrection,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "记录处理日志失败", "success": false})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "提交事务失败", "success": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"new_status":   newStatus,
		"new_handler":  newHandlerName,
		"next_handler": nextHandlerName,
		"message":      "操作成功",
	})
}

func recordException(tx *sql.Tx, appID, excType, reason, userID, userName string) {
	tx.Exec(`INSERT INTO exception_records 
		(id, application_id, type, reason, triggered_by, triggered_by_name, triggered_at, resolved)
		VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
		uuid.NewString(), appID, excType, reason, userID, userName, time.Now(),
	)
}

func BatchProcess(c *gin.Context) {
	userID, userName, _, role := middleware.GetCurrentUser(c)

	var req struct {
		IDs     []string `json:"ids" binding:"required"`
		Action  string   `json:"action" binding:"required"`
		Remark  string   `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	results := make([]*models.BatchResult, 0)

	for _, id := range req.IDs {
		result := &models.BatchResult{
			ApplicationID: id,
		}

		var app models.StudentApplication
		var materialsOK, classOK, paymentOK int
		err := database.DB.QueryRow(`SELECT id, student_name, status, current_handler, current_handler_role,
			version, materials_complete, class_assigned, payment_confirmed,
			assignment_deadline, audit_deadline, review_deadline
			FROM student_applications WHERE id = ?`, id).Scan(
			&app.ID, &app.StudentName, &app.Status, &app.CurrentHandler, &app.CurrentHandlerRole,
			&app.Version, &materialsOK, &classOK, &paymentOK,
			&app.AssignmentDeadline, &app.AuditDeadline, &app.ReviewDeadline,
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

		if app.CurrentHandler != userID && app.CurrentHandlerRole != role {
			result.Success = false
			result.Reason = "越权操作：不是当前处理人"
			recordExceptionStandalone(id, "permission_denied", result.Reason, userID, userName)
			results = append(results, result)
			continue
		}

		ok, reason := validateEvidence(&app)
		if !ok {
			result.Success = false
			result.Reason = reason
			recordExceptionStandalone(id, "missing_evidence", reason, userID, userName)
			results = append(results, result)
			continue
		}

		ok, reason = checkDeadline(&app, role)
		if !ok {
			result.Success = false
			result.Reason = reason + "，请先处理逾期"
			recordExceptionStandalone(id, "overdue", reason, userID, userName)
			results = append(results, result)
			continue
		}

		switch req.Action {
		case "assign":
			if role != models.RoleRegistrar || app.Status != models.StatusPending {
				result.Success = false
				result.Reason = "状态或角色不匹配"
				results = append(results, result)
				continue
			}
		case "audit_pass":
			if role != models.RoleAuditor || app.Status != models.StatusTransferred {
				result.Success = false
				result.Reason = "状态或角色不匹配"
				results = append(results, result)
				continue
			}
		default:
			result.Success = false
			result.Reason = "不支持的批量操作"
			results = append(results, result)
			continue
		}

		processResult := ProcessRequest{Action: req.Action, Remark: req.Remark, Version: app.Version}
		tx, _ := database.DB.Begin()

		newStatus := app.Status
		newHandler := app.CurrentHandler
		newHandlerName := ""
		newHandlerRole := app.CurrentHandlerRole
		nextHandler := ""
		nextHandlerName := ""
		nextHandlerRole := models.Role("")

		if req.Action == "assign" {
			newStatus = models.StatusTransferred
			var auditorID, auditorName string
			database.DB.QueryRow("SELECT id, name FROM users WHERE role = 'auditor'").Scan(&auditorID, &auditorName)
			newHandler = auditorID
			newHandlerName = auditorName
			newHandlerRole = models.RoleAuditor
			var reviewerID, reviewerName string
			database.DB.QueryRow("SELECT id, name FROM users WHERE role = 'reviewer'").Scan(&reviewerID, &reviewerName)
			nextHandler = reviewerID
			nextHandlerName = reviewerName
			nextHandlerRole = models.RoleReviewer
		} else if req.Action == "audit_pass" {
			newStatus = models.StatusVisited
			var reviewerID, reviewerName string
			database.DB.QueryRow("SELECT id, name FROM users WHERE role = 'reviewer'").Scan(&reviewerID, &reviewerName)
			newHandler = reviewerID
			newHandlerName = reviewerName
			newHandlerRole = models.RoleReviewer
		}

		now := time.Now()
		database.DB.QueryRow("SELECT name FROM users WHERE id = ?", app.CurrentHandler).Scan(&app.CurrentHandlerName)

		tx.Exec(`UPDATE student_applications SET 
			status = ?, current_handler = ?, current_handler_name = ?, current_handler_role = ?,
			next_handler = ?, next_handler_name = ?, next_handler_role = ?,
			updated_at = ?, version = version + 1
			WHERE id = ? AND version = ?`,
			string(newStatus), newHandler, newHandlerName, string(newHandlerRole),
			nextHandler, nextHandlerName, string(nextHandlerRole),
			now, id, app.Version,
		)

		tx.Exec(`INSERT INTO processing_records 
			(id, application_id, action, handler_id, handler_name, handler_role,
			 previous_status, new_status, previous_handler, new_handler,
			 remark, created_at, version, is_correction)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			uuid.NewString(), id, req.Action, userID, userName, string(role),
			string(app.Status), string(newStatus), app.CurrentHandler, newHandler,
			req.Remark, now, app.Version+1, false,
		)

		tx.Commit()

		result.Success = true
		result.Reason = "处理成功，流转至：" + newHandlerName
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

func recordExceptionStandalone(appID, excType, reason, userID, userName string) {
	database.DB.Exec(`INSERT INTO exception_records 
		(id, application_id, type, reason, triggered_by, triggered_by_name, triggered_at, resolved)
		VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
		uuid.NewString(), appID, excType, reason, userID, userName, time.Now(),
	)
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

	_, err := database.DB.Exec(
		"INSERT INTO audit_notes (id, application_id, user_id, user_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		uuid.NewString(), id, userID, userName, req.Content, time.Now(),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "添加备注失败"})
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
