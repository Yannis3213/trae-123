package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	_ "github.com/mattn/go-sqlite3"
)

type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	Name     string `json:"name"`
}

type Entry struct {
	ID                 int     `json:"id"`
	Title              string  `json:"title"`
	SubcontractorName  string  `json:"subcontractor_name"`
	Status             string  `json:"status"`
	Priority           string  `json:"priority"`
	Category           string  `json:"category"`
	ResponsiblePerson  string  `json:"responsible_person"`
	CurrentHandler     *string `json:"current_handler"`
	CurrentHandlerRole *string `json:"current_handler_role"`
	Deadline           string  `json:"deadline"`
	Version            int     `json:"version"`
	ExceptionTags      string  `json:"exception_tags"`
	CreatedBy          int     `json:"created_by"`
	CreatedByName      string  `json:"created_by_name"`
	CreatedAt          string  `json:"created_at"`
	UpdatedAt          string  `json:"updated_at"`
	OverdueGroup       string  `json:"overdue_group"`
}

type Attachment struct {
	ID             int    `json:"id"`
	EntryID        int    `json:"entry_id"`
	Filename       string `json:"filename"`
	FileType       string `json:"file_type"`
	FileSize       int    `json:"file_size"`
	Description    string `json:"description"`
	UploadedBy     int    `json:"uploaded_by"`
	UploadedByName string `json:"uploaded_by_name"`
	CreatedAt      string `json:"created_at"`
}

type ProcessingRecord struct {
	ID           int    `json:"id"`
	EntryID      int    `json:"entry_id"`
	HandlerRole  string `json:"handler_role"`
	HandlerName  string `json:"handler_name"`
	Action       string `json:"action"`
	Result       string `json:"result"`
	ReturnReason string `json:"return_reason"`
	CreatedAt    string `json:"created_at"`
}

type AuditNote struct {
	ID            int    `json:"id"`
	EntryID       int    `json:"entry_id"`
	NoteType      string `json:"note_type"`
	Content       string `json:"content"`
	CreatedBy     int    `json:"created_by"`
	CreatedByName string `json:"created_by_name"`
	CreatedAt     string `json:"created_at"`
}

type ExceptionLog struct {
	ID            int    `json:"id"`
	EntryID       int    `json:"entry_id"`
	EntryTitle    string `json:"entry_title"`
	ExceptionType string `json:"exception_type"`
	Description   string `json:"description"`
	DetectedAt    string `json:"detected_at"`
	Resolved      bool   `json:"resolved"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type CreateEntryRequest struct {
	Title             string `json:"title"`
	SubcontractorName string `json:"subcontractor_name"`
	Priority          string `json:"priority"`
	Category          string `json:"category"`
	ResponsiblePerson string `json:"responsible_person"`
	Deadline          string `json:"deadline"`
}

type ProcessEntryRequest struct {
	Action       string `json:"action"`
	Result       string `json:"result"`
	ReturnReason string `json:"return_reason"`
	Version      int    `json:"version"`
}

type BatchProcessRequest struct {
	EntryIDs []int  `json:"entry_ids"`
	Action   string `json:"action"`
	Result   string `json:"result"`
}

type CreateAttachmentRequest struct {
	Filename    string `json:"filename"`
	FileType    string `json:"file_type"`
	FileSize    int    `json:"file_size"`
	Description string `json:"description"`
}

type CreateAuditNoteRequest struct {
	NoteType string `json:"note_type"`
	Content  string `json:"content"`
}

type BatchResult struct {
	EntryID int    `json:"entry_id"`
	Success bool   `json:"success"`
	Reason  string `json:"reason"`
}

var (
	db         *sql.DB
	tokenStore = make(map[string]User)
	tokenMutex sync.RWMutex
)

func generateToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func initDB() error {
	var err error
	db, err = sql.Open("sqlite3", "./subcontractor.db?_journal_mode=WAL")
	if err != nil {
		return err
	}

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE,
		password TEXT NOT NULL,
		role TEXT NOT NULL CHECK(role IN ('document_clerk', 'construction_manager', 'project_manager')),
		name TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS subcontractor_entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		subcontractor_name TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review', 'approved', 'returned', 'synced')),
		priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
		category TEXT NOT NULL CHECK(category IN ('subcontractor_entry', 'qualification_review', 'safety_briefing')),
		responsible_person TEXT NOT NULL,
		current_handler TEXT,
		current_handler_role TEXT,
		deadline DATETIME NOT NULL,
		version INTEGER NOT NULL DEFAULT 1,
		exception_tags TEXT DEFAULT '',
		created_by INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (created_by) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS attachments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		entry_id INTEGER NOT NULL,
		filename TEXT NOT NULL,
		file_type TEXT,
		file_size INTEGER DEFAULT 0,
		description TEXT,
		uploaded_by INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (entry_id) REFERENCES subcontractor_entries(id) ON DELETE CASCADE,
		FOREIGN KEY (uploaded_by) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS processing_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		entry_id INTEGER NOT NULL,
		handler_role TEXT NOT NULL,
		handler_name TEXT NOT NULL,
		action TEXT NOT NULL,
		result TEXT NOT NULL,
		return_reason TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (entry_id) REFERENCES subcontractor_entries(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS audit_notes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		entry_id INTEGER NOT NULL,
		note_type TEXT NOT NULL,
		content TEXT NOT NULL,
		created_by INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (entry_id) REFERENCES subcontractor_entries(id) ON DELETE CASCADE,
		FOREIGN KEY (created_by) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS exception_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		entry_id INTEGER NOT NULL,
		exception_type TEXT NOT NULL,
		description TEXT NOT NULL,
		detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		resolved INTEGER DEFAULT 0,
		FOREIGN KEY (entry_id) REFERENCES subcontractor_entries(id) ON DELETE CASCADE
	);
	`

	_, err = db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}

	return seedData()
}

