package main

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"water-biz-backend/internal/auth"
	"water-biz-backend/internal/database"
	"water-biz-backend/internal/middleware"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
)

const (
	frontendPort = 3002
	backendPort  = 8002
)

func main() {
	dbPath := "./data/water_biz.db"
	os.MkdirAll("./data", 0755)

	db, err := database.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	if err := database.SeedDemoData(db); err != nil {
		log.Fatalf("Failed to seed demo data: %v", err)
	}

	r := chi.NewRouter()

	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)

	corsOpts := middleware.CORSOptions{
		AllowedOrigins:   []string{fmt.Sprintf("http://localhost:%d", frontendPort)},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           300,
	}
	r.Use(middleware.CORS(corsOpts))

	r.Options("/*", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	r.Post("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		loginHandler(db, w, r)
	})

	r.Get("/api/auth/me", middleware.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		user := auth.GetCurrentUser(r)
		writeJSON(w, http.StatusOK, user)
	}))

	r.Route("/api/applications", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware)

		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			listApplications(db, w, r)
		})

		r.Get("/stats/warning", func(w http.ResponseWriter, r *http.Request) {
			getWarningStats(db, w, r)
		})

		r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
			getApplicationDetail(db, w, r)
		})

		r.Post("/", func(w http.ResponseWriter, r *http.Request) {
			createApplication(db, w, r)
		})

		r.Patch("/{id}/status", func(w http.ResponseWriter, r *http.Request) {
			updateApplicationStatus(db, w, r)
		})

		r.Post("/batch/process", func(w http.ResponseWriter, r *http.Request) {
			batchProcessApplications(db, w, r)
		})

		r.Get("/export/csv", func(w http.ResponseWriter, r *http.Request) {
			exportApplicationsCSV(db, w, r)
		})

		r.Get("/{id}/audit-logs", func(w http.ResponseWriter, r *http.Request) {
			getAuditLogs(db, w, r)
		})

		r.Post("/{id}/remarks", func(w http.ResponseWriter, r *http.Request) {
			addRemark(db, w, r)
		})
	})

	addr := fmt.Sprintf(":%d", backendPort)
	log.Printf("Backend server starting on port %d...", backendPort)
	log.Printf("Frontend expected on port %d", frontendPort)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string     `json:"token"`
	User  *auth.User `json:"user"`
}

func loginHandler(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	user, err := auth.AuthenticateUser(db, req.Username, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}

	token, err := auth.GenerateToken(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成令牌失败")
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{Token: token, User: user})
}

type listQuery struct {
	Status   string
	Warning  string
	Keyword  string
	Page     int
	PageSize int
}

func parseListQuery(r *http.Request) listQuery {
	q := listQuery{
		Status:   r.URL.Query().Get("status"),
		Warning:  r.URL.Query().Get("warning"),
		Keyword:  r.URL.Query().Get("keyword"),
		Page:     1,
		PageSize: 20,
	}
	if p := r.URL.Query().Get("page"); p != "" {
		if pi, err := strconv.Atoi(p); err == nil && pi > 0 {
			q.Page = pi
		}
	}
	if ps := r.URL.Query().Get("pageSize"); ps != "" {
		if psi, err := strconv.Atoi(ps); err == nil && psi > 0 && psi <= 100 {
			q.PageSize = psi
		}
	}
	return q
}

