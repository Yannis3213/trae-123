package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"coldchain/models"

	"github.com/gin-gonic/gin"
)

func calculateExpiryGroup(expectedDate string) string {
	date, err := time.Parse("2006-01-02", expectedDate)
	if err != nil {
		return "normal"
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	sevenDaysLater := today.Add(7 * 24 * time.Hour)
	if date.Before(today) {
		return "overdue"
	}
	if date.Before(sevenDaysLater) {
		return "near_expiry"
	}
	return "normal"
}

func fillNames(app *models.Application) {
	DB.QueryRow("SELECT display_name FROM users WHERE id = ?", app.CreatorID).Scan(&app.CreatorName)
	if app.HandlerID > 0 {
		DB.QueryRow("SELECT display_name FROM users WHERE id = ?", app.HandlerID).Scan(&app.HandlerName)
	}
}

type ActionContext struct {
	AppID           int64
	UserID          int64
	Role            string
	Version         int
	TemperatureZone string
	CorrectionNote  string
}

type ActionResponse struct {
	Success bool
	Code    string
	Message string
	OrderNo string
}

func doSubmit(ctx ActionContext) ActionResponse {
	var app models.Application
	err := DB.QueryRow(
		"SELECT id, order_no, status, version, creator_id, product_name, expected_date FROM applications WHERE id = ?",
		ctx.AppID,
	).Scan(&app.ID, &app.OrderNo, &app.Status, &app.Version, &app.CreatorID, &app.ProductName, &app.ExpectedDate)
	if err != nil {
		return ActionResponse{Success: false, Code: "NOT_FOUND", Message: "单据不存在", OrderNo: ""}
	}

	if ctx.Role != "warehouse_clerk" {
		return ActionResponse{Success: false, Code: "ROLE_FORBIDDEN", Message: fmt.Sprintf("当前角色[%s]无权执行此操作，需要[warehouse_clerk]角色", ctx.Role), OrderNo: app.OrderNo}
	}

	if app.CreatorID != ctx.UserID {
		return ActionResponse{Success: false, Code: "CROSS_ROLE", Message: "您不是当前处理人，无法执行此操作", OrderNo: app.OrderNo}
	}

	if app.Status == "pending_temp" {
		return ActionResponse{Success: false, Code: "DUPLICATE_SUBMIT", Message: fmt.Sprintf("请勿重复提交，单据已处于[%s]状态", statusLabel(app.Status)), OrderNo: app.OrderNo}
	}

	if app.Status != "draft" {
		return ActionResponse{Success: false, Code: "STATUS_CONFLICT", Message: fmt.Sprintf("单据当前状态为[%s]，无法执行[提交]操作，需要[draft]状态", statusLabel(app.Status)), OrderNo: app.OrderNo}
	}

	if ctx.Version != app.Version {
		return ActionResponse{Success: false, Code: "VERSION_CONFLICT", Message: fmt.Sprintf("单据已被他人修改，当前版本为%d，请刷新后重试", app.Version), OrderNo: app.OrderNo}
	}

	missing := []string{}
	if app.ProductName == "" {
		missing = append(missing, "product_name")
	}
	if app.ExpectedDate == "" {
		missing = append(missing, "expected_date")
	}
	if len(missing) > 0 {
		return ActionResponse{Success: false, Code: "EVIDENCE_MISSING", Message: fmt.Sprintf("缺少必要证据：%s，请补充后再提交", strings.Join(missing, "、")), OrderNo: app.OrderNo}
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	tx, err := DB.Begin()
	if err != nil {
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "数据库错误", OrderNo: app.OrderNo}
	}

	_, err = tx.Exec(
		"UPDATE applications SET status = ?, current_step = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
		"pending_temp", "allocation", now, ctx.AppID, ctx.Version,
	)
	if err != nil {
		tx.Rollback()
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "更新失败", OrderNo: app.OrderNo}
	}

	_, err = tx.Exec(
		"INSERT INTO processing_records (application_id, operator_id, action, from_status, to_status, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		ctx.AppID, ctx.UserID, "submit", "draft", "pending_temp", "", now,
	)
	if err != nil {
		tx.Rollback()
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "创建处理记录失败", OrderNo: app.OrderNo}
	}

	if err := tx.Commit(); err != nil {
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "提交失败", OrderNo: app.OrderNo}
	}

	return ActionResponse{Success: true, OrderNo: app.OrderNo}
}

