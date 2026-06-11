package main

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() {
	var err error
	DB, err = sql.Open("sqlite3", "./repair.db?_loc=auto")
	if err != nil {
		panic(err)
	}

	createTables()
	seedData()
}

func createTables() {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			name TEXT NOT NULL,
			role TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS repair_orders (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_no TEXT UNIQUE NOT NULL,
			title TEXT NOT NULL,
			description TEXT DEFAULT '',
			status TEXT NOT NULL DEFAULT '待接单',
			priority TEXT NOT NULL DEFAULT 'normal',
			customer_id INTEGER DEFAULT 0,
			technician_id INTEGER DEFAULT 0,
			manager_id INTEGER DEFAULT 0,
			deadline DATETIME DEFAULT '',
			version INTEGER NOT NULL DEFAULT 1,
			exception_type TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS attachments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_id INTEGER NOT NULL,
			file_name TEXT NOT NULL,
			category TEXT NOT NULL DEFAULT '',
			uploaded_by INTEGER DEFAULT 0,
			upload_role TEXT NOT NULL DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS process_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_id INTEGER NOT NULL,
			action TEXT NOT NULL,
			from_status TEXT DEFAULT '',
			to_status TEXT DEFAULT '',
			operator_id INTEGER DEFAULT 0,
			operator_role TEXT NOT NULL DEFAULT '',
			remark TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS audit_notes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_id INTEGER NOT NULL,
			note TEXT NOT NULL,
			author_id INTEGER DEFAULT 0,
			author_role TEXT NOT NULL DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS exception_reasons (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_id INTEGER NOT NULL,
			reason_type TEXT NOT NULL,
			description TEXT DEFAULT '',
			created_by INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, s := range statements {
		if _, err := DB.Exec(s); err != nil {
			panic(err)
		}
	}
}

func seedData() {
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count > 0 {
		return
	}

	users := []struct {
		username, password, name, role string
	}{
		{"kefu1", "123456", "客服专员张三", "客服专员"},
		{"shifu1", "123456", "师傅李四", "师傅调度"},
		{"jingli1", "123456", "经理王五", "服务经理"},
	}
	for _, u := range users {
		DB.Exec("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
			u.username, u.password, u.name, u.role)
	}

	now := time.Now()
	day := 24 * time.Hour

	orders := []struct {
		orderNo, title, status, priority, exceptionType string
		customerID, technicianID, managerID             int
		deadline                                        time.Time
	}{
		{"WX-2025-001", "3号楼空调故障", "待接单", "normal", "", 1, 0, 0, now.Add(3 * day)},
		{"WX-2025-002", "5层水管漏水", "待接单", "urgent", "", 1, 0, 0, now.Add(1 * day)},
		{"WX-2025-003", "1楼大厅照明损坏", "已接单", "normal", "", 1, 2, 0, now.Add(2 * day)},
		{"WX-2025-004", "7层电梯异响", "施工中", "normal", "", 1, 2, 0, now.Add(5 * day)},
		{"WX-2025-005", "地下车库消防栓漏水", "待验收", "normal", "超时", 1, 2, 0, now.Add(-1 * day)},
		{"WX-2025-006", "2层办公室门锁损坏", "验收通过", "normal", "", 1, 2, 3, now.Add(3 * day)},
		{"WX-2025-007", "4层卫生间堵漏", "退回补正", "normal", "缺材料", 1, 2, 0, now.Add(-2 * day)},
		{"WX-2025-008", "8层消防通道门故障", "待接单", "urgent", "逾期", 1, 0, 0, now.Add(-5 * day)},
	}

	for i, o := range orders {
		_, err := DB.Exec(
			`INSERT INTO repair_orders (order_no, title, description, status, priority, customer_id, technician_id, manager_id, deadline, version, exception_type, created_at, updated_at)
			VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
			o.orderNo, o.title, o.status, o.priority, o.customerID, o.technicianID, o.managerID,
			o.deadline.Format("2006-01-02 15:04:05"), o.exceptionType,
			now.Add(-time.Duration(8-i)*time.Hour).Format("2006-01-02 15:04:05"),
			now.Add(-time.Duration(8-i)*time.Hour).Format("2006-01-02 15:04:05"),
		)
		if err != nil {
			fmt.Println("seed order error:", err)
		}
	}

	baseTime := now.Add(-8 * time.Hour)
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (5, '建单', '', '待接单', 1, '客服专员', '', ?)`, baseTime.Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (5, '接单', '待接单', '已接单', 2, '师傅调度', '', ?)`, baseTime.Add(2*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (5, '开工', '已接单', '施工中', 2, '师傅调度', '', ?)`, baseTime.Add(4*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (5, '完工', '施工中', '待验收', 2, '师傅调度', '', ?)`, baseTime.Add(6*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO exception_reasons (order_id, reason_type, description, created_by, created_at) VALUES (5, '超时', '施工超期，已逾期1天', 2, ?)`, baseTime.Add(6*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO attachments (order_id, file_name, category, uploaded_by, upload_role, created_at) VALUES (5, '施工照片.jpg', '施工证据', 2, '师傅调度', ?)`, baseTime.Add(6*time.Hour).Format("2006-01-02 15:04:05"))

	baseTime6 := now.Add(-6 * time.Hour)
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (6, '建单', '', '待接单', 1, '客服专员', '', ?)`, baseTime6.Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (6, '接单', '待接单', '已接单', 2, '师傅调度', '', ?)`, baseTime6.Add(1*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (6, '开工', '已接单', '施工中', 2, '师傅调度', '', ?)`, baseTime6.Add(2*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (6, '完工', '施工中', '待验收', 2, '师傅调度', '', ?)`, baseTime6.Add(3*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (6, '验收通过', '待验收', '验收通过', 3, '服务经理', '', ?)`, baseTime6.Add(4*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO attachments (order_id, file_name, category, uploaded_by, upload_role, created_at) VALUES (6, '验收报告.pdf', '验收证据', 3, '服务经理', ?)`, baseTime6.Add(4*time.Hour).Format("2006-01-02 15:04:05"))

	baseTime7 := now.Add(-4 * time.Hour)
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (7, '建单', '', '待接单', 1, '客服专员', '', ?)`, baseTime7.Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (7, '接单', '待接单', '已接单', 2, '师傅调度', '', ?)`, baseTime7.Add(1*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (7, '开工', '已接单', '施工中', 2, '师傅调度', '', ?)`, baseTime7.Add(2*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (7, '完工', '施工中', '待验收', 2, '师傅调度', '', ?)`, baseTime7.Add(3*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at) VALUES (7, '退回补正', '待验收', '退回补正', 3, '服务经理', '材料不齐', ?)`, baseTime7.Add(4*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO exception_reasons (order_id, reason_type, description, created_by, created_at) VALUES (7, '缺材料', '缺少密封胶和防水涂料', 3, ?)`, baseTime7.Add(4*time.Hour).Format("2006-01-02 15:04:05"))
	DB.Exec(`INSERT INTO audit_notes (order_id, note, author_id, author_role, created_at) VALUES (7, '材料不齐，请补充后重新提交', 3, '服务经理', ?)`, baseTime7.Add(4*time.Hour).Format("2006-01-02 15:04:05"))

	DB.Exec(`INSERT INTO exception_reasons (order_id, reason_type, description, created_by, created_at) VALUES (8, '逾期', '无人接单超过5天', 0, ?)`, now.Add(-1*time.Hour).Format("2006-01-02 15:04:05"))

	fmt.Println("Database seeded with demo data")
}
