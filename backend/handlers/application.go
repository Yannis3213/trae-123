package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"trae-123-4/backend/database"
	"trae-123-4/backend/middleware"
	"trae-123-4/backend/models"

	"github.com/gin-gonic/gin"
)

type response struct {
	Code    int         `json:"code"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

func ListApplications(c *gin.Context) {
	status := c.Query("status")
	keyword := c.Query("keyword")
	expiryStatus := c.Query("expiry_status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
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
	if keyword != "" {
		where += " AND (tenant_name LIKE ? OR application_no LIKE ?)"
		kw := "%" + keyword + "%"
		args = append(args, kw, kw)
	}

	if expiryStatus != "" {
		today := time.Now().Format("2006-01-02")
		expiringDate := time.Now().Add(30 * 24 * time.Hour).Format("2006-01-02")
		switch expiryStatus {
		case "normal":
			where += " AND lease_end_date > ?"
			args = append(args, expiringDate)
		case "expiring_soon":
			where += " AND lease_end_date <= ? AND lease_end_date >= ?"
			args = append(args, expiringDate, today)
		case "overdue":
			where += " AND lease_end_date < ?"
			args = append(args, today)
		}
	}

	var total int
	countSQL := "SELECT COUNT(*) FROM lease_applications " + where
	database.DB.QueryRow(countSQL, args...).Scan(&total)

	offset := (page - 1) * pageSize
	querySQL := `SELECT id, application_no, tenant_name, tenant_phone, room_number, building_name,
		lease_start_date, lease_end_date, monthly_rent, deposit, status,
		current_handler_id, current_handler_name, current_handler_role, version, confirmed,
		tenant_signing_status, room_confirmation_status, move_in_handover_status,
		exception_reason, created_at, updated_at
		FROM lease_applications ` + where + ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
	args = append(args, pageSize, offset)

	rows, err := database.DB.Query(querySQL, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "查询失败"})
		return
	}
	defer rows.Close()

	list := []models.LeaseApplication{}
	for rows.Next() {
		var app models.LeaseApplication
		var confirmed int
		rows.Scan(&app.ID, &app.ApplicationNo, &app.TenantName, &app.TenantPhone,
			&app.RoomNumber, &app.BuildingName, &app.LeaseStartDate, &app.LeaseEndDate,
			&app.MonthlyRent, &app.Deposit, &app.Status,
			&app.CurrentHandlerID, &app.CurrentHandlerName, &app.CurrentHandlerRole, &app.Version, &confirmed,
			&app.TenantSigningStatus, &app.RoomConfirmationStatus, &app.MoveInHandoverStatus,
			&app.ExceptionReason, &app.CreatedAt, &app.UpdatedAt)
		app.Confirmed = confirmed == 1
		app.ExpiryStatus, app.OverdueDays = models.ComputeExpiryFields(app.LeaseEndDate)
		list = append(list, app)
	}

	c.JSON(http.StatusOK, response{Code: 0, Data: gin.H{
		"list":      list,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	}})
}

func GetApplication(c *gin.Context) {
	id := c.Param("id")

	var app models.LeaseApplication
	var confirmed int
	err := database.DB.QueryRow(`SELECT id, application_no, tenant_name, tenant_phone, room_number, building_name,
		lease_start_date, lease_end_date, monthly_rent, deposit, status,
		current_handler_id, current_handler_name, current_handler_role, version, confirmed,
		tenant_signing_status, room_confirmation_status, move_in_handover_status,
		exception_reason, created_at, updated_at
		FROM lease_applications WHERE id = ?`, id).
		Scan(&app.ID, &app.ApplicationNo, &app.TenantName, &app.TenantPhone,
			&app.RoomNumber, &app.BuildingName, &app.LeaseStartDate, &app.LeaseEndDate,
			&app.MonthlyRent, &app.Deposit, &app.Status,
			&app.CurrentHandlerID, &app.CurrentHandlerName, &app.CurrentHandlerRole, &app.Version, &confirmed,
			&app.TenantSigningStatus, &app.RoomConfirmationStatus, &app.MoveInHandoverStatus,
			&app.ExceptionReason, &app.CreatedAt, &app.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, response{Code: 404, Message: "申请不存在"})
		return
	}
	app.Confirmed = confirmed == 1

	expiryStatus, overdueDays := models.ComputeExpiryFields(app.LeaseEndDate)

	attachments := []models.Attachment{}
	attRows, err := database.DB.Query(`SELECT id, application_id, file_name, file_type, file_path, uploaded_by, upload_role, created_at
		FROM attachments WHERE application_id = ? ORDER BY created_at`, id)
	if err == nil {
		defer attRows.Close()
		for attRows.Next() {
			var att models.Attachment
			attRows.Scan(&att.ID, &att.ApplicationID, &att.FileName, &att.FileType, &att.FilePath, &att.UploadedBy, &att.UploadRole, &att.CreatedAt)
			attachments = append(attachments, att)
		}
	}

	records := []models.ProcessingRecord{}
	recRows, err := database.DB.Query(`SELECT id, application_id, handler_id, handler_name, handler_role, action, from_status, to_status, remark, exception_reason, created_at
		FROM processing_records WHERE application_id = ? ORDER BY created_at`, id)
	if err == nil {
		defer recRows.Close()
		for recRows.Next() {
			var rec models.ProcessingRecord
			recRows.Scan(&rec.ID, &rec.ApplicationID, &rec.HandlerID, &rec.HandlerName, &rec.HandlerRole, &rec.Action, &rec.FromStatus, &rec.ToStatus, &rec.Remark, &rec.ExceptionReason, &rec.CreatedAt)
			records = append(records, rec)
		}
	}

	c.JSON(http.StatusOK, response{Code: 0, Data: gin.H{
		"id":                       app.ID,
		"application_no":           app.ApplicationNo,
		"tenant_name":              app.TenantName,
		"tenant_phone":             app.TenantPhone,
		"room_number":              app.RoomNumber,
		"building_name":            app.BuildingName,
		"lease_start_date":         app.LeaseStartDate,
		"lease_end_date":           app.LeaseEndDate,
		"monthly_rent":             app.MonthlyRent,
		"deposit":                  app.Deposit,
		"status":                   app.Status,
		"current_handler_id":       app.CurrentHandlerID,
		"current_handler_name":     app.CurrentHandlerName,
		"current_handler_role":     app.CurrentHandlerRole,
		"version":                  app.Version,
		"confirmed":                app.Confirmed,
		"tenant_signing_status":    app.TenantSigningStatus,
		"room_confirmation_status": app.RoomConfirmationStatus,
		"move_in_handover_status":  app.MoveInHandoverStatus,
		"exception_reason":         app.ExceptionReason,
		"expiry_status":            expiryStatus,
		"overdue_days":             overdueDays,
		"created_at":               app.CreatedAt,
		"updated_at":               app.UpdatedAt,
		"attachments":              attachments,
		"processing_records":       records,
	}})
}

func CreateApplication(c *gin.Context) {
	role := middleware.GetRole(c)
	if role != "lease_clerk" {
		c.JSON(http.StatusForbidden, response{Code: 40301, Message: "当前角色无权执行此操作"})
		return
	}

	var req models.CreateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response{Code: 400, Message: "请求参数错误: " + err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	userName := middleware.GetUserName(c)

	var maxNo int
	database.DB.QueryRow("SELECT COALESCE(MAX(CAST(SUBSTR(application_no, 9) AS INTEGER)), 0) FROM lease_applications WHERE application_no LIKE 'ZY-2026-%'").Scan(&maxNo)
	maxNo++
	appNo := fmt.Sprintf("ZY-2026-%03d", maxNo)

	now := time.Now().Format(time.RFC3339)
	id := models.GenerateID()

	_, err := database.DB.Exec(`INSERT INTO lease_applications
		(id, application_no, tenant_name, tenant_phone, room_number, building_name,
		lease_start_date, lease_end_date, monthly_rent, deposit, status,
		current_handler_id, current_handler_name, current_handler_role, version,
		tenant_signing_status, room_confirmation_status, move_in_handover_status,
		exception_reason, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, appNo, req.TenantName, req.TenantPhone, req.RoomNumber, req.BuildingName,
		req.LeaseStartDate, req.LeaseEndDate, req.MonthlyRent, req.Deposit,
		"pending_verification", userID, userName, "lease_clerk", 1,
		"pending", "pending", "pending", "", now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "创建失败: " + err.Error()})
		return
	}

	_, err = database.DB.Exec(`INSERT INTO audit_logs
		(id, application_id, operator_id, operator_name, operator_role, action,
		before_status, after_status, detail, failure_reason, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		models.GenerateID(), id, userID, userName, "lease_clerk",
		"创建申请", "", "pending_verification",
		fmt.Sprintf("租客: %s, 房间: %s %s", req.TenantName, req.BuildingName, req.RoomNumber),
		"", now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "审计记录写入失败"})
		return
	}

	_, err = database.DB.Exec(`UPDATE lease_applications SET current_handler_id = '', current_handler_name = '', current_handler_role = 'maintenance_coordinator' WHERE id = ?`, id)
	if err == nil {
		c.JSON(http.StatusOK, response{Code: 0, Data: gin.H{"id": id, "application_no": appNo}})
	}
}

func UpdateApplication(c *gin.Context) {
	role := middleware.GetRole(c)
	if role != "lease_clerk" {
		c.JSON(http.StatusForbidden, response{Code: 40301, Message: "当前角色无权执行此操作"})
		return
	}

	id := c.Param("id")
	var req models.UpdateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response{Code: 400, Message: "请求参数错误"})
		return
	}

	var currentStatus string
	var currentVersion int
	err := database.DB.QueryRow("SELECT status, version FROM lease_applications WHERE id = ?", id).Scan(&currentStatus, &currentVersion)
	if err != nil {
		c.JSON(http.StatusNotFound, response{Code: 404, Message: "申请不存在"})
		return
	}

	if currentStatus == "verification_complete" {
		c.JSON(http.StatusConflict, response{Code: 40902, Message: "当前状态verification_complete不允许修改"})
		return
	}

	if req.Version != currentVersion {
		c.JSON(http.StatusConflict, response{Code: 40901, Message: "版本冲突，数据已被其他人员修改"})
		return
	}

	now := time.Now().Format(time.RFC3339)
	userID := middleware.GetUserID(c)
	userName := middleware.GetUserName(c)

	sets := []string{}
	args := []interface{}{}

	if req.TenantName != "" {
		sets = append(sets, "tenant_name = ?")
		args = append(args, req.TenantName)
	}
	if req.TenantPhone != "" {
		sets = append(sets, "tenant_phone = ?")
		args = append(args, req.TenantPhone)
	}
	if req.RoomNumber != "" {
		sets = append(sets, "room_number = ?")
		args = append(args, req.RoomNumber)
	}
	if req.BuildingName != "" {
		sets = append(sets, "building_name = ?")
		args = append(args, req.BuildingName)
	}
	if req.LeaseStartDate != "" {
		sets = append(sets, "lease_start_date = ?")
		args = append(args, req.LeaseStartDate)
	}
	if req.LeaseEndDate != "" {
		sets = append(sets, "lease_end_date = ?")
		args = append(args, req.LeaseEndDate)
	}
	if req.MonthlyRent > 0 {
		sets = append(sets, "monthly_rent = ?")
		args = append(args, req.MonthlyRent)
	}
	if req.Deposit > 0 {
		sets = append(sets, "deposit = ?")
		args = append(args, req.Deposit)
	}
	if req.TenantSigningStatus != "" {
		sets = append(sets, "tenant_signing_status = ?")
		args = append(args, req.TenantSigningStatus)
	}
	if req.RoomConfirmationStatus != "" {
		sets = append(sets, "room_confirmation_status = ?")
		args = append(args, req.RoomConfirmationStatus)
	}
	if req.MoveInHandoverStatus != "" {
		sets = append(sets, "move_in_handover_status = ?")
		args = append(args, req.MoveInHandoverStatus)
	}
	if req.ExceptionReason != "" {
		sets = append(sets, "exception_reason = ?")
		args = append(args, req.ExceptionReason)
	}

	sets = append(sets, "version = version + 1", "updated_at = ?")
	args = append(args, now)

	sql := "UPDATE lease_applications SET " + strings.Join(sets, ", ") + " WHERE id = ? AND version = ?"
	args = append(args, id, currentVersion)

	result, err := database.DB.Exec(sql, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "更新失败"})
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusConflict, response{Code: 40901, Message: "版本冲突，数据已被其他人员修改"})
		return
	}

	database.DB.Exec(`INSERT INTO audit_logs
		(id, application_id, operator_id, operator_name, operator_role, action,
		before_status, after_status, detail, failure_reason, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		models.GenerateID(), id, userID, userName, "lease_clerk",
		"更新申请", currentStatus, currentStatus, "租务专员修改申请信息", "", now)

	c.JSON(http.StatusOK, response{Code: 0, Data: gin.H{"version": currentVersion + 1}})
}