func seedData() error {
	var count int
	db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count > 0 {
		return nil
	}

	users := []struct {
		username, password, role, name string
	}{
		{"ziliaoyuan", "123456", "document_clerk", "张资料"},
		{"shigongfzr", "123456", "construction_manager", "李施工"},
		{"xiangmujl", "123456", "project_manager", "王项目"},
	}

	for _, u := range users {
		db.Exec("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)",
			u.username, u.password, u.role, u.name)
	}

	now := time.Now()
	day := 24 * time.Hour

	entries := []struct {
		title, sub, status, priority, category, resp, deadline string
		tags                                                   string
		createdBy                                              int
		handler, handlerRole                                   string
	}{
		{"江西建工集团分包进场申请", "江西建工集团", "pending_review", "high", "subcontractor_entry", "张资料", now.Add(7 * day).Format("2006-01-02T15:04:05Z07:00"), "", 1, "李施工", "construction_manager"},
		{"中铁十五局资质审核", "中铁十五局", "pending_review", "medium", "qualification_review", "张资料", now.Add(10 * day).Format("2006-01-02T15:04:05Z07:00"), "", 1, "李施工", "construction_manager"},
		{"华厦建设安全交底", "华厦建设公司", "pending_review", "low", "safety_briefing", "张资料", now.Add(14 * day).Format("2006-01-02T15:04:05Z07:00"), "", 1, "李施工", "construction_manager"},

		{"湖南建达分包进场-缺材料", "湖南建达工程", "pending_review", "high", "subcontractor_entry", "张资料", now.Add(7 * day).Format("2006-01-02T15:04:05Z07:00"), "missing_materials", 1, "李施工", "construction_manager"},
		{"中建三局资质审核-缺材料", "中建三局", "pending_review", "medium", "qualification_review", "张资料", now.Add(2 * day).Format("2006-01-02T15:04:05Z07:00"), "missing_materials", 1, "李施工", "construction_manager"},
		{"龙元建设安全交底-缺材料", "龙元建设集团", "pending_review", "low", "safety_briefing", "张资料", now.Add(1 * day).Format("2006-01-02T15:04:05Z07:00"), "missing_materials", 1, "李施工", "construction_manager"},

		{"上海建工分包进场-逾期", "上海建工集团", "pending_review", "high", "subcontractor_entry", "李施工", now.Add(-3 * day).Format("2006-01-02T15:04:05Z07:00"), "overdue", 1, "李施工", "construction_manager"},
		{"浙江宏信资质审核-逾期", "浙江宏信建设", "approved", "medium", "qualification_review", "李施工", now.Add(-5 * day).Format("2006-01-02T15:04:05Z07:00"), "overdue", 1, "王项目", "project_manager"},
		{"广州工程局安全交底-逾期", "广州工程局", "pending_review", "high", "safety_briefing", "张资料", now.Add(-2 * day).Format("2006-01-02T15:04:05Z07:00"), "overdue", 1, "李施工", "construction_manager"},

		{"北京城建分包进场-退回补正", "北京城建集团", "returned", "high", "subcontractor_entry", "张资料", now.Add(5 * day).Format("2006-01-02T15:04:05Z07:00"), "returned", 1, "张资料", "document_clerk"},
		{"四川路桥资质审核-退回", "四川路桥集团", "returned", "medium", "qualification_review", "李施工", now.Add(2 * day).Format("2006-01-02T15:04:05Z07:00"), "returned", 1, "李施工", "construction_manager"},
		{"中交一公局安全交底-已审核", "中交一公局", "approved", "low", "safety_briefing", "李施工", now.Add(10 * day).Format("2006-01-02T15:04:05Z07:00"), "", 1, "王项目", "project_manager"},

		{"深圳建安分包进场-已审核", "深圳建安集团", "approved", "high", "subcontractor_entry", "王项目", now.Add(4 * day).Format("2006-01-02T15:04:05Z07:00"), "", 1, "王项目", "project_manager"},
		{"山东铁正资质审核-已同步", "山东铁正建设", "synced", "medium", "qualification_review", "王项目", now.Add(-3 * day).Format("2006-01-02T15:04:05Z07:00"), "", 1, "王项目", "project_manager"},
		{"中铁十二局安全交底-已同步", "中铁十二局", "synced", "low", "safety_briefing", "王项目", now.Add(-1 * day).Format("2006-01-02T15:04:05Z07:00"), "", 1, "王项目", "project_manager"},
	}

	for i, e := range entries {
		res, err := db.Exec(`INSERT INTO subcontractor_entries
			(title, subcontractor_name, status, priority, category, responsible_person, deadline, exception_tags, created_by, current_handler, current_handler_role, version)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			e.title, e.sub, e.status, e.priority, e.category, e.resp, e.deadline, e.tags, e.createdBy, e.handler, e.handlerRole, 1)
		if err != nil {
			fmt.Printf("seed entry %d error: %v\n", i, err)
			continue
		}
		entryID, _ := res.LastInsertId()

		if e.status == "approved" {
			db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result)
				VALUES (?, 'construction_manager', '李施工', 'approve', '审核通过')`, entryID)
		}
		if e.status == "synced" {
			db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result)
				VALUES (?, 'construction_manager', '李施工', 'approve', '审核通过')`, entryID)
			db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result)
				VALUES (?, 'project_manager', '王项目', 'confirm', '已同步确认')`, entryID)
		}
		if e.status == "returned" {
			if e.handlerRole == "document_clerk" {
				db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result, return_reason)
					VALUES (?, 'construction_manager', '李施工', 'return', '退回补正', '材料不完整，请补充资质证书附件')`, entryID)
			} else {
				db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result, return_reason)
					VALUES (?, 'project_manager', '王项目', 'return', '退回补正', '需要补充安全交底记录')`, entryID)
			}
		}
		if strings.Contains(e.tags, "overdue") {
			db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description)
				VALUES (?, 'overdue', '该分包进场单已超过截止时间未处理')`, entryID)
		}
		if strings.Contains(e.tags, "missing_materials") {
			db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description)
				VALUES (?, 'missing_materials', '缺少必要附件材料')`, entryID)
		}
	}

	seedAttachments := []struct {
		entryID                  int
		filename, fileType, desc string
		size                     int
		uploadedBy               int
	}{
		{1, "江西建工营业执照.pdf", "application/pdf", "营业执照扫描件", 256000, 1},
		{1, "江西建工资质证书.pdf", "application/pdf", "施工资质证书", 180000, 1},
		{4, "湖南建达营业执照.pdf", "application/pdf", "营业执照扫描件", 200000, 1},
		{7, "上海建工分包合同.pdf", "application/pdf", "分包合同", 512000, 1},
		{10, "北京城建退回补正说明.pdf", "application/pdf", "退回补正说明文档", 150000, 1},
		{13, "深圳建安全套资质.pdf", "application/pdf", "完整资质材料包", 1024000, 1},
		{13, "深圳建安安全交底记录.pdf", "application/pdf", "安全交底签字记录", 320000, 1},
		{14, "山东铁正全流程文档.pdf", "application/pdf", "完整审批流程文档", 800000, 1},
		{15, "中铁十二局交底完成确认.pdf", "application/pdf", "安全交底完成确认书", 256000, 1},
	}
	for _, a := range seedAttachments {
		db.Exec(`INSERT INTO attachments (entry_id, filename, file_type, file_size, description, uploaded_by)
			VALUES (?, ?, ?, ?, ?, ?)`, a.entryID, a.filename, a.fileType, a.size, a.desc, a.uploadedBy)
	}

	seedAuditNotes := []struct {
		entryID           int
		noteType, content string
		createdBy         int
	}{
		{7, "system", "系统检测到该单据已超过截止时间", 1},
		{8, "system", "系统检测到该单据已超过截止时间", 1},
		{9, "system", "系统检测到该单据已超过截止时间", 1},
		{10, "audit", "退回原因：材料不完整，需补充资质证书", 2},
		{11, "audit", "退回原因：需补充安全交底记录", 3},
		{4, "exception", "缺少必要附件材料：资质证书", 1},
		{5, "exception", "缺少必要附件材料：安全生产许可证", 1},
		{6, "exception", "缺少必要附件材料：安全交底签字表", 1},
	}
	for _, n := range seedAuditNotes {
		db.Exec(`INSERT INTO audit_notes (entry_id, note_type, content, created_by)
			VALUES (?, ?, ?, ?)`, n.entryID, n.noteType, n.content, n.createdBy)
	}

	return nil
}

func authMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		token := c.Request().Header.Get("X-Auth-Token")
		if token == "" {
			token = c.QueryParam("token")
		}
		if token == "" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "未登录或令牌已过期"})
		}
		tokenMutex.RLock()
		user, ok := tokenStore[token]
		tokenMutex.RUnlock()
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "无效令牌"})
		}
		c.Set("user", user)
		c.Set("token", token)
		return next(c)
	}
}

func getcurrentUser(c echo.Context) User {
	user, _ := c.Get("user").(User)
	return user
}

func calcOverdueGroup(deadline string) string {
	t, err := time.Parse(time.RFC3339, deadline)
	if err != nil {
		t, err = time.Parse("2006-01-02T15:04:05Z07:00", deadline)
		if err != nil {
			return "normal"
		}
	}
	now := time.Now()
	if t.Before(now) {
		return "overdue"
	}
	if t.Before(now.Add(72 * time.Hour)) {
		return "near_due"
	}
	return "normal"
}

func scanEntry(row *sql.Rows) Entry {
	var e Entry
	var currentHandler, currentHandlerRole sql.NullString
	var exceptionTags sql.NullString
	var updatedAt sql.NullString

	row.Scan(
		&e.ID, &e.Title, &e.SubcontractorName, &e.Status, &e.Priority,
		&e.Category, &e.ResponsiblePerson, &currentHandler, &currentHandlerRole,
		&e.Deadline, &e.Version, &exceptionTags, &e.CreatedBy,
		&e.CreatedAt, &updatedAt,
	)

	if currentHandler.Valid {
		e.CurrentHandler = &currentHandler.String
	}
	if currentHandlerRole.Valid {
		e.CurrentHandlerRole = &currentHandlerRole.String
	}
	if exceptionTags.Valid {
		e.ExceptionTags = exceptionTags.String
	}
	if updatedAt.Valid {
		e.UpdatedAt = updatedAt.String
	}

	e.OverdueGroup = calcOverdueGroup(e.Deadline)
	return e
}

func loginHandler(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
	}

	var user User
	var password string
	err := db.QueryRow("SELECT id, username, role, name, password FROM users WHERE username = ?", req.Username).
		Scan(&user.ID, &user.Username, &user.Role, &user.Name, &password)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "用户名或密码错误"})
	}

	if password != req.Password {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "用户名或密码错误"})
	}

	token := generateToken()
	tokenMutex.Lock()
	tokenStore[token] = user
	tokenMutex.Unlock()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

func meHandler(c echo.Context) error {
	user := getcurrentUser(c)
	return c.JSON(http.StatusOK, user)
}

func listEntriesHandler(c echo.Context) error {
	user := getcurrentUser(c)

	statusFilter := c.QueryParam("status")
	priorityFilter := c.QueryParam("priority")
	categoryFilter := c.QueryParam("category")
	overdueGroupFilter := c.QueryParam("overdue_group")

	query := `SELECT id, title, subcontractor_name, status, priority, category,
		responsible_person, current_handler, current_handler_role,
		deadline, version, exception_tags, created_by, created_at, updated_at
		FROM subcontractor_entries WHERE 1=1`
	args := []interface{}{}

	if statusFilter != "" {
		query += " AND status = ?"
		args = append(args, statusFilter)
	}
	if priorityFilter != "" {
		query += " AND priority = ?"
		args = append(args, priorityFilter)
	}
	if categoryFilter != "" {
		query += " AND category = ?"
		args = append(args, categoryFilter)
	}

	if user.Role == "document_clerk" {
		query += " AND (created_by = ? OR status = 'returned' AND current_handler_role = 'document_clerk')"
		args = append(args, user.ID)
	} else if user.Role == "construction_manager" {
		query += " AND (status = 'pending_review' OR status = 'returned' AND current_handler_role = 'construction_manager')"
	} else if user.Role == "project_manager" {
		query += " AND (status = 'approved' OR status = 'synced')"
	}

	query += " ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, deadline ASC"

	rows, err := db.Query(query, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer rows.Close()

	entries := []Entry{}
	for rows.Next() {
		e := scanEntry(rows)

		var creatorName string
		db.QueryRow("SELECT name FROM users WHERE id = ?", e.CreatedBy).Scan(&creatorName)
		e.CreatedByName = creatorName

		if overdueGroupFilter != "" && e.OverdueGroup != overdueGroupFilter {
			continue
		}
		entries = append(entries, e)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"entries": entries,
		"total":   len(entries),
	})
}