func doAllocate(ctx ActionContext) ActionResponse {
	var app models.Application
	err := DB.QueryRow(
		"SELECT id, order_no, status, version FROM applications WHERE id = ?",
		ctx.AppID,
	).Scan(&app.ID, &app.OrderNo, &app.Status, &app.Version)
	if err != nil {
		return ActionResponse{Success: false, Code: "NOT_FOUND", Message: "单据不存在", OrderNo: ""}
	}

	if ctx.Role != "temp_supervisor" {
		return ActionResponse{Success: false, Code: "ROLE_FORBIDDEN", Message: fmt.Sprintf("当前角色[%s]无权执行此操作，需要[temp_supervisor]角色", ctx.Role), OrderNo: app.OrderNo}
	}

	if app.Status == "under_review" {
		return ActionResponse{Success: false, Code: "DUPLICATE_SUBMIT", Message: fmt.Sprintf("请勿重复提交，单据已处于[%s]状态", statusLabel(app.Status)), OrderNo: app.OrderNo}
	}

	if app.Status != "pending_temp" {
		return ActionResponse{Success: false, Code: "STATUS_CONFLICT", Message: fmt.Sprintf("单据当前状态为[%s]，无法执行[分配]操作，需要[pending_temp]状态", statusLabel(app.Status)), OrderNo: app.OrderNo}
	}

	if ctx.Version != app.Version {
		return ActionResponse{Success: false, Code: "VERSION_CONFLICT", Message: fmt.Sprintf("单据已被他人修改，当前版本为%d，请刷新后重试", app.Version), OrderNo: app.OrderNo}
	}

	if ctx.TemperatureZone == "" {
		return ActionResponse{Success: false, Code: "EVIDENCE_MISSING", Message: "缺少必要证据：temperature_zone，请补充后再提交", OrderNo: app.OrderNo}
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	tx, err := DB.Begin()
	if err != nil {
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "数据库错误", OrderNo: app.OrderNo}
	}

	_, err = tx.Exec(
		"UPDATE applications SET status = ?, current_step = ?, handler_id = ?, temperature_zone = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
		"under_review", "confirmation", ctx.UserID, ctx.TemperatureZone, now, ctx.AppID, ctx.Version,
	)
	if err != nil {
		tx.Rollback()
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "更新失败", OrderNo: app.OrderNo}
	}

	_, err = tx.Exec(
		"INSERT INTO processing_records (application_id, operator_id, action, from_status, to_status, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		ctx.AppID, ctx.UserID, "allocate", "pending_temp", "under_review", "", now,
	)
	if err != nil {
		tx.Rollback()
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "创建处理记录失败", OrderNo: app.OrderNo}
	}

	if err := tx.Commit(); err != nil {
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "提交失败", OrderNo: app.OrderNo}
	}

	return ActionResponse{Success: true, OrderNo: app.OrderNo}
}

func doConfirm(ctx ActionContext) ActionResponse {
	var app models.Application
	err := DB.QueryRow(
		"SELECT id, order_no, status, version FROM applications WHERE id = ?",
		ctx.AppID,
	).Scan(&app.ID, &app.OrderNo, &app.Status, &app.Version)
	if err != nil {
		return ActionResponse{Success: false, Code: "NOT_FOUND", Message: "单据不存在", OrderNo: ""}
	}

	if ctx.Role != "warehouse_manager" {
		return ActionResponse{Success: false, Code: "ROLE_FORBIDDEN", Message: fmt.Sprintf("当前角色[%s]无权执行此操作，需要[warehouse_manager]角色", ctx.Role), OrderNo: app.OrderNo}
	}

	if app.Status == "completed" {
		return ActionResponse{Success: false, Code: "DUPLICATE_SUBMIT", Message: fmt.Sprintf("请勿重复提交，单据已处于[%s]状态", statusLabel(app.Status)), OrderNo: app.OrderNo}
	}

	if app.Status != "under_review" {
		return ActionResponse{Success: false, Code: "STATUS_CONFLICT", Message: fmt.Sprintf("单据当前状态为[%s]，无法执行[确认]操作，需要[under_review]状态", statusLabel(app.Status)), OrderNo: app.OrderNo}
	}

	if ctx.Version != app.Version {
		return ActionResponse{Success: false, Code: "VERSION_CONFLICT", Message: fmt.Sprintf("单据已被他人修改，当前版本为%d，请刷新后重试", app.Version), OrderNo: app.OrderNo}
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	tx, err := DB.Begin()
	if err != nil {
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "数据库错误", OrderNo: app.OrderNo}
	}

	_, err = tx.Exec(
		"UPDATE applications SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
		"completed", now, ctx.AppID, ctx.Version,
	)
	if err != nil {
		tx.Rollback()
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "更新失败", OrderNo: app.OrderNo}
	}

	_, err = tx.Exec(
		"INSERT INTO processing_records (application_id, operator_id, action, from_status, to_status, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		ctx.AppID, ctx.UserID, "confirm", "under_review", "completed", "", now,
	)
	if err != nil {
		tx.Rollback()
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "创建处理记录失败", OrderNo: app.OrderNo}
	}

	if err := tx.Commit(); err != nil {
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "提交失败", OrderNo: app.OrderNo}
	}

	return ActionResponse{Success: true, OrderNo: app.OrderNo}
}