func listApplications(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	q := parseListQuery(r)
	user := auth.GetCurrentUser(r)

	offset := (q.Page - 1) * q.PageSize

	whereClauses := []string{"1=1"}
	var args []interface{}
	argIdx := 1

	if q.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	if q.Warning != "" {
		today := time.Now()
		switch q.Warning {
		case "normal":
			whereClauses = append(whereClauses, fmt.Sprintf("a.due_date > $%d", argIdx))
			args = append(args, today.AddDate(0, 0, 3).Format("2006-01-02"))
			argIdx++
		case "warning":
			whereClauses = append(whereClauses, fmt.Sprintf("a.due_date <= $%d AND a.due_date > $%d", argIdx, argIdx+1))
			args = append(args, today.AddDate(0, 0, 3).Format("2006-01-02"), today.Format("2006-01-02"))
			argIdx += 2
		case "overdue":
			whereClauses = append(whereClauses, fmt.Sprintf("a.due_date < $%d", argIdx))
			args = append(args, today.Format("2006-01-02"))
			argIdx++
		}
	}

	if q.Keyword != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(a.applicant_name LIKE $%d OR a.application_no LIKE $%d OR a.address LIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+q.Keyword+"%")
		argIdx++
	}

	if user.Role == "meter_supervisor" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.current_handler = $%d OR a.status = $%d", argIdx, argIdx+1))
		args = append(args, user.ID, "待派发")
		argIdx += 2
	} else if user.Role == "window_staff" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.created_by = $%d", argIdx))
		args = append(args, user.ID)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countSQL := fmt.Sprintf(`SELECT COUNT(*) FROM account_applications a WHERE %s`, whereSQL)
	var total int
	if err := db.QueryRow(countSQL, args...).Scan(&total); err != nil {
		writeError(w, http.StatusInternalServerError, "查询数据失败")
		return
	}

	listSQL := fmt.Sprintf(`
		SELECT a.id, a.application_no, a.applicant_name, a.id_card, a.address, 
		       a.phone, a.status, a.current_handler, a.created_by, a.created_at,
		       a.due_date, a.version, a.exception_reason, a.material_status
		FROM account_applications a
		WHERE %s
		ORDER BY 
			CASE a.status
				WHEN '待派发' THEN 1
				WHEN '处理中' THEN 2
				WHEN '已关闭' THEN 3
				ELSE 4
			END,
			a.due_date ASC,
			a.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)
	args = append(args, q.PageSize, offset)

	rows, err := db.Query(listSQL, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询数据失败")
		return
	}
	defer rows.Close()

	var apps []map[string]interface{}
	today := time.Now()
	for rows.Next() {
		var app struct {
			ID              string
			ApplicationNo   string
			ApplicantName   string
			IDCard          string
			Address         string
			Phone           string
			Status          string
			CurrentHandler  sql.NullString
			CreatedBy       string
			CreatedAt       time.Time
			DueDate         sql.NullString
			Version         int
			ExceptionReason sql.NullString
			MaterialStatus  sql.NullString
		}
		if err := rows.Scan(&app.ID, &app.ApplicationNo, &app.ApplicantName, &app.IDCard,
			&app.Address, &app.Phone, &app.Status, &app.CurrentHandler, &app.CreatedBy,
			&app.CreatedAt, &app.DueDate, &app.Version, &app.ExceptionReason, &app.MaterialStatus); err != nil {
			continue
		}

		warningLevel := "normal"
		if app.DueDate.Valid {
			due, _ := time.Parse("2006-01-02", app.DueDate.String)
			daysLeft := int(due.Sub(today).Hours() / 24)
			if daysLeft < 0 {
				warningLevel = "overdue"
			} else if daysLeft <= 3 {
				warningLevel = "warning"
			}
		}

		handlerName := ""
		if app.CurrentHandler.Valid {
			handlerName = getUserNameByID(db, app.CurrentHandler.String)
		}
		creatorName := getUserNameByID(db, app.CreatedBy)

		apps = append(apps, map[string]interface{}{
			"id":               app.ID,
			"applicationNo":    app.ApplicationNo,
			"applicantName":    app.ApplicantName,
			"idCard":           app.IDCard,
			"address":          app.Address,
			"phone":            app.Phone,
			"status":           app.Status,
			"currentHandlerId": app.CurrentHandler.String,
			"currentHandler":   handlerName,
			"createdBy":        app.CreatedBy,
			"creatorName":      creatorName,
			"createdAt":        app.CreatedAt.Format("2006-01-02 15:04:05"),
			"dueDate":          app.DueDate.String,
			"warningLevel":     warningLevel,
			"version":          app.Version,
			"exceptionReason":  app.ExceptionReason.String,
			"materialStatus":   app.MaterialStatus.String,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"list":     apps,
		"total":    total,
		"page":     q.Page,
		"pageSize": q.PageSize,
	})
}

func getUserNameByID(db *sql.DB, userID string) string {
	var name string
	err := db.QueryRow("SELECT real_name FROM users WHERE id = ?", userID).Scan(&name)
	if err != nil {
		return ""
	}
	return name
}

func getWarningStats(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	user := auth.GetCurrentUser(r)
	today := time.Now()
	threeDaysLater := today.AddDate(0, 0, 3)

	baseWhere := "1=1"
	var args []interface{}
	if user.Role == "window_staff" {
		baseWhere = "created_by = ?"
		args = append(args, user.ID)
	} else if user.Role == "meter_supervisor" {
		baseWhere = "(current_handler = ? OR status = ?)"
		args = append(args, user.ID, "待派发")
	}

	var total int
	db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM account_applications WHERE %s", baseWhere), args...).Scan(&total)

	var pending int
	db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM account_applications WHERE %s AND status = ?", baseWhere), append(args, "待派发")...).Scan(&pending)

	var processing int
	db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM account_applications WHERE %s AND status = ?", baseWhere), append(args, "处理中")...).Scan(&processing)

	var closed int
	db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM account_applications WHERE %s AND status = ?", baseWhere), append(args, "已关闭")...).Scan(&closed)

	var normal int
	db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM account_applications WHERE %s AND due_date > ? AND status != ?", baseWhere),
		append(args, threeDaysLater.Format("2006-01-02"), "已关闭")...).Scan(&normal)

	var warning int
	db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM account_applications WHERE %s AND due_date <= ? AND due_date > ? AND status != ?", baseWhere),
		append(args, threeDaysLater.Format("2006-01-02"), today.Format("2006-01-02"), "已关闭")...).Scan(&warning)

	var overdue int
	db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM account_applications WHERE %s AND due_date < ? AND status != ?", baseWhere),
		append(args, today.Format("2006-01-02"), "已关闭")...).Scan(&overdue)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total":      total,
		"pending":    pending,
		"processing": processing,
		"closed":     closed,
		"normal":     normal,
		"warning":    warning,
		"overdue":    overdue,
	})
}

func getApplicationDetail(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var app struct {
		ID               string
		ApplicationNo    string
		ApplicantName    string
		IDCard           string
		Address          string
		Phone            string
		WaterUsageType   string
		Status           string
		CurrentHandler   sql.NullString
		CreatedBy        string
		CreatedAt        time.Time
		UpdatedAt        time.Time
		DueDate          sql.NullString
		Version          int
		ExceptionReason  sql.NullString
		MaterialStatus   sql.NullString
		MeterNo          sql.NullString
		InstallationAddr sql.NullString
		ReviewRemark     sql.NullString
	}

	err := db.QueryRow(`
		SELECT id, application_no, applicant_name, id_card, address, phone,
		       water_usage_type, status, current_handler, created_by, created_at,
		       updated_at, due_date, version, exception_reason, material_status,
		       meter_no, installation_addr, review_remark
		FROM account_applications WHERE id = ?
	`, id).Scan(&app.ID, &app.ApplicationNo, &app.ApplicantName, &app.IDCard,
		&app.Address, &app.Phone, &app.WaterUsageType, &app.Status,
		&app.CurrentHandler, &app.CreatedBy, &app.CreatedAt, &app.UpdatedAt,
		&app.DueDate, &app.Version, &app.ExceptionReason, &app.MaterialStatus,
		&app.MeterNo, &app.InstallationAddr, &app.ReviewRemark)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "开户申请不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询详情失败")
		return
	}

	handlerName := ""
	if app.CurrentHandler.Valid {
		handlerName = getUserNameByID(db, app.CurrentHandler.String)
	}

	attachments := getAttachments(db, id)
	processingRecords := getProcessingRecords(db, id)
	auditRemarks := getAuditRemarks(db, id)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":                app.ID,
		"applicationNo":     app.ApplicationNo,
		"applicantName":     app.ApplicantName,
		"idCard":            app.IDCard,
		"address":           app.Address,
		"phone":             app.Phone,
		"waterUsageType":    app.WaterUsageType,
		"status":            app.Status,
		"currentHandlerId":  app.CurrentHandler.String,
		"currentHandler":    handlerName,
		"createdBy":         app.CreatedBy,
		"creatorName":       getUserNameByID(db, app.CreatedBy),
		"createdAt":         app.CreatedAt.Format("2006-01-02 15:04:05"),
		"updatedAt":         app.UpdatedAt.Format("2006-01-02 15:04:05"),
		"dueDate":           app.DueDate.String,
		"version":           app.Version,
		"exceptionReason":   app.ExceptionReason.String,
		"materialStatus":    app.MaterialStatus.String,
		"meterNo":           app.MeterNo.String,
		"installationAddr":  app.InstallationAddr.String,
		"reviewRemark":      app.ReviewRemark.String,
		"attachments":       attachments,
		"processingRecords": processingRecords,
		"auditRemarks":      auditRemarks,
	})
}

func getAttachments(db *sql.DB, appID string) []map[string]interface{} {
	rows, err := db.Query(`
		SELECT id, file_name, file_type, file_size, uploaded_by, uploaded_at
		FROM attachments WHERE application_id = ? ORDER BY uploaded_at DESC
	`, appID)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	var list []map[string]interface{}
	for rows.Next() {
		var id, fileName, fileType, uploadedBy string
		var fileSize int64
		var uploadedAt time.Time
		if err := rows.Scan(&id, &fileName, &fileType, &fileSize, &uploadedBy, &uploadedAt); err != nil {
			continue
		}
		list = append(list, map[string]interface{}{
			"id":         id,
			"fileName":   fileName,
			"fileType":   fileType,
			"fileSize":   fileSize,
			"uploadedBy": getUserNameByID(db, uploadedBy),
			"uploadedAt": uploadedAt.Format("2006-01-02 15:04:05"),
		})
	}
	return list
}

func getProcessingRecords(db *sql.DB, appID string) []map[string]interface{} {
	rows, err := db.Query(`
		SELECT id, node_name, operator, previous_status, new_status, 
		       action, remark, exception_reason, created_at
		FROM processing_records 
		WHERE application_id = ? 
		ORDER BY created_at DESC
	`, appID)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	var list []map[string]interface{}
	for rows.Next() {
		var id, nodeName, operatorID, prevStatus, newStatus, action string
		var remark, excReason sql.NullString
		var createdAt time.Time
		if err := rows.Scan(&id, &nodeName, &operatorID, &prevStatus, &newStatus,
			&action, &remark, &excReason, &createdAt); err != nil {
			continue
		}
		list = append(list, map[string]interface{}{
			"id":              id,
			"nodeName":        nodeName,
			"operator":        getUserNameByID(db, operatorID),
			"operatorId":      operatorID,
			"previousStatus":  prevStatus,
			"newStatus":       newStatus,
			"action":          action,
			"remark":          remark.String,
			"exceptionReason": excReason.String,
			"createdAt":       createdAt.Format("2006-01-02 15:04:05"),
		})
	}
	return list
}

func getAuditRemarks(db *sql.DB, appID string) []map[string]interface{} {
	rows, err := db.Query(`
		SELECT id, operator, remark, created_at
		FROM audit_remarks 
		WHERE application_id = ? 
		ORDER BY created_at DESC
	`, appID)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	var list []map[string]interface{}
	for rows.Next() {
		var id, operatorID, remark string
		var createdAt time.Time
		if err := rows.Scan(&id, &operatorID, &remark, &createdAt); err != nil {
			continue
		}
		list = append(list, map[string]interface{}{
			"id":         id,
			"operator":   getUserNameByID(db, operatorID),
			"operatorId": operatorID,
			"remark":     remark,
			"createdAt":  createdAt.Format("2006-01-02 15:04:05"),
		})
	}
	return list
}

func createApplication(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	user := auth.GetCurrentUser(r)
	if user.Role != "window_staff" {
		writeError(w, http.StatusForbidden, "只有窗口人员可以创建开户申请")
		return
	}

	var req struct {
		ApplicantName  string `json:"applicantName"`
		IDCard         string `json:"idCard"`
		Address        string `json:"address"`
		Phone          string `json:"phone"`
		WaterUsageType string `json:"waterUsageType"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	if req.ApplicantName == "" || req.IDCard == "" || req.Address == "" || req.Phone == "" {
		writeError(w, http.StatusBadRequest, "申请人姓名、身份证号、地址、电话为必填项")
		return
	}

	applicationNo := generateApplicationNo()
	appID := generateUUID()
	dueDate := time.Now().AddDate(0, 0, 7).Format("2006-01-02")

	tx, err := db.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建申请失败")
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO account_applications 
		(id, application_no, applicant_name, id_card, address, phone, water_usage_type,
		 status, current_handler, created_by, created_at, updated_at, due_date, version, material_status)
		VALUES (?, ?, ?, ?, ?, ?, ?, '待派发', NULL, ?, datetime('now'), datetime('now'), ?, 1, '待审核')
	`, appID, applicationNo, req.ApplicantName, req.IDCard, req.Address, req.Phone,
		req.WaterUsageType, user.ID, dueDate)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建申请失败")
		return
	}

	_, err = tx.Exec(`
		INSERT INTO processing_records
		(id, application_id, node_name, operator, previous_status, new_status, action, remark, created_at)
		VALUES (?, ?, '用户开户', ?, '', '待派发', '建单', '窗口人员创建开户申请', datetime('now'))
	`, generateUUID(), appID, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建申请失败")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "创建申请失败")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":            appID,
		"applicationNo": applicationNo,
		"status":        "待派发",
	})
}

type statusUpdateRequest struct {
	Action           string `json:"action"`
	TargetStatus     string `json:"targetStatus"`
	Version          int    `json:"version"`
	Remark           string `json:"remark"`
	ExceptionReason  string `json:"exceptionReason"`
	MeterNo          string `json:"meterNo"`
	InstallationAddr string `json:"installationAddr"`
	MaterialStatus   string `json:"materialStatus"`
	HandlerID        string `json:"handlerId"`
}

func updateApplicationStatus(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := auth.GetCurrentUser(r)

	var req statusUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	tx, err := db.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "操作失败")
		return
	}
	defer tx.Rollback()

	var currentStatus string
	var currentVersion int
	var currentHandler sql.NullString
	err = tx.QueryRow(`SELECT status, version, current_handler FROM account_applications WHERE id = ?`, id).
		Scan(&currentStatus, &currentVersion, &currentHandler)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "开户申请不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询申请状态失败")
		return
	}

	if req.Version != currentVersion {
		writeError(w, http.StatusConflict, fmt.Sprintf("数据版本冲突：页面版本为%d，当前最新版本为%d，请刷新后重试", req.Version, currentVersion))
		return
	}

	if req.TargetStatus != "" && req.TargetStatus != currentStatus {
		writeError(w, http.StatusConflict, fmt.Sprintf("页面状态与后端记录不一致：页面显示'%s'，实际为'%s'，请刷新后重试", req.TargetStatus, currentStatus))
		return
	}

	if currentStatus == "已关闭" {
		writeError(w, http.StatusBadRequest, "申请已关闭，无法继续操作")
		return
	}

	var nodeName string
	var newStatus string
	var newHandler sql.NullString
	var validAction bool

	switch req.Action {
	case "dispatch":
		validAction, nodeName, newStatus = true, "资料审核", "处理中"
		if user.Role != "meter_supervisor" {
			writeError(w, http.StatusForbidden, "只有抄表主管可以派发申请")
			return
		}
		if currentStatus != "待派发" {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("当前状态为'%s'，无法派发", currentStatus))
			return
		}
		if req.HandlerID == "" {
			writeError(w, http.StatusBadRequest, "请指定处理人")
			return
		}
		newHandler = sql.NullString{String: req.HandlerID, Valid: true}

	case "material_review":
		validAction, nodeName, newStatus = true, "资料审核", "处理中"
		if user.Role != "meter_supervisor" {
			writeError(w, http.StatusForbidden, "只有抄表主管可以审核资料")
			return
		}
		if currentStatus != "处理中" {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("当前状态为'%s'，无法审核资料", currentStatus))
			return
		}
		if currentHandler.String != user.ID {
			writeError(w, http.StatusForbidden, "您不是当前处理人，无法执行此操作")
			return
		}
		if req.MaterialStatus == "退回补正" {
			if req.ExceptionReason == "" {
				writeError(w, http.StatusBadRequest, "退回补正必须填写异常原因")
				return
			}
		}

	case "meter_install":
		validAction, nodeName, newStatus = true, "装表派工", "处理中"
		if user.Role != "meter_supervisor" {
			writeError(w, http.StatusForbidden, "只有抄表主管可以执行装表派工")
			return
		}
		if currentStatus != "处理中" {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("当前状态为'%s'，无法执行装表派工", currentStatus))
			return
		}
		if currentHandler.String != user.ID {
			writeError(w, http.StatusForbidden, "您不是当前处理人，无法执行此操作")
			return
		}
		if req.MeterNo == "" {
			writeError(w, http.StatusBadRequest, "请填写水表编号")
			return
		}

	case "review_close":
		validAction, nodeName, newStatus = true, "营业经理复核", "已关闭"
		if user.Role != "business_manager" {
			writeError(w, http.StatusForbidden, "只有营业经理可以复核关闭")
			return
		}
		if currentStatus != "处理中" {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("当前状态为'%s'，无法复核关闭", currentStatus))
			return
		}

	case "return_correct":
		validAction, nodeName, newStatus = true, "退回补正", "处理中"
		if user.Role != "business_manager" {
			writeError(w, http.StatusForbidden, "只有营业经理可以退回补正")
			return
		}
		if currentStatus != "处理中" {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("当前状态为'%s'，无法退回补正", currentStatus))
			return
		}
		if req.ExceptionReason == "" {
			writeError(w, http.StatusBadRequest, "退回补正必须填写异常原因")
			return
		}
		if req.HandlerID == "" {
			writeError(w, http.StatusBadRequest, "请指定补正处理人")
			return
		}
		newHandler = sql.NullString{String: req.HandlerID, Valid: true}

	default:
		writeError(w, http.StatusBadRequest, fmt.Sprintf("未知操作类型: %s", req.Action))
		return
	}

	if !validAction {
		writeError(w, http.StatusBadRequest, "无效的操作")
		return
	}

	updateSQL := `
		UPDATE account_applications 
		SET status = ?, version = version + 1, updated_at = datetime('now')
	`
	var updateArgs []interface{}
	updateArgs = append(updateArgs, newStatus)

	if newHandler.Valid {
		updateSQL += ", current_handler = ?"
		updateArgs = append(updateArgs, newHandler.String)
	}
	if req.ExceptionReason != "" {
		updateSQL += ", exception_reason = ?"
		updateArgs = append(updateArgs, req.ExceptionReason)
	}
	if req.MaterialStatus != "" {
		updateSQL += ", material_status = ?"
		updateArgs = append(updateArgs, req.MaterialStatus)
	}
	if req.MeterNo != "" {
		updateSQL += ", meter_no = ?"
		updateArgs = append(updateArgs, req.MeterNo)
	}
	if req.InstallationAddr != "" {
		updateSQL += ", installation_addr = ?"
		updateArgs = append(updateArgs, req.InstallationAddr)
	}
	if req.Remark != "" && req.Action == "review_close" {
		updateSQL += ", review_remark = ?"
		updateArgs = append(updateArgs, req.Remark)
	}

	updateSQL += " WHERE id = ? AND version = ?"
	updateArgs = append(updateArgs, id, currentVersion)

	result, err := tx.Exec(updateSQL, updateArgs...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "更新状态失败")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeError(w, http.StatusConflict, "数据版本冲突，当前数据已被他人修改，请刷新后重试")
		return
	}

	_, err = tx.Exec(`
		INSERT INTO processing_records
		(id, application_id, node_name, operator, previous_status, new_status, 
		 action, remark, exception_reason, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
	`, generateUUID(), id, nodeName, user.ID, currentStatus, newStatus,
		req.Action, req.Remark, req.ExceptionReason)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "记录处理日志失败")
		return
	}

	if req.ExceptionReason != "" {
		reasonType := ""
		switch req.Action {
		case "material_review":
			reasonType = "资料异常"
		case "meter_install":
			reasonType = "装表异常"
		case "return_correct":
			reasonType = "复核退回"
		default:
			reasonType = "其他异常"
		}

		_, err = tx.Exec(`
			INSERT INTO exception_reasons
			(id, application_id, reason_type, description, reported_by, created_at)
			VALUES (?, ?, ?, ?, ?, datetime('now'))
		`, generateUUID(), id, reasonType, req.ExceptionReason, user.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "记录异常原因失败")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	var newVersion int
	db.QueryRow(`SELECT version FROM account_applications WHERE id = ?`, id).Scan(&newVersion)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":         id,
		"status":     newStatus,
		"version":    newVersion,
		"action":     req.Action,
		"nodeName":   nodeName,
		"operator":   user.RealName,
		"operatedAt": time.Now().Format("2006-01-02 15:04:05"),
	})
}

type batchProcessRequest struct {
	IDs          []string `json:"ids"`
	Action       string   `json:"action"`
	Version      int      `json:"version"`
	Remark       string   `json:"remark"`
	Reason       string   `json:"reason"`
	TargetStatus string   `json:"targetStatus"`
	HandlerID    string   `json:"handlerId"`
}

type batchResultItem struct {
	ID      string `json:"id"`
	Success bool   `json:"success"`
	Reason  string `json:"reason"`
	Status  string `json:"status"`
}

func batchProcessApplications(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	user := auth.GetCurrentUser(r)

	var req batchProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	if len(req.IDs) == 0 {
		writeError(w, http.StatusBadRequest, "请选择要处理的申请")
		return
	}

	if req.Action == "" {
		writeError(w, http.StatusBadRequest, "请指定操作类型")
		return
	}

	batchNo := generateBatchNo()
	results := make([]batchResultItem, 0, len(req.IDs))

	for _, appID := range req.IDs {
		result := processSingleBatchItem(db, appID, req, user)
		results = append(results, result)

		appNo := getApplicationNoByID(db, appID)
		newStatus := ""
		if result.Success {
			switch req.Action {
			case "batch_dispatch":
				newStatus = "处理中"
			case "batch_close":
				newStatus = "已关闭"
			case "batch_overdue_advance":
				newStatus = result.Status
			}
		}

		successInt := 0
		if result.Success {
			successInt = 1
		}

		db.Exec(`
			INSERT INTO batch_results
			(id, batch_no, action, operator, application_id, application_no,
			 success, previous_status, new_status, reason, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		`, generateUUID(), batchNo, req.Action, user.ID, appID, appNo,
			successInt, result.Status, newStatus, result.Reason)
	}

	successCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"batchNo":      batchNo,
		"total":        len(req.IDs),
		"successCount": successCount,
		"failCount":    len(req.IDs) - successCount,
		"results":      results,
	})
}

func processSingleBatchItem(db *sql.DB, appID string, req batchProcessRequest, user *auth.User) batchResultItem {
	result := batchResultItem{ID: appID, Success: false}

	tx, err := db.Begin()
	if err != nil {
		result.Reason = "数据库事务失败"
		return result
	}
	defer tx.Rollback()

	var currentStatus string
	var currentVersion int
	var currentHandler sql.NullString
	var applicationNo string
	err = tx.QueryRow(`SELECT application_no, status, version, current_handler FROM account_applications WHERE id = ?`, appID).
		Scan(&applicationNo, &currentStatus, &currentVersion, &currentHandler)
	if err == sql.ErrNoRows {
		result.Reason = "申请不存在"
		return result
	}
	if err != nil {
		result.Reason = "查询申请信息失败"
		return result
	}

	result.Status = currentStatus

	switch req.Action {
	case "batch_dispatch":
		if user.Role != "meter_supervisor" {
			result.Reason = "权限不足，只有抄表主管可以派发"
			return result
		}
		if currentStatus != "待派发" {
			result.Reason = fmt.Sprintf("状态冲突：当前为'%s'，只能派发'待派发'状态", currentStatus)
			return result
		}
		if req.HandlerID == "" {
			result.Reason = "未指定处理人"
			return result
		}

		_, err := tx.Exec(`
			UPDATE account_applications 
			SET status = '处理中', current_handler = ?, version = version + 1, updated_at = datetime('now')
			WHERE id = ? AND status = '待派发'
		`, req.HandlerID, appID)
		if err != nil {
			result.Reason = "更新状态失败"
			return result
		}

		_, err = tx.Exec(`
			INSERT INTO processing_records
			(id, application_id, node_name, operator, previous_status, new_status, 
			 action, remark, created_at)
			VALUES (?, ?, '资料审核', ?, '待派发', '处理中', 'batch_dispatch', ?, datetime('now'))
		`, generateUUID(), appID, user.ID, req.Remark)
		if err != nil {
			result.Reason = "记录处理日志失败"
			return result
		}

	case "batch_close":
		if user.Role != "business_manager" {
			result.Reason = "权限不足，只有营业经理可以关闭"
			return result
		}
		if currentStatus != "处理中" {
			result.Reason = fmt.Sprintf("状态冲突：当前为'%s'，只能关闭'处理中'状态", currentStatus)
			return result
		}

		_, err := tx.Exec(`
			UPDATE account_applications 
			SET status = '已关闭', version = version + 1, updated_at = datetime('now'), review_remark = ?
			WHERE id = ? AND status = '处理中'
		`, req.Remark, appID)
		if err != nil {
			result.Reason = "更新状态失败"
			return result
		}

		_, err = tx.Exec(`
			INSERT INTO processing_records
			(id, application_id, node_name, operator, previous_status, new_status, 
			 action, remark, created_at)
			VALUES (?, ?, '营业经理复核', ?, '处理中', '已关闭', 'batch_close', ?, datetime('now'))
		`, generateUUID(), appID, user.ID, req.Remark)
		if err != nil {
			result.Reason = "记录处理日志失败"
			return result
		}

	case "batch_overdue_advance":
		if user.Role != "meter_supervisor" {
			result.Reason = "权限不足，只有抄表主管可以逾期推进"
			return result
		}
		if currentStatus != "处理中" {
			result.Reason = fmt.Sprintf("状态冲突：当前为'%s'，只能推进'处理中'状态", currentStatus)
			return result
		}
		if currentHandler.String != user.ID && currentStatus == "处理中" {
			result.Reason = "您不是当前处理人"
			return result
		}
		if req.Reason == "" {
			result.Reason = "逾期推进必须填写原因"
			return result
		}

		_, err := tx.Exec(`
			UPDATE account_applications 
			SET exception_reason = ?, version = version + 1, updated_at = datetime('now')
			WHERE id = ? AND status = '处理中'
		`, req.Reason, appID)
		if err != nil {
			result.Reason = "更新失败"
			return result
		}

		_, err = tx.Exec(`
			INSERT INTO processing_records
			(id, application_id, node_name, operator, previous_status, new_status, 
			 action, remark, exception_reason, created_at)
			VALUES (?, ?, '装表派工', ?, '处理中', '处理中', 'batch_overdue_advance', '逾期推进记录', ?, datetime('now'))
		`, generateUUID(), appID, user.ID, req.Reason)
		if err != nil {
			result.Reason = "记录处理日志失败"
			return result
		}

		_, err = tx.Exec(`
			INSERT INTO exception_reasons
			(id, application_id, reason_type, description, reported_by, created_at)
			VALUES (?, ?, '逾期推进', ?, ?, datetime('now'))
		`, generateUUID(), appID, req.Reason, user.ID)
		if err != nil {
			result.Reason = "记录异常原因失败"
			return result
		}

	default:
		result.Reason = fmt.Sprintf("未知操作: %s", req.Action)
		return result
	}

	if err := tx.Commit(); err != nil {
		result.Reason = "提交事务失败"
		return result
	}

	result.Success = true
	result.Reason = "操作成功"
	return result
}

func exportApplicationsCSV(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	q := parseListQuery(r)
	user := auth.GetCurrentUser(r)

	whereClauses := []string{"1=1"}
	var args []interface{}
	argIdx := 1

	if q.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	if q.Warning != "" {
		today := time.Now()
		switch q.Warning {
		case "normal":
			whereClauses = append(whereClauses, fmt.Sprintf("a.due_date > $%d", argIdx))
			args = append(args, today.AddDate(0, 0, 3).Format("2006-01-02"))
			argIdx++
		case "warning":
			whereClauses = append(whereClauses, fmt.Sprintf("a.due_date <= $%d AND a.due_date > $%d", argIdx, argIdx+1))
			args = append(args, today.AddDate(0, 0, 3).Format("2006-01-02"), today.Format("2006-01-02"))
			argIdx += 2
		case "overdue":
			whereClauses = append(whereClauses, fmt.Sprintf("a.due_date < $%d", argIdx))
			args = append(args, today.Format("2006-01-02"))
			argIdx++
		}
	}

	if q.Keyword != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(a.applicant_name LIKE $%d OR a.application_no LIKE $%d OR a.address LIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+q.Keyword+"%")
		argIdx++
	}

	if user.Role == "meter_supervisor" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.current_handler = $%d OR a.status = $%d", argIdx, argIdx+1))
		args = append(args, user.ID, "待派发")
		argIdx += 2
	} else if user.Role == "window_staff" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.created_by = $%d", argIdx))
		args = append(args, user.ID)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	listSQL := fmt.Sprintf(`
		SELECT a.application_no, a.applicant_name, a.id_card, a.address, 
		       a.phone, a.status, a.due_date, a.material_status, a.exception_reason,
		       a.created_at, a.updated_at
		FROM account_applications a
		WHERE %s
		ORDER BY a.created_at DESC
	`, whereSQL)

	rows, err := db.Query(listSQL, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "导出失败")
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	filename := fmt.Sprintf("开户申请导出_%s.csv", time.Now().Format("20060102_150405"))
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	writer := csv.NewWriter(w)
	defer writer.Flush()

	writer.Write([]string{"\uFEFF申请编号", "申请人", "身份证号", "地址", "电话", "状态", "到期日期", "资料状态", "异常原因", "创建时间", "更新时间", "数据导出时间"})

	exportTime := time.Now().Format("2006-01-02 15:04:05")
	for rows.Next() {
		var appNo, name, idCard, addr, phone, status string
		var dueDate, materialStatus, excReason sql.NullString
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&appNo, &name, &idCard, &addr, &phone, &status,
			&dueDate, &materialStatus, &excReason, &createdAt, &updatedAt); err != nil {
			continue
		}
		writer.Write([]string{
			appNo, name, idCard, addr, phone, status,
			dueDate.String, materialStatus.String, excReason.String,
			createdAt.Format("2006-01-02 15:04:05"),
			updatedAt.Format("2006-01-02 15:04:05"),
			exportTime,
		})
	}
}

func getAuditLogs(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	rows, err := db.Query(`
		SELECT id, node_name, operator, previous_status, new_status, 
		       action, remark, exception_reason, created_at
		FROM processing_records 
		WHERE application_id = ? 
		ORDER BY created_at DESC
	`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询审计日志失败")
		return
	}
	defer rows.Close()

	var logs []map[string]interface{}
	for rows.Next() {
		var id, nodeName, operatorID, prevStatus, newStatus, action string
		var remark, excReason sql.NullString
		var createdAt time.Time
		if err := rows.Scan(&id, &nodeName, &operatorID, &prevStatus, &newStatus,
			&action, &remark, &excReason, &createdAt); err != nil {
			continue
		}
		logs = append(logs, map[string]interface{}{
			"id":              id,
			"nodeName":        nodeName,
			"operator":        getUserNameByID(db, operatorID),
			"operatorId":      operatorID,
			"previousStatus":  prevStatus,
			"newStatus":       newStatus,
			"action":          action,
			"remark":          remark.String,
			"exceptionReason": excReason.String,
			"createdAt":       createdAt.Format("2006-01-02 15:04:05"),
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"logs": logs,
	})
}

func addRemark(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := auth.GetCurrentUser(r)

	var req struct {
		Remark string `json:"remark"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	if req.Remark == "" {
		writeError(w, http.StatusBadRequest, "备注内容不能为空")
		return
	}

	_, err := db.Exec(`
		INSERT INTO audit_remarks (id, application_id, operator, remark, created_at)
		VALUES (?, ?, ?, ?, datetime('now'))
	`, generateUUID(), id, user.ID, req.Remark)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "添加备注失败")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "备注添加成功",
	})
}

func generateApplicationNo() string {
	now := time.Now()
	return fmt.Sprintf("KH%s%06d", now.Format("20060102"), now.UnixNano()%1000000)
}

func generateBatchNo() string {
	now := time.Now()
	return fmt.Sprintf("BATCH%s%06d", now.Format("20060102"), now.UnixNano()%1000000)
}

func getApplicationNoByID(db *sql.DB, appID string) string {
	var appNo string
	err := db.QueryRow("SELECT application_no FROM account_applications WHERE id = ?", appID).Scan(&appNo)
	if err != nil {
		return appID
	}
	return appNo
}

func generateUUID() string {
	var buf [16]byte
	for i := range buf {
		buf[i] = byte(time.Now().UnixNano() + int64(i))
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", buf[0:4], buf[4:6], buf[6:8], buf[8:10], buf[10:16])
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

type errorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: http.StatusText(status), Message: message})
}