func getEntryHandler(c echo.Context) error {
	id, _ := strconv.Atoi(c.Param("id"))

	var e Entry
	var currentHandler, currentHandlerRole sql.NullString
	var exceptionTags sql.NullString

	err := db.QueryRow(`SELECT id, title, subcontractor_name, status, priority, category,
		responsible_person, current_handler, current_handler_role,
		deadline, version, exception_tags, created_by, created_at, updated_at
		FROM subcontractor_entries WHERE id = ?`, id).
		Scan(&e.ID, &e.Title, &e.SubcontractorName, &e.Status, &e.Priority,
			&e.Category, &e.ResponsiblePerson, &currentHandler, &currentHandlerRole,
			&e.Deadline, &e.Version, &exceptionTags, &e.CreatedBy,
			&e.CreatedAt, &e.UpdatedAt)

	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "分包进场单不存在"})
	}

	if currentHandler.Valid {
		e.CurrentHandler = &currentHandler.String
	}
	if currentHandlerRole.Valid {
		e.CurrentHandlerRole = &currentHandlerRole.String
	}
	if exceptionTags.Valid {
		e.ExceptionTags = exceptionTags.String
	}
	e.OverdueGroup = calcOverdueGroup(e.Deadline)

	var creatorName string
	db.QueryRow("SELECT name FROM users WHERE id = ?", e.CreatedBy).Scan(&creatorName)
	e.CreatedByName = creatorName

	attachments := []Attachment{}
	aRows, _ := db.Query(`SELECT a.id, a.entry_id, a.filename, a.file_type, a.file_size, a.description, a.uploaded_by, u.name, a.created_at
		FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id WHERE a.entry_id = ? ORDER BY a.created_at DESC`, id)
	if aRows != nil {
		defer aRows.Close()
		for aRows.Next() {
			var a Attachment
			aRows.Scan(&a.ID, &a.EntryID, &a.Filename, &a.FileType, &a.FileSize, &a.Description, &a.UploadedBy, &a.UploadedByName, &a.CreatedAt)
			attachments = append(attachments, a)
		}
	}

	records := []ProcessingRecord{}
	rRows, _ := db.Query(`SELECT id, entry_id, handler_role, handler_name, action, result, return_reason, created_at
		FROM processing_records WHERE entry_id = ? ORDER BY created_at DESC`, id)
	if rRows != nil {
		defer rRows.Close()
		for rRows.Next() {
			var r ProcessingRecord
			rRows.Scan(&r.ID, &r.EntryID, &r.HandlerRole, &r.HandlerName, &r.Action, &r.Result, &r.ReturnReason, &r.CreatedAt)
			records = append(records, r)
		}
	}

	notes := []AuditNote{}
	nRows, _ := db.Query(`SELECT n.id, n.entry_id, n.note_type, n.content, n.created_by, u.name, n.created_at
		FROM audit_notes n LEFT JOIN users u ON n.created_by = u.id WHERE n.entry_id = ? ORDER BY n.created_at DESC`, id)
	if nRows != nil {
		defer nRows.Close()
		for nRows.Next() {
			var n AuditNote
			nRows.Scan(&n.ID, &n.EntryID, &n.NoteType, &n.Content, &n.CreatedBy, &n.CreatedByName, &n.CreatedAt)
			notes = append(notes, n)
		}
	}

	exceptions := []ExceptionLog{}
	xRows, _ := db.Query(`SELECT id, entry_id, exception_type, description, detected_at, resolved
		FROM exception_logs WHERE entry_id = ? ORDER BY detected_at DESC`, id)
	if xRows != nil {
		defer xRows.Close()
		for xRows.Next() {
			var x ExceptionLog
			var resolved int
			xRows.Scan(&x.ID, &x.EntryID, &x.ExceptionType, &x.Description, &x.DetectedAt, &resolved)
			x.Resolved = resolved == 1
			x.EntryTitle = e.Title
			exceptions = append(exceptions, x)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"entry":       e,
		"attachments": attachments,
		"records":     records,
		"notes":       notes,
		"exceptions":  exceptions,
	})
}