func doReturn(ctx ActionContext) ActionResponse {
	var app models.Application
	err := DB.QueryRow(
		"SELECT id, order_no, status, version FROM applications WHERE id = ?",
		ctx.AppID,
	).Scan(&app.ID, &app.OrderNo, &app.Status, &app.Version)
	if err != nil {
		return ActionResponse{Success: false, Code: "NOT_FOUND", Message: "单据不存在", OrderNo: ""}
	}

	if ctx.Role != "temp_supervisor" && ctx.Role != "warehouse_manager" {
		return ActionResponse{Success: false, Code: "ROLE_FORBIDDEN", Message: fmt.Sprintf("当前角色[%s]无权执行此操作，需要[temp_supervisor或warehouse_manager]角色", ctx.Role), OrderNo: app.OrderNo}
	}

	if app.Status == "pending_correction" {
		return ActionResponse{Success: false, Code: "DUPLICATE_SUBMIT", Message: fmt.Sprintf("请勿重复提交，单据已处于[%s]状态", statusLabel(app.Status)), OrderNo: app.OrderNo}
	}

	if app.Status != "pending_temp" && app.Status != "under_review" {
		return ActionResponse{Success: false, Code: "STATUS_CONFLICT", Message: fmt.Sprintf("单据当前状态为[%s]，无法执行[退回]操作，需要[pending_temp或under_review]状态", statusLabel(app.Status)), OrderNo: app.OrderNo}
	}

	if ctx.Version != app.Version {
		return ActionResponse{Success: false, Code: "VERSION_CONFLICT", Message: fmt.Sprintf("单据已被他人修改，当前版本为%d，请刷新后重试", app.Version), OrderNo: app.OrderNo}
	}

	if ctx.CorrectionNote == "" {
		return ActionResponse{Success: false, Code: "EVIDENCE_MISSING", Message: "缺少必要证据：correction_note，请补充后再提交", OrderNo: app.OrderNo}
	}

	newStep := "confirmation"
	if app.Status == "pending_temp" {
		newStep = "appointment"
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	tx, err := DB.Begin()
	if err != nil {
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "数据库错误", OrderNo: app.OrderNo}
	}

	_, err = tx.Exec(
		"UPDATE applications SET status = ?, current_step = ?, correction_note = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
		"pending_correction", newStep, ctx.CorrectionNote, now, ctx.AppID, ctx.Version,
	)
	if err != nil {
		tx.Rollback()
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "更新失败", OrderNo: app.OrderNo}
	}

	_, err = tx.Exec(
		"INSERT INTO exception_reasons (application_id, operator_id, reason_type, description, created_at) VALUES (?, ?, ?, ?, ?)",
		ctx.AppID, ctx.UserID, "returned", ctx.CorrectionNote, now,
	)
	if err != nil {
		tx.Rollback()
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "创建异常原因失败", OrderNo: app.OrderNo}
	}

	_, err = tx.Exec(
		"INSERT INTO processing_records (application_id, operator_id, action, from_status, to_status, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		ctx.AppID, ctx.UserID, "return", app.Status, "pending_correction", ctx.CorrectionNote, now,
	)
	if err != nil {
		tx.Rollback()
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "创建处理记录失败", OrderNo: app.OrderNo}
	}

	if err := tx.Commit(); err != nil {
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "提交失败", OrderNo: app.OrderNo}
	}

	return ActionResponse{Success: true, OrderNo: app.OrderNo}
}

func doCorrect(ctx ActionContext) ActionResponse {
	var app models.Application
	err := DB.QueryRow(
		"SELECT id, order_no, status, version, creator_id FROM applications WHERE id = ?",
		ctx.AppID,
	).Scan(&app.ID, &app.OrderNo, &app.Status, &app.Version, &app.CreatorID)
	if err != nil {
		return ActionResponse{Success: false, Code: "NOT_FOUND", Message: "单据不存在", OrderNo: ""}
	}

	if ctx.Role != "warehouse_clerk" {
		return ActionResponse{Success: false, Code: "ROLE_FORBIDDEN", Message: fmt.Sprintf("当前角色[%s]无权执行此操作，需要[warehouse_clerk]角色", ctx.Role), OrderNo: app.OrderNo}
	}

	if app.CreatorID != ctx.UserID {
		return ActionResponse{Success: false, Code: "CROSS_ROLE", Message: "您不是当前处理人，无法执行此操作", OrderNo: app.OrderNo}
	}

	if app.Status == "pending_temp" {
		return ActionResponse{Success: false, Code: "DUPLICATE_SUBMIT", Message: fmt.Sprintf("请勿重复提交，单据已处于[%s]状态", statusLabel(app.Status)), OrderNo: app.OrderNo}
	}

	if app.Status != "pending_correction" {
		return ActionResponse{Success: false, Code: "STATUS_CONFLICT", Message: fmt.Sprintf("单据当前状态为[%s]，无法执行[修正]操作，需要[pending_correction]状态", statusLabel(app.Status)), OrderNo: app.OrderNo}
	}

	if ctx.Version != app.Version {
		return ActionResponse{Success: false, Code: "VERSION_CONFLICT", Message: fmt.Sprintf("单据已被他人修改，当前版本为%d，请刷新后重试", app.Version), OrderNo: app.OrderNo}
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	tx, err := DB.Begin()
	if err != nil {
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "数据库错误", OrderNo: app.OrderNo}
	}

	_, err = tx.Exec(
		"UPDATE applications SET status = ?, current_step = ?, correction_note = '', version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
		"pending_temp", "allocation", now, ctx.AppID, ctx.Version,
	)
	if err != nil {
		tx.Rollback()
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "更新失败", OrderNo: app.OrderNo}
	}

	_, err = tx.Exec(
		"INSERT INTO processing_records (application_id, operator_id, action, from_status, to_status, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		ctx.AppID, ctx.UserID, "correct", "pending_correction", "pending_temp", "", now,
	)
	if err != nil {
		tx.Rollback()
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "创建处理记录失败", OrderNo: app.OrderNo}
	}

	if err := tx.Commit(); err != nil {
		return ActionResponse{Success: false, Code: "DB_ERROR", Message: "提交失败", OrderNo: app.OrderNo}
	}

	return ActionResponse{Success: true, OrderNo: app.OrderNo}
}