func ProcessApplication(c *gin.Context) {
	id := c.Param("id")
	role := middleware.GetRole(c)
	userID := middleware.GetUserID(c)
	userName := middleware.GetUserName(c)

	var req models.ProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response{Code: 400, Message: "请求参数错误"})
		return
	}

	var app models.LeaseApplication
	var confirmed int
	err := database.DB.QueryRow(`SELECT id, application_no, status, current_handler_id, current_handler_name, current_handler_role, version, confirmed
		FROM lease_applications WHERE id = ?`, id).
		Scan(&app.ID, &app.ApplicationNo, &app.Status, &app.CurrentHandlerID, &app.CurrentHandlerName, &app.CurrentHandlerRole, &app.Version, &confirmed)
	if err != nil {
		c.JSON(http.StatusNotFound, response{Code: 404, Message: "申请不存在"})
		return
	}
	app.Confirmed = confirmed == 1

	if req.Version != app.Version {
		c.JSON(http.StatusConflict, response{Code: 40901, Message: fmt.Sprintf("版本冲突，请求版本v%d，当前版本v%d，请刷新后重试", req.Version, app.Version)})
		return
	}

	validActions := map[string][]string{
		"lease_clerk":             {"correct"},
		"maintenance_coordinator": {"verify_pass", "verify_fail"},
		"store_manager":           {"confirm"},
	}
	allowed, exists := validActions[role]
	if !exists {
		c.JSON(http.StatusForbidden, response{Code: 40301, Message: "当前角色无权执行此操作"})
		return
	}
	actionAllowed := false
	for _, a := range allowed {
		if a == req.Action {
			actionAllowed = true
			break
		}
	}
	if !actionAllowed {
		c.JSON(http.StatusForbidden, response{Code: 40301, Message: "当前角色无权执行此操作"})
		return
	}

	if app.CurrentHandlerRole != "" && app.CurrentHandlerRole != role {
		roleNames := map[string]string{
			"lease_clerk":             "租务专员",
			"maintenance_coordinator": "维修协调员",
			"store_manager":           "门店经理",
		}
		c.JSON(http.StatusForbidden, response{Code: 40302, Message: fmt.Sprintf("当前申请应由%s处理", roleNames[app.CurrentHandlerRole])})
		return
	}

	if app.CurrentHandlerID != "" && app.CurrentHandlerID != userID {
		c.JSON(http.StatusForbidden, response{Code: 40302, Message: fmt.Sprintf("当前申请由%s处理，您无权操作", app.CurrentHandlerName)})
		return
	}

	if req.Action == "confirm" && app.Confirmed {
		c.JSON(http.StatusConflict, response{Code: 40905, Message: "该申请已确认，请勿重复确认"})
		return
	}

	validTransitions := map[string]map[string]string{
		"pending_verification":  {"verify_pass": "verification_complete", "verify_fail": "verification_failed"},
		"verification_failed":   {"correct": "pending_verification"},
		"verification_complete": {"confirm": "verification_complete"},
	}
	transitions, exists := validTransitions[app.Status]
	if !exists {
		c.JSON(http.StatusConflict, response{Code: 40902, Message: fmt.Sprintf("当前状态%s不允许执行%s操作", app.Status, req.Action)})
		return
	}
	newStatus, exists := transitions[req.Action]
	if !exists {
		c.JSON(http.StatusConflict, response{Code: 40902, Message: fmt.Sprintf("当前状态%s不允许执行%s操作", app.Status, req.Action)})
		return
	}

	if req.Action == "verify_pass" {
		var attCount int
		database.DB.QueryRow("SELECT COUNT(*) FROM attachments WHERE application_id = ?", id).Scan(&attCount)
		if attCount == 0 {
			c.JSON(http.StatusConflict, response{Code: 40903, Message: "缺少必要附件，无法完成核验"})
			return
		}
	}

	now := time.Now().Format(time.RFC3339)

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "开启事务失败"})
		return
	}

	result, err := tx.Exec(`UPDATE lease_applications SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
		newStatus, now, id, app.Version)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "更新失败"})
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		tx.Rollback()
		c.JSON(http.StatusConflict, response{Code: 40904, Message: "该申请已被处理，请勿重复提交"})
		return
	}

	nextHandlerRole := ""
	nextHandlerID := ""
	nextHandlerName := ""
	switch newStatus {
	case "pending_verification":
		nextHandlerRole = "maintenance_coordinator"
	case "verification_failed":
		nextHandlerRole = "lease_clerk"
	case "verification_complete":
		if req.Action == "confirm" {
			nextHandlerRole = ""
			nextHandlerID = ""
			nextHandlerName = ""
		} else {
			nextHandlerRole = "store_manager"
		}
	}
	_, err = tx.Exec(`UPDATE lease_applications SET current_handler_role = ?, current_handler_id = ?, current_handler_name = ? WHERE id = ?`,
		nextHandlerRole, nextHandlerID, nextHandlerName, id)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "更新处理人失败"})
		return
	}

	if req.Action == "confirm" {
		_, err = tx.Exec(`UPDATE lease_applications SET confirmed = 1 WHERE id = ?`, id)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "设置确认标记失败"})
			return
		}
	}

	if req.SubModule != "" && req.SubModuleStatus != "" {
		column := ""
		switch req.SubModule {
		case "tenant_signing":
			column = "tenant_signing_status"
		case "room_confirmation":
			column = "room_confirmation_status"
		case "move_in_handover":
			column = "move_in_handover_status"
		}
		if column != "" {
			_, err = tx.Exec(fmt.Sprintf("UPDATE lease_applications SET %s = ? WHERE id = ?", column), req.SubModuleStatus, id)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "更新子模块状态失败"})
				return
			}
		}
	}

	if req.ExceptionReason != "" {
		_, err = tx.Exec("UPDATE lease_applications SET exception_reason = ? WHERE id = ?", req.ExceptionReason, id)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "更新异常原因失败"})
			return
		}
	} else if req.Action == "correct" {
		_, err = tx.Exec("UPDATE lease_applications SET exception_reason = '' WHERE id = ?", id)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "清除异常原因失败"})
			return
		}
	}

	_, err = tx.Exec(`INSERT INTO processing_records
		(id, application_id, handler_id, handler_name, handler_role, action, from_status, to_status, remark, exception_reason, version, next_handler_role, next_handler_id, next_handler_name, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		models.GenerateID(), id, userID, userName, role, req.Action, app.Status, newStatus, req.Remark, req.ExceptionReason, app.Version, nextHandlerRole, nextHandlerID, nextHandlerName, now)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "写入处理记录失败"})
		return
	}

	auditDetail := fmt.Sprintf("执行操作: %s, 版本: v%d→v%d", req.Action, app.Version, app.Version+1)
	if req.Remark != "" {
		auditDetail += fmt.Sprintf(", 备注: %s", req.Remark)
	}
	if nextHandlerRole != "" {
		roleNames := map[string]string{
			"lease_clerk":             "租务专员",
			"maintenance_coordinator": "维修协调员",
			"store_manager":           "门店经理",
		}
		auditDetail += fmt.Sprintf(", 下一处理: %s", roleNames[nextHandlerRole])
	}
	_, err = tx.Exec(`INSERT INTO audit_logs
		(id, application_id, operator_id, operator_name, operator_role, action, before_status, after_status, detail, failure_reason, version, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		models.GenerateID(), id, userID, userName, role, req.Action, app.Status, newStatus, auditDetail, req.ExceptionReason, app.Version, now)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "写入审计日志失败"})
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "提交事务失败"})
		return
	}

	c.JSON(http.StatusOK, response{Code: 0, Data: gin.H{
		"status": newStatus, "version": app.Version + 1, "confirmed": req.Action == "confirm",
		"next_handler_role": nextHandlerRole,
		"next_handler_id":   nextHandlerID,
		"next_handler_name": nextHandlerName,
	}})
}

func UploadAttachment(c *gin.Context) {
	id := c.Param("id")

	var exists bool
	database.DB.QueryRow("SELECT 1 FROM lease_applications WHERE id = ?", id).Scan(&exists)
	if !exists {
		c.JSON(http.StatusNotFound, response{Code: 404, Message: "申请不存在"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, response{Code: 400, Message: "请选择要上传的文件"})
		return
	}
	defer file.Close()

	uploadRole := c.PostForm("upload_role")
	userID := middleware.GetUserID(c)
	userName := middleware.GetUserName(c)

	uploadDir := "uploads"
	os.MkdirAll(uploadDir, 0755)

	ext := filepath.Ext(header.Filename)
	fileName := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), models.GenerateID()[:8], ext)
	filePath := filepath.Join(uploadDir, fileName)

	dst, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "文件保存失败"})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "文件写入失败"})
		return
	}

	fileType := header.Header.Get("Content-Type")
	if fileType == "" {
		fileType = "application/octet-stream"
	}

	now := time.Now().Format(time.RFC3339)
	attID := models.GenerateID()

	_, err = database.DB.Exec(`INSERT INTO attachments
		(id, application_id, file_name, file_type, file_path, uploaded_by, upload_role, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		attID, id, header.Filename, fileType, filePath, userID, uploadRole, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "附件记录保存失败"})
		return
	}

	database.DB.Exec(`INSERT INTO audit_logs
		(id, application_id, operator_id, operator_name, operator_role, action, before_status, after_status, detail, failure_reason, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		models.GenerateID(), id, userID, userName, middleware.GetRole(c),
		"上传附件", "", "", fmt.Sprintf("上传文件: %s", header.Filename), "", now)

	c.JSON(http.StatusOK, response{Code: 0, Data: gin.H{
		"id":         attID,
		"file_name":  header.Filename,
		"file_path":  filePath,
		"created_at": now,
	}})
}