func createEntryHandler(c echo.Context) error {
	user := getcurrentUser(c)
	if user.Role != "document_clerk" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "仅资料员可创建分包进场单"})
	}

	var req CreateEntryRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
	}

	if req.Title == "" || req.SubcontractorName == "" || req.Deadline == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "标题、分包单位名称和截止时间为必填项"})
	}
	if req.Priority == "" {
		req.Priority = "medium"
	}
	if req.Category == "" {
		req.Category = "subcontractor_entry"
	}
	if req.ResponsiblePerson == "" {
		req.ResponsiblePerson = user.Name
	}

	res, err := db.Exec(`INSERT INTO subcontractor_entries
		(title, subcontractor_name, status, priority, category, responsible_person, current_handler, current_handler_role, deadline, exception_tags, created_by, version)
		VALUES (?, ?, 'pending_review', ?, ?, ?, '李施工', 'construction_manager', ?, '', ?, 1)`,
		req.Title, req.SubcontractorName, req.Priority, req.Category,
		req.ResponsiblePerson, req.Deadline, user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	entryID, _ := res.LastInsertId()

	db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result)
		VALUES (?, 'document_clerk', ?, 'submit', '提交审核')`, entryID, user.Name)

	db.Exec(`INSERT INTO audit_notes (entry_id, note_type, content, created_by)
		VALUES (?, 'audit', ?, ?)`, entryID, fmt.Sprintf("资料员 %s 创建分包进场单", user.Name), user.ID)

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":      entryID,
		"message": "分包进场单创建成功",
	})
}

func processEntryHandler(c echo.Context) error {
	user := getcurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var req ProcessEntryRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
	}

	var entry Entry
	var currentHandler, currentHandlerRole sql.NullString
	var exceptionTags sql.NullString
	err := db.QueryRow(`SELECT id, status, version, deadline, exception_tags, current_handler, current_handler_role
		FROM subcontractor_entries WHERE id = ?`, id).
		Scan(&entry.ID, &entry.Status, &entry.Version, &entry.Deadline, &exceptionTags, &currentHandler, &currentHandlerRole)

	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "分包进场单不存在"})
	}
	if exceptionTags.Valid {
		entry.ExceptionTags = exceptionTags.String
	}
	if currentHandler.Valid {
		entry.CurrentHandler = &currentHandler.String
	}
	if currentHandlerRole.Valid {
		entry.CurrentHandlerRole = &currentHandlerRole.String
	}

	if req.Version != entry.Version {
		db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description)
			VALUES (?, 'status_conflict', ?)`, id, fmt.Sprintf("版本冲突：提交版本%d，当前版本%d", req.Version, entry.Version))
		return c.JSON(http.StatusConflict, map[string]string{"error": fmt.Sprintf("版本冲突：提交版本%d，当前版本%d，请刷新后重试", req.Version, entry.Version)})
	}

	if req.Action == "approve" {
		if user.Role != "construction_manager" {
			db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description)
				VALUES (?, 'unauthorized_advance', ?)`, id, fmt.Sprintf("用户 %s (%s) 无权审核该单据", user.Name, user.Role))
			return c.JSON(http.StatusForbidden, map[string]string{"error": "仅施工负责人可审核分包进场单"})
		}
		if entry.Status != "pending_review" {
			db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description)
				VALUES (?, 'status_conflict', ?)`, id, fmt.Sprintf("状态冲突：当前状态%s，无法审核", entry.Status))
			return c.JSON(http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("当前状态为%s，无法审核", statusLabel(entry.Status))})
		}

		var attCount int
		db.QueryRow("SELECT COUNT(*) FROM attachments WHERE entry_id = ?", id).Scan(&attCount)
		if attCount == 0 {
			db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description)
				VALUES (?, 'missing_materials', '缺少附件材料，无法审核通过')`, id)
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "缺少附件材料，无法审核通过，请先上传必要材料"})
		}

		now := time.Now()
		deadline, _ := time.Parse(time.RFC3339, entry.Deadline)
		if deadline.Before(now) {
			db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description)
				VALUES (?, 'overdue', '逾期单据不可直接审核，需在详情页补正')`, id)
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "该单据已逾期，不可直接审核，请前往详情页补正后再处理"})
		}

		db.Exec(`UPDATE subcontractor_entries SET status = 'approved', current_handler = '王项目', current_handler_role = 'project_manager', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
		db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result)
			VALUES (?, 'construction_manager', ?, 'approve', ?)`, id, user.Name, firstNonEmpty(req.Result, "审核通过"))
		db.Exec(`INSERT INTO audit_notes (entry_id, note_type, content, created_by)
			VALUES (?, 'audit', ?, ?)`, id, fmt.Sprintf("施工负责人 %s 审核通过", user.Name), user.ID)

	} else if req.Action == "confirm" {
		if user.Role != "project_manager" {
			db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description)
				VALUES (?, 'unauthorized_advance', ?)`, id, fmt.Sprintf("用户 %s (%s) 无权确认该单据", user.Name, user.Role))
			return c.JSON(http.StatusForbidden, map[string]string{"error": "仅项目经理可确认分包进场单"})
		}
		if entry.Status != "approved" {
			db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description)
				VALUES (?, 'status_conflict', ?)`, id, fmt.Sprintf("状态冲突：当前状态%s，无法确认", entry.Status))
			return c.JSON(http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("当前状态为%s，无法确认", statusLabel(entry.Status))})
		}

		db.Exec(`UPDATE subcontractor_entries SET status = 'synced', current_handler = ?, current_handler_role = 'project_manager', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
			user.Name, id)
		db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result)
			VALUES (?, 'project_manager', ?, 'confirm', ?)`, id, user.Name, firstNonEmpty(req.Result, "已同步确认"))
		db.Exec(`INSERT INTO audit_notes (entry_id, note_type, content, created_by)
			VALUES (?, 'audit', ?, ?)`, id, fmt.Sprintf("项目经理 %s 确认同步", user.Name), user.ID)

	} else if req.Action == "return" {
		if req.ReturnReason == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "退回时必须填写退回原因"})
		}

		if entry.Status == "pending_review" && user.Role == "construction_manager" {
			db.Exec(`UPDATE subcontractor_entries SET status = 'returned', current_handler = (SELECT name FROM users WHERE id = created_by), current_handler_role = 'document_clerk', version = version + 1, exception_tags = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
			db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result, return_reason)
				VALUES (?, 'construction_manager', ?, 'return', '退回补正', ?)`, id, user.Name, req.ReturnReason)
			db.Exec(`INSERT INTO audit_notes (entry_id, note_type, content, created_by)
				VALUES (?, 'audit', ?, ?)`, id, fmt.Sprintf("施工负责人 %s 退回： %s", user.Name, req.ReturnReason), user.ID)

		} else if entry.Status == "approved" && user.Role == "project_manager" {
			db.Exec(`UPDATE subcontractor_entries SET status = 'returned', current_handler = '李施工', current_handler_role = 'construction_manager', version = version + 1, exception_tags = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
			db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result, return_reason)
				VALUES (?, 'project_manager', ?, 'return', '退回补正', ?)`, id, user.Name, req.ReturnReason)
			db.Exec(`INSERT INTO audit_notes (entry_id, note_type, content, created_by)
				VALUES (?, 'audit', ?, ?)`, id, fmt.Sprintf("项目经理 %s 退回： %s", user.Name, req.ReturnReason), user.ID)

		} else {
			db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description)
				VALUES (?, 'unauthorized_advance', ?)`, id, fmt.Sprintf("用户 %s (%s) 无权退回当前状态的单据", user.Name, user.Role))
			return c.JSON(http.StatusForbidden, map[string]string{"error": "无权退回当前状态的单据"})
		}

	} else if req.Action == "resubmit" {
		if user.Role != "document_clerk" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "仅资料员可重新提交"})
		}
		if entry.Status != "returned" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "仅退回状态的单据可重新提交"})
		}

		var attCount int
		db.QueryRow("SELECT COUNT(*) FROM attachments WHERE entry_id = ?", id).Scan(&attCount)
		if attCount == 0 {
			db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description)
				VALUES (?, 'missing_materials', '重新提交时缺少附件材料')`, id)
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "重新提交时必须附带材料"})
		}

		db.Exec(`UPDATE subcontractor_entries SET status = 'pending_review', current_handler = '李施工', current_handler_role = 'construction_manager', version = version + 1, exception_tags = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
		db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result)
			VALUES (?, 'document_clerk', ?, 'resubmit', '重新提交审核')`, id, user.Name)
		db.Exec(`INSERT INTO audit_notes (entry_id, note_type, content, created_by)
			VALUES (?, 'audit', ?, ?)`, id, fmt.Sprintf("资料员 %s 重新提交", user.Name), user.ID)

	} else {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "不支持的操作类型"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "操作成功"})
}