func statusLabel(status string) string {
	labels := map[string]string{
		"draft":              "草稿",
		"pending_temp":       "待温控分配",
		"pending_correction": "待修正",
		"under_review":       "审核中",
		"completed":          "已完成",
	}
	if label, ok := labels[status]; ok {
		return label
	}
	return status
}

func ListApplications(c *gin.Context) {
	var query models.ApplicationQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "查询参数无效"})
		return
	}

	sqlStr := `SELECT id, order_no, product_name, product_count, expected_date, appointment_time,
		temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at
		FROM applications WHERE 1=1`
	args := []interface{}{}

	if query.Status != "" {
		sqlStr += " AND status = ?"
		args = append(args, query.Status)
	}

	if query.Search != "" {
		sqlStr += " AND (order_no LIKE ? OR product_name LIKE ?)"
		search := "%" + query.Search + "%"
		args = append(args, search, search)
	}

	sqlStr += " ORDER BY created_at DESC"

	rows, err := DB.Query(sqlStr, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "查询失败"})
		return
	}
	defer rows.Close()

	var apps []models.Application
	for rows.Next() {
		var app models.Application
		err := rows.Scan(
			&app.ID, &app.OrderNo, &app.ProductName, &app.ProductCount,
			&app.ExpectedDate, &app.AppointmentTime, &app.TemperatureZone,
			&app.Status, &app.CurrentStep, &app.CreatorID, &app.HandlerID,
			&app.Version, &app.CorrectionNote, &app.CreatedAt, &app.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "数据解析失败"})
			return
		}
		app.ExpiryGroup = calculateExpiryGroup(app.ExpectedDate)
		apps = append(apps, app)
	}

	if query.Role != "" {
		filtered := []models.Application{}
		for _, app := range apps {
			switch query.Role {
			case "warehouse_clerk":
				userID, _ := c.Get("userID")
				if app.CreatorID == userID.(int64) {
					filtered = append(filtered, app)
				}
			case "temp_supervisor":
				if app.Status == "pending_temp" || app.Status == "pending_correction" {
					filtered = append(filtered, app)
				}
			case "warehouse_manager":
				if app.Status == "under_review" || app.Status == "pending_correction" || app.Status == "completed" {
					filtered = append(filtered, app)
				}
			default:
				filtered = append(filtered, app)
			}
		}
		apps = filtered
	}

	if query.ExpiryGroup != "" {
		filtered := []models.Application{}
		for _, app := range apps {
			if app.ExpiryGroup == query.ExpiryGroup {
				filtered = append(filtered, app)
			}
		}
		apps = filtered
	}

	for i := range apps {
		fillNames(&apps[i])
	}

	c.JSON(http.StatusOK, gin.H{"applications": apps})
}