func batchProcessHandler(c echo.Context) error {
	user := getcurrentUser(c)

	var req BatchProcessRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
	}

	if len(req.EntryIDs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请选择要处理的分包进场单"})
	}

	results := []BatchResult{}

	for _, entryID := range req.EntryIDs {
		var status, exceptionTags string
		var version int
		var deadline string
		var currentHandlerRole sql.NullString

		err := db.QueryRow(`SELECT status, version, deadline, exception_tags, current_handler_role
			FROM subcontractor_entries WHERE id = ?`, entryID).
			Scan(&status, &version, &deadline, &exceptionTags, &currentHandlerRole)

		if err != nil {
			results = append(results, BatchResult{EntryID: entryID, Success: false, Reason: "分包进场单不存在"})
			continue
		}

		if req.Action == "approve" {
			if user.Role != "construction_manager" {
				results = append(results, BatchResult{EntryID: entryID, Success: false, Reason: "仅施工负责人可审核"})
				continue
			}
			if status != "pending_review" {
				results = append(results, BatchResult{EntryID: entryID, Success: false, Reason: fmt.Sprintf("当前状态为%s，无法审核", statusLabel(status))})
				continue
			}
			var attCount int
			db.QueryRow("SELECT COUNT(*) FROM attachments WHERE entry_id = ?", entryID).Scan(&attCount)
			if attCount == 0 {
				results = append(results, BatchResult{EntryID: entryID, Success: false, Reason: "缺少附件材料"})
				db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description) VALUES (?, 'missing_materials', '批量审核时检测到缺少附件')`, entryID)
				continue
			}
			overdueGroup := calcOverdueGroup(deadline)
			if overdueGroup == "overdue" {
				results = append(results, BatchResult{EntryID: entryID, Success: false, Reason: "该单据已逾期，请前往详情页补正后处理"})
				db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description) VALUES (?, 'overdue', '逾期单据批量审核被拦截')`, entryID)
				continue
			}

			db.Exec(`UPDATE subcontractor_entries SET status = 'approved', current_handler = '王项目', current_handler_role = 'project_manager', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, entryID)
			db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result) VALUES (?, 'construction_manager', ?, 'batch_approve', ?)`, entryID, user.Name, firstNonEmpty(req.Result, "批量审核通过"))
			results = append(results, BatchResult{EntryID: entryID, Success: true, Reason: "审核通过"})

		} else if req.Action == "confirm" {
			if user.Role != "project_manager" {
				results = append(results, BatchResult{EntryID: entryID, Success: false, Reason: "仅项目经理可确认"})
				continue
			}
			if status != "approved" {
				results = append(results, BatchResult{EntryID: entryID, Success: false, Reason: fmt.Sprintf("当前状态为%s，无法确认", statusLabel(status))})
				continue
			}
			overdueGroup := calcOverdueGroup(deadline)
			if overdueGroup == "overdue" {
				results = append(results, BatchResult{EntryID: entryID, Success: false, Reason: "该单据已逾期，请前往详情页补正后处理"})
				db.Exec(`INSERT INTO exception_logs (entry_id, exception_type, description) VALUES (?, 'overdue', '逾期单据批量确认被拦截')`, entryID)
				continue
			}

			db.Exec(`UPDATE subcontractor_entries SET status = 'synced', current_handler = '王项目', current_handler_role = 'project_manager', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, entryID)
			db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result) VALUES (?, 'project_manager', ?, 'batch_confirm', ?)`, entryID, user.Name, firstNonEmpty(req.Result, "批量确认同步"))
			results = append(results, BatchResult{EntryID: entryID, Success: true, Reason: "确认同步"})

		} else if req.Action == "return" {
			if req.Result == "" {
				results = append(results, BatchResult{EntryID: entryID, Success: false, Reason: "批量退回需要填写退回原因"})
				continue
			}
			if status == "pending_review" && user.Role == "construction_manager" {
				db.Exec(`UPDATE subcontractor_entries SET status = 'returned', current_handler = (SELECT name FROM users WHERE id = created_by), current_handler_role = 'document_clerk', version = version + 1, exception_tags = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, entryID)
				db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result, return_reason) VALUES (?, 'construction_manager', ?, 'batch_reject', '批量退回补正', ?)`, entryID, user.Name, req.Result)
				results = append(results, BatchResult{EntryID: entryID, Success: true, Reason: "已退回"})
			} else if status == "approved" && user.Role == "project_manager" {
				db.Exec(`UPDATE subcontractor_entries SET status = 'returned', current_handler = '李施工', current_handler_role = 'construction_manager', version = version + 1, exception_tags = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, entryID)
				db.Exec(`INSERT INTO processing_records (entry_id, handler_role, handler_name, action, result, return_reason) VALUES (?, 'project_manager', ?, 'batch_reject', '批量退回补正', ?)`, entryID, user.Name, req.Result)
				results = append(results, BatchResult{EntryID: entryID, Success: true, Reason: "已退回"})
			} else {
				results = append(results, BatchResult{EntryID: entryID, Success: false, Reason: "无权退回当前状态的单据"})
			}

		} else {
			results = append(results, BatchResult{EntryID: entryID, Success: false, Reason: "不支持的操作类型"})
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"results": results,
	})
}

func statsHandler(c echo.Context) error {
	user := getcurrentUser(c)

	baseQuery := "FROM subcontractor_entries WHERE 1=1"
	if user.Role == "document_clerk" {
		baseQuery += " AND (created_by = " + strconv.Itoa(user.ID) + " OR (status = 'returned' AND current_handler_role = 'document_clerk'))"
	} else if user.Role == "construction_manager" {
		baseQuery += " AND (status = 'pending_review' OR (status = 'returned' AND current_handler_role = 'construction_manager'))"
	} else if user.Role == "project_manager" {
		baseQuery += " AND (status = 'approved' OR status = 'synced')"
	}

	byStatus := map[string]int{}
	statusRows, _ := db.Query("SELECT status, COUNT(*) " + baseQuery + " GROUP BY status")
	if statusRows != nil {
		defer statusRows.Close()
		for statusRows.Next() {
			var s string
			var c int
			statusRows.Scan(&s, &c)
			byStatus[s] = c
		}
	}

	byPriority := map[string]int{}
	priorityRows, _ := db.Query("SELECT priority, COUNT(*) " + baseQuery + " GROUP BY priority")
	if priorityRows != nil {
		defer priorityRows.Close()
		for priorityRows.Next() {
			var p string
			var c int
			priorityRows.Scan(&p, &c)
			byPriority[p] = c
		}
	}

	overdueCount := 0
	nearDueCount := 0
	now := time.Now()
	deadlineRows, _ := db.Query("SELECT deadline " + baseQuery)
	if deadlineRows != nil {
		defer deadlineRows.Close()
		for deadlineRows.Next() {
			var d string
			deadlineRows.Scan(&d)
			t, err := time.Parse(time.RFC3339, d)
			if err != nil {
				t, err = time.Parse("2006-01-02T15:04:05Z07:00", d)
			}
			if err == nil {
				if t.Before(now) {
					overdueCount++
				} else if t.Before(now.Add(72 * time.Hour)) {
					nearDueCount++
				}
			}
		}
	}

	totalCount := 0
	db.QueryRow("SELECT COUNT(*) " + baseQuery).Scan(&totalCount)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"by_status":      byStatus,
		"by_priority":    byPriority,
		"overdue_count":  overdueCount,
		"near_due_count": nearDueCount,
		"total_count":    totalCount,
	})
}

func listAttachmentsHandler(c echo.Context) error {
	id, _ := strconv.Atoi(c.Param("id"))

	attachments := []Attachment{}
	rows, _ := db.Query(`SELECT a.id, a.entry_id, a.filename, a.file_type, a.file_size, a.description, a.uploaded_by, u.name, a.created_at
		FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id WHERE a.entry_id = ? ORDER BY a.created_at DESC`, id)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var a Attachment
			rows.Scan(&a.ID, &a.EntryID, &a.Filename, &a.FileType, &a.FileSize, &a.Description, &a.UploadedBy, &a.UploadedByName, &a.CreatedAt)
			attachments = append(attachments, a)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"attachments": attachments,
	})
}

func createAttachmentHandler(c echo.Context) error {
	user := getcurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var req CreateAttachmentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
	}

	if req.Filename == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "文件名不能为空"})
	}

	var exists int
	db.QueryRow("SELECT COUNT(*) FROM subcontractor_entries WHERE id = ?", id).Scan(&exists)
	if exists == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "分包进场单不存在"})
	}

	res, err := db.Exec(`INSERT INTO attachments (entry_id, filename, file_type, file_size, description, uploaded_by)
		VALUES (?, ?, ?, ?, ?, ?)`, id, req.Filename, req.FileType, req.FileSize, req.Description, user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	attID, _ := res.LastInsertId()

	db.Exec(`INSERT INTO audit_notes (entry_id, note_type, content, created_by)
		VALUES (?, 'audit', ?, ?)`, id, fmt.Sprintf("用户 %s 上传附件： %s", user.Name, req.Filename), user.ID)

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":      attID,
		"message": "附件上传成功",
	})
}

func auditTrailHandler(c echo.Context) error {
	id, _ := strconv.Atoi(c.Param("id"))

	records := []ProcessingRecord{}
	rRows, _ := db.Query(`SELECT id, entry_id, handler_role, handler_name, action, result, return_reason, created_at
		FROM processing_records WHERE entry_id = ? ORDER BY created_at ASC`, id)
	if rRows != nil {
		defer rRows.Close()
		for rRows.Next() {
			var r ProcessingRecord
			rRows.Scan(&r.ID, &r.EntryID, &r.HandlerRole, &r.HandlerName, &r.Action, &r.Result, &r.ReturnReason, &r.CreatedAt)
			records = append(records, r)
		}
	}

	notes := []AuditNote{}
	nRows, _ := db.Query(`SELECT n.id, n.entry_id, n.note_type, n.content, n.created_by, u.name, n.created_at
		FROM audit_notes n LEFT JOIN users u ON n.created_by = u.id WHERE n.entry_id = ? ORDER BY n.created_at ASC`, id)
	if nRows != nil {
		defer nRows.Close()
		for nRows.Next() {
			var n AuditNote
			nRows.Scan(&n.ID, &n.EntryID, &n.NoteType, &n.Content, &n.CreatedBy, &n.CreatedByName, &n.CreatedAt)
			notes = append(notes, n)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"records": records,
		"notes":   notes,
	})
}

func createAuditNoteHandler(c echo.Context) error {
	user := getcurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var req CreateAuditNoteRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
	}

	if req.Content == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "备注内容不能为空"})
	}

	if req.NoteType == "" {
		req.NoteType = "audit"
	}

	res, err := db.Exec(`INSERT INTO audit_notes (entry_id, note_type, content, created_by)
		VALUES (?, ?, ?, ?)`, id, req.NoteType, req.Content, user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	noteID, _ := res.LastInsertId()

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":      noteID,
		"message": "审计备注添加成功",
	})
}

func listExceptionsHandler(c echo.Context) error {
	resolvedFilter := c.QueryParam("resolved")
	typeFilter := c.QueryParam("exception_type")

	query := `SELECT e.id, e.entry_id, e.exception_type, e.description, e.detected_at, e.resolved, se.title
		FROM exception_logs e LEFT JOIN subcontractor_entries se ON e.entry_id = se.id WHERE 1=1`
	args := []interface{}{}

	if resolvedFilter != "" {
		query += " AND e.resolved = ?"
		args = append(args, resolvedFilter)
	}
	if typeFilter != "" {
		query += " AND e.exception_type = ?"
		args = append(args, typeFilter)
	}

	query += " ORDER BY e.detected_at DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer rows.Close()

	exceptions := []ExceptionLog{}
	for rows.Next() {
		var x ExceptionLog
		var resolved int
		var entryTitle sql.NullString
		rows.Scan(&x.ID, &x.EntryID, &x.ExceptionType, &x.Description, &x.DetectedAt, &resolved, &entryTitle)
		x.Resolved = resolved == 1
		if entryTitle.Valid {
			x.EntryTitle = entryTitle.String
		}
		exceptions = append(exceptions, x)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"exceptions": exceptions,
	})
}

func entryExceptionsHandler(c echo.Context) error {
	id, _ := strconv.Atoi(c.Param("id"))

	exceptions := []ExceptionLog{}
	rows, _ := db.Query(`SELECT id, entry_id, exception_type, description, detected_at, resolved
		FROM exception_logs WHERE entry_id = ? ORDER BY detected_at DESC`, id)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var x ExceptionLog
			var resolved int
			rows.Scan(&x.ID, &x.EntryID, &x.ExceptionType, &x.Description, &x.DetectedAt, &resolved)
			x.Resolved = resolved == 1
			exceptions = append(exceptions, x)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"exceptions": exceptions,
	})
}

func resolveExceptionHandler(c echo.Context) error {
	user := getcurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var exists int
	db.QueryRow("SELECT COUNT(*) FROM exception_logs WHERE id = ?", id).Scan(&exists)
	if exists == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "异常记录不存在"})
	}

	db.Exec("UPDATE exception_logs SET resolved = 1 WHERE id = ?", id)

	db.Exec(`INSERT INTO audit_notes (entry_id, note_type, content, created_by)
		SELECT entry_id, 'system', ?, ? FROM exception_logs WHERE id = ?`,
		fmt.Sprintf("用户 %s 标记异常为已解决", user.Name), user.ID, id)

	return c.JSON(http.StatusOK, map[string]string{"message": "异常已标记为已解决"})
}

func listUsersHandler(c echo.Context) error {
	rows, err := db.Query("SELECT id, username, role, name FROM users ORDER BY id")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer rows.Close()

	users := []User{}
	for rows.Next() {
		var u User
		rows.Scan(&u.ID, &u.Username, &u.Role, &u.Name)
		users = append(users, u)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"users": users,
	})
}

func logoutHandler(c echo.Context) error {
	token := c.Request().Header.Get("X-Auth-Token")
	if token != "" {
		tokenMutex.Lock()
		delete(tokenStore, token)
		tokenMutex.Unlock()
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "已退出登录"})
}

func statusLabel(s string) string {
	switch s {
	case "pending_review":
		return "待审核"
	case "approved":
		return "审核通过"
	case "returned":
		return "已退回"
	case "synced":
		return "已同步"
	default:
		return s
	}
}

func firstNonEmpty(args ...string) string {
	for _, a := range args {
		if a != "" {
			return a
		}
	}
	return ""
}

func main() {
	if err := initDB(); err != nil {
		fmt.Printf("Failed to initialize database: %v\n", err)
		return
	}
	defer db.Close()

	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"http://localhost:3002", "http://127.0.0.1:3002"},
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, "X-Auth-Token"},
		AllowCredentials: true,
	}))

	e.POST("/api/login", loginHandler)
	e.POST("/api/logout", logoutHandler)

	auth := e.Group("", authMiddleware)
	auth.GET("/api/me", meHandler)
	auth.GET("/api/users", listUsersHandler)

	auth.GET("/api/entries", listEntriesHandler)
	auth.GET("/api/entries/stats", statsHandler)
	auth.GET("/api/entries/:id", getEntryHandler)
	auth.POST("/api/entries", createEntryHandler)
	auth.PUT("/api/entries/:id/process", processEntryHandler)
	auth.POST("/api/entries/batch-process", batchProcessHandler)

	auth.GET("/api/entries/:id/attachments", listAttachmentsHandler)
	auth.POST("/api/entries/:id/attachments", createAttachmentHandler)

	auth.GET("/api/entries/:id/audit-trail", auditTrailHandler)
	auth.POST("/api/entries/:id/audit-notes", createAuditNoteHandler)

	auth.GET("/api/entries/:id/exceptions", entryExceptionsHandler)
	auth.GET("/api/exceptions", listExceptionsHandler)
	auth.PUT("/api/exceptions/:id/resolve", resolveExceptionHandler)

	fmt.Println("Server starting on :8002")
	e.Logger.Fatal(e.Start(":8002"))
}