func CreateApplication(c *gin.Context) {
	role, _ := c.Get("role")
	if role.(string) != "warehouse_clerk" {
		c.JSON(http.StatusForbidden, models.APIError{Code: "ROLE_FORBIDDEN", Message: "当前角色无权创建入库单，需要[warehouse_clerk]角色"})
		return
	}

	var app models.Application
	if err := c.ShouldBindJSON(&app); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	userID, _ := c.Get("userID")

	var maxOrderNo string
	err := DB.QueryRow("SELECT MAX(order_no) FROM applications WHERE order_no LIKE 'CC-2026-%'").Scan(&maxOrderNo)
	var nextNum int
	if err != nil || maxOrderNo == "" {
		nextNum = 1
	} else {
		var currentNum int
		fmt.Sscanf(maxOrderNo, "CC-2026-%d", &currentNum)
		nextNum = currentNum + 1
	}

	orderNo := fmt.Sprintf("CC-2026-%03d", nextNum)
	now := time.Now().Format("2006-01-02 15:04:05")

	tx, err := DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "数据库错误"})
		return
	}

	res, err := tx.Exec(
		`INSERT INTO applications (order_no, product_name, product_count, expected_date, appointment_time,
		 temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		orderNo, app.ProductName, app.ProductCount, app.ExpectedDate, app.AppointmentTime,
		app.TemperatureZone, "draft", "appointment", userID.(int64), 0, 1, "", now, now,
	)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "创建失败"})
		return
	}

	appID, _ := res.LastInsertId()

	_, err = tx.Exec(
		"INSERT INTO processing_records (application_id, operator_id, action, from_status, to_status, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		appID, userID.(int64), "create", "", "draft", "", now,
	)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "创建处理记录失败"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "提交失败"})
		return
	}

	var created models.Application
	DB.QueryRow(
		`SELECT id, order_no, product_name, product_count, expected_date, appointment_time,
		 temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at
		 FROM applications WHERE id = ?`, appID,
	).Scan(
		&created.ID, &created.OrderNo, &created.ProductName, &created.ProductCount,
		&created.ExpectedDate, &created.AppointmentTime, &created.TemperatureZone,
		&created.Status, &created.CurrentStep, &created.CreatorID, &created.HandlerID,
		&created.Version, &created.CorrectionNote, &created.CreatedAt, &created.UpdatedAt,
	)
	created.ExpiryGroup = calculateExpiryGroup(created.ExpectedDate)
	fillNames(&created)

	c.JSON(http.StatusCreated, gin.H{"application": created})
}

func GetApplication(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	var app models.Application
	err = DB.QueryRow(
		`SELECT id, order_no, product_name, product_count, expected_date, appointment_time,
		 temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at
		 FROM applications WHERE id = ?`, id,
	).Scan(
		&app.ID, &app.OrderNo, &app.ProductName, &app.ProductCount,
		&app.ExpectedDate, &app.AppointmentTime, &app.TemperatureZone,
		&app.Status, &app.CurrentStep, &app.CreatorID, &app.HandlerID,
		&app.Version, &app.CorrectionNote, &app.CreatedAt, &app.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIError{Code: "NOT_FOUND", Message: "单据不存在"})
		return
	}

	app.ExpiryGroup = calculateExpiryGroup(app.ExpectedDate)
	fillNames(&app)

	c.JSON(http.StatusOK, gin.H{"application": app})
}

func UpdateApplication(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	versionVal, ok := body["version"]
	if !ok {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "缺少version字段"})
		return
	}
	reqVersion := int(versionVal.(float64))

	var app models.Application
	err = DB.QueryRow(
		"SELECT id, status, version, creator_id, handler_id FROM applications WHERE id = ?",
		id,
	).Scan(&app.ID, &app.Status, &app.Version, &app.CreatorID, &app.HandlerID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIError{Code: "NOT_FOUND", Message: "单据不存在"})
		return
	}

	if app.Status != "draft" && app.Status != "pending_correction" {
		c.JSON(http.StatusConflict, models.APIError{Code: "STATUS_CONFLICT", Message: fmt.Sprintf("单据当前状态为[%s]，无法执行[编辑]操作，需要[draft或pending_correction]状态", statusLabel(app.Status))})
		return
	}

	if reqVersion != app.Version {
		c.JSON(http.StatusConflict, models.APIError{Code: "VERSION_CONFLICT", Message: fmt.Sprintf("单据已被他人修改，当前版本为%d，请刷新后重试", app.Version)})
		return
	}

	userID, _ := c.Get("userID")
	uid := userID.(int64)
	if uid != app.CreatorID && uid != app.HandlerID {
		c.JSON(http.StatusForbidden, models.APIError{Code: "CROSS_ROLE", Message: "您不是当前处理人，无法执行此操作"})
		return
	}

	setClauses := []string{}
	args := []interface{}{}

	if v, ok := body["product_name"]; ok {
		setClauses = append(setClauses, "product_name = ?")
		args = append(args, v)
	}
	if v, ok := body["product_count"]; ok {
		setClauses = append(setClauses, "product_count = ?")
		args = append(args, int(v.(float64)))
	}
	if v, ok := body["expected_date"]; ok {
		setClauses = append(setClauses, "expected_date = ?")
		args = append(args, v)
	}
	if v, ok := body["appointment_time"]; ok {
		setClauses = append(setClauses, "appointment_time = ?")
		args = append(args, v)
	}
	if v, ok := body["temperature_zone"]; ok {
		setClauses = append(setClauses, "temperature_zone = ?")
		args = append(args, v)
	}

	if len(setClauses) == 0 {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "没有需要更新的字段"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	setClauses = append(setClauses, "version = version + 1", "updated_at = ?")
	args = append(args, now, id, app.Version)

	sqlStr := "UPDATE applications SET " + strings.Join(setClauses, ", ") + " WHERE id = ? AND version = ?"
	res, err := DB.Exec(sqlStr, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "更新失败"})
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusConflict, models.APIError{Code: "VERSION_CONFLICT", Message: "单据已被他人修改，请刷新后重试"})
		return
	}

	var updated models.Application
	DB.QueryRow(
		`SELECT id, order_no, product_name, product_count, expected_date, appointment_time,
		 temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at
		 FROM applications WHERE id = ?`, id,
	).Scan(
		&updated.ID, &updated.OrderNo, &updated.ProductName, &updated.ProductCount,
		&updated.ExpectedDate, &updated.AppointmentTime, &updated.TemperatureZone,
		&updated.Status, &updated.CurrentStep, &updated.CreatorID, &updated.HandlerID,
		&updated.Version, &updated.CorrectionNote, &updated.CreatedAt, &updated.UpdatedAt,
	)
	updated.ExpiryGroup = calculateExpiryGroup(updated.ExpectedDate)
	fillNames(&updated)

	c.JSON(http.StatusOK, gin.H{"application": updated})
}

func SubmitApplication(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	userID, _ := c.Get("userID")
	role, _ := c.Get("role")
	version := int(body["version"].(float64))

	result := doSubmit(ActionContext{
		AppID:   id,
		UserID:  userID.(int64),
		Role:    role.(string),
		Version: version,
	})

	if !result.Success {
		status := http.StatusBadRequest
		if result.Code == "ROLE_FORBIDDEN" || result.Code == "CROSS_ROLE" {
			status = http.StatusForbidden
		} else if result.Code == "VERSION_CONFLICT" || result.Code == "STATUS_CONFLICT" || result.Code == "DUPLICATE_SUBMIT" {
			status = http.StatusConflict
		} else if result.Code == "NOT_FOUND" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.APIError{Code: result.Code, Message: result.Message})
		return
	}

	var app models.Application
	DB.QueryRow(
		`SELECT id, order_no, product_name, product_count, expected_date, appointment_time,
		 temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at
		 FROM applications WHERE id = ?`, id,
	).Scan(
		&app.ID, &app.OrderNo, &app.ProductName, &app.ProductCount,
		&app.ExpectedDate, &app.AppointmentTime, &app.TemperatureZone,
		&app.Status, &app.CurrentStep, &app.CreatorID, &app.HandlerID,
		&app.Version, &app.CorrectionNote, &app.CreatedAt, &app.UpdatedAt,
	)
	app.ExpiryGroup = calculateExpiryGroup(app.ExpectedDate)
	fillNames(&app)

	c.JSON(http.StatusOK, gin.H{"application": app})
}

func AllocateApplication(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	userID, _ := c.Get("userID")
	role, _ := c.Get("role")
	version := int(body["version"].(float64))
	temperatureZone, _ := body["temperature_zone"].(string)

	result := doAllocate(ActionContext{
		AppID:           id,
		UserID:          userID.(int64),
		Role:            role.(string),
		Version:         version,
		TemperatureZone: temperatureZone,
	})

	if !result.Success {
		status := http.StatusBadRequest
		if result.Code == "ROLE_FORBIDDEN" || result.Code == "CROSS_ROLE" {
			status = http.StatusForbidden
		} else if result.Code == "VERSION_CONFLICT" || result.Code == "STATUS_CONFLICT" || result.Code == "DUPLICATE_SUBMIT" {
			status = http.StatusConflict
		} else if result.Code == "NOT_FOUND" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.APIError{Code: result.Code, Message: result.Message})
		return
	}

	var app models.Application
	DB.QueryRow(
		`SELECT id, order_no, product_name, product_count, expected_date, appointment_time,
		 temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at
		 FROM applications WHERE id = ?`, id,
	).Scan(
		&app.ID, &app.OrderNo, &app.ProductName, &app.ProductCount,
		&app.ExpectedDate, &app.AppointmentTime, &app.TemperatureZone,
		&app.Status, &app.CurrentStep, &app.CreatorID, &app.HandlerID,
		&app.Version, &app.CorrectionNote, &app.CreatedAt, &app.UpdatedAt,
	)
	app.ExpiryGroup = calculateExpiryGroup(app.ExpectedDate)
	fillNames(&app)

	c.JSON(http.StatusOK, gin.H{"application": app})
}

func ConfirmApplication(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	userID, _ := c.Get("userID")
	role, _ := c.Get("role")
	version := int(body["version"].(float64))

	result := doConfirm(ActionContext{
		AppID:   id,
		UserID:  userID.(int64),
		Role:    role.(string),
		Version: version,
	})

	if !result.Success {
		status := http.StatusBadRequest
		if result.Code == "ROLE_FORBIDDEN" || result.Code == "CROSS_ROLE" {
			status = http.StatusForbidden
		} else if result.Code == "VERSION_CONFLICT" || result.Code == "STATUS_CONFLICT" || result.Code == "DUPLICATE_SUBMIT" {
			status = http.StatusConflict
		} else if result.Code == "NOT_FOUND" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.APIError{Code: result.Code, Message: result.Message})
		return
	}

	var app models.Application
	DB.QueryRow(
		`SELECT id, order_no, product_name, product_count, expected_date, appointment_time,
		 temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at
		 FROM applications WHERE id = ?`, id,
	).Scan(
		&app.ID, &app.OrderNo, &app.ProductName, &app.ProductCount,
		&app.ExpectedDate, &app.AppointmentTime, &app.TemperatureZone,
		&app.Status, &app.CurrentStep, &app.CreatorID, &app.HandlerID,
		&app.Version, &app.CorrectionNote, &app.CreatedAt, &app.UpdatedAt,
	)
	app.ExpiryGroup = calculateExpiryGroup(app.ExpectedDate)
	fillNames(&app)

	c.JSON(http.StatusOK, gin.H{"application": app})
}

func ReturnApplication(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	userID, _ := c.Get("userID")
	role, _ := c.Get("role")
	version := int(body["version"].(float64))
	correctionNote, _ := body["correction_note"].(string)

	result := doReturn(ActionContext{
		AppID:          id,
		UserID:         userID.(int64),
		Role:           role.(string),
		Version:        version,
		CorrectionNote: correctionNote,
	})

	if !result.Success {
		status := http.StatusBadRequest
		if result.Code == "ROLE_FORBIDDEN" || result.Code == "CROSS_ROLE" {
			status = http.StatusForbidden
		} else if result.Code == "VERSION_CONFLICT" || result.Code == "STATUS_CONFLICT" || result.Code == "DUPLICATE_SUBMIT" {
			status = http.StatusConflict
		} else if result.Code == "NOT_FOUND" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.APIError{Code: result.Code, Message: result.Message})
		return
	}

	var app models.Application
	DB.QueryRow(
		`SELECT id, order_no, product_name, product_count, expected_date, appointment_time,
		 temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at
		 FROM applications WHERE id = ?`, id,
	).Scan(
		&app.ID, &app.OrderNo, &app.ProductName, &app.ProductCount,
		&app.ExpectedDate, &app.AppointmentTime, &app.TemperatureZone,
		&app.Status, &app.CurrentStep, &app.CreatorID, &app.HandlerID,
		&app.Version, &app.CorrectionNote, &app.CreatedAt, &app.UpdatedAt,
	)
	app.ExpiryGroup = calculateExpiryGroup(app.ExpectedDate)
	fillNames(&app)

	c.JSON(http.StatusOK, gin.H{"application": app})
}

func CorrectApplication(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	userID, _ := c.Get("userID")
	role, _ := c.Get("role")
	version := int(body["version"].(float64))

	result := doCorrect(ActionContext{
		AppID:   id,
		UserID:  userID.(int64),
		Role:    role.(string),
		Version: version,
	})

	if !result.Success {
		status := http.StatusBadRequest
		if result.Code == "ROLE_FORBIDDEN" || result.Code == "CROSS_ROLE" {
			status = http.StatusForbidden
		} else if result.Code == "VERSION_CONFLICT" || result.Code == "STATUS_CONFLICT" || result.Code == "DUPLICATE_SUBMIT" {
			status = http.StatusConflict
		} else if result.Code == "NOT_FOUND" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.APIError{Code: result.Code, Message: result.Message})
		return
	}

	var app models.Application
	DB.QueryRow(
		`SELECT id, order_no, product_name, product_count, expected_date, appointment_time,
		 temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at
		 FROM applications WHERE id = ?`, id,
	).Scan(
		&app.ID, &app.OrderNo, &app.ProductName, &app.ProductCount,
		&app.ExpectedDate, &app.AppointmentTime, &app.TemperatureZone,
		&app.Status, &app.CurrentStep, &app.CreatorID, &app.HandlerID,
		&app.Version, &app.CorrectionNote, &app.CreatedAt, &app.UpdatedAt,
	)
	app.ExpiryGroup = calculateExpiryGroup(app.ExpectedDate)
	fillNames(&app)

	c.JSON(http.StatusOK, gin.H{"application": app})
}

func GetRecords(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	rows, err := DB.Query(
		`SELECT pr.id, pr.application_id, pr.operator_id, u.display_name, pr.action, pr.from_status, pr.to_status, pr.remark, pr.created_at
		 FROM processing_records pr LEFT JOIN users u ON pr.operator_id = u.id
		 WHERE pr.application_id = ? ORDER BY pr.created_at ASC`, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "查询失败"})
		return
	}
	defer rows.Close()

	var records []models.ProcessingRecord
	for rows.Next() {
		var r models.ProcessingRecord
		rows.Scan(&r.ID, &r.ApplicationID, &r.OperatorID, &r.OperatorName, &r.Action, &r.FromStatus, &r.ToStatus, &r.Remark, &r.CreatedAt)
		records = append(records, r)
	}

	c.JSON(http.StatusOK, gin.H{"records": records})
}

func GetAuditNotes(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	rows, err := DB.Query(
		`SELECT an.id, an.application_id, an.operator_id, u.display_name, an.content, an.created_at
		 FROM audit_notes an LEFT JOIN users u ON an.operator_id = u.id
		 WHERE an.application_id = ? ORDER BY an.created_at ASC`, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "查询失败"})
		return
	}
	defer rows.Close()

	var notes []models.AuditNote
	for rows.Next() {
		var n models.AuditNote
		rows.Scan(&n.ID, &n.ApplicationID, &n.OperatorID, &n.OperatorName, &n.Content, &n.CreatedAt)
		notes = append(notes, n)
	}

	c.JSON(http.StatusOK, gin.H{"audit_notes": notes})
}

func AddAuditNote(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	var body struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	if body.Content == "" {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "EVIDENCE_MISSING", Message: "缺少必要证据：content，请补充后再提交"})
		return
	}

	userID, _ := c.Get("userID")
	now := time.Now().Format("2006-01-02 15:04:05")

	res, err := DB.Exec(
		"INSERT INTO audit_notes (application_id, operator_id, content, created_at) VALUES (?, ?, ?, ?)",
		id, userID.(int64), body.Content, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "创建审计备注失败"})
		return
	}

	noteID, _ := res.LastInsertId()

	var note models.AuditNote
	DB.QueryRow(
		`SELECT an.id, an.application_id, an.operator_id, u.display_name, an.content, an.created_at
		 FROM audit_notes an LEFT JOIN users u ON an.operator_id = u.id
		 WHERE an.id = ?`, noteID,
	).Scan(&note.ID, &note.ApplicationID, &note.OperatorID, &note.OperatorName, &note.Content, &note.CreatedAt)

	c.JSON(http.StatusCreated, gin.H{"audit_note": note})
}

func GetExceptions(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	rows, err := DB.Query(
		`SELECT er.id, er.application_id, er.operator_id, u.display_name, er.reason_type, er.description, er.created_at
		 FROM exception_reasons er LEFT JOIN users u ON er.operator_id = u.id
		 WHERE er.application_id = ? ORDER BY er.created_at ASC`, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "查询失败"})
		return
	}
	defer rows.Close()

	var exceptions []models.ExceptionReason
	for rows.Next() {
		var e models.ExceptionReason
		rows.Scan(&e.ID, &e.ApplicationID, &e.OperatorID, &e.OperatorName, &e.ReasonType, &e.Description, &e.CreatedAt)
		exceptions = append(exceptions, e)
	}

	c.JSON(http.StatusOK, gin.H{"exceptions": exceptions})
}

func GetAttachments(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	rows, err := DB.Query(
		`SELECT a.id, a.application_id, a.file_name, a.file_type, a.uploaded_by, u.display_name, a.created_at
		 FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id
		 WHERE a.application_id = ? ORDER BY a.created_at ASC`, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "查询失败"})
		return
	}
	defer rows.Close()

	var attachments []models.Attachment
	for rows.Next() {
		var a models.Attachment
		rows.Scan(&a.ID, &a.ApplicationID, &a.FileName, &a.FileType, &a.UploadedBy, &a.UploadedByName, &a.CreatedAt)
		attachments = append(attachments, a)
	}

	c.JSON(http.StatusOK, gin.H{"attachments": attachments})
}

func AddAttachment(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "无效的ID"})
		return
	}

	var body struct {
		FileName string `json:"file_name"`
		FileType string `json:"file_type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	if body.FileName == "" || body.FileType == "" {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "EVIDENCE_MISSING", Message: "缺少必要证据：file_name和file_type，请补充后再提交"})
		return
	}

	userID, _ := c.Get("userID")
	now := time.Now().Format("2006-01-02 15:04:05")

	res, err := DB.Exec(
		"INSERT INTO attachments (application_id, file_name, file_type, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?)",
		id, body.FileName, body.FileType, userID.(int64), now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "创建附件记录失败"})
		return
	}

	attachID, _ := res.LastInsertId()

	var att models.Attachment
	DB.QueryRow(
		`SELECT a.id, a.application_id, a.file_name, a.file_type, a.uploaded_by, u.display_name, a.created_at
		 FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id
		 WHERE a.id = ?`, attachID,
	).Scan(&att.ID, &att.ApplicationID, &att.FileName, &att.FileType, &att.UploadedBy, &att.UploadedByName, &att.CreatedAt)

	c.JSON(http.StatusCreated, gin.H{"attachment": att})
}
