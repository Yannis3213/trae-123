package database

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() error {
	var dbPath string
	if _, err := os.Stat("./data"); err == nil {
		dbPath = "./data/coldchain.db"
	} else {
		dbPath = "./coldchain.db"
	}

	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	DB.SetMaxOpenConns(1)

	if err = createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	if err = seedData(); err != nil {
		return fmt.Errorf("failed to seed data: %w", err)
	}

	return nil
}

func createTables() error {
	tables := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			password TEXT NOT NULL,
			role TEXT NOT NULL,
			display_name TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS applications (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_no TEXT NOT NULL UNIQUE,
			product_name TEXT NOT NULL DEFAULT '',
			product_count INTEGER NOT NULL DEFAULT 0,
			expected_date TEXT NOT NULL DEFAULT '',
			appointment_time TEXT NOT NULL DEFAULT '',
			temperature_zone TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'draft',
			current_step TEXT NOT NULL DEFAULT 'appointment',
			creator_id INTEGER NOT NULL,
			handler_id INTEGER NOT NULL DEFAULT 0,
			version INTEGER NOT NULL DEFAULT 1,
			correction_note TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (creator_id) REFERENCES users(id),
			FOREIGN KEY (handler_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS attachments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			application_id INTEGER NOT NULL,
			file_name TEXT NOT NULL,
			file_type TEXT NOT NULL,
			uploaded_by INTEGER NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY (application_id) REFERENCES applications(id),
			FOREIGN KEY (uploaded_by) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS processing_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			application_id INTEGER NOT NULL,
			operator_id INTEGER NOT NULL,
			action TEXT NOT NULL,
			from_status TEXT NOT NULL DEFAULT '',
			to_status TEXT NOT NULL DEFAULT '',
			remark TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			FOREIGN KEY (application_id) REFERENCES applications(id),
			FOREIGN KEY (operator_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS audit_notes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			application_id INTEGER NOT NULL,
			operator_id INTEGER NOT NULL,
			content TEXT NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY (application_id) REFERENCES applications(id),
			FOREIGN KEY (operator_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS exception_reasons (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			application_id INTEGER NOT NULL,
			operator_id INTEGER NOT NULL,
			reason_type TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			FOREIGN KEY (application_id) REFERENCES applications(id),
			FOREIGN KEY (operator_id) REFERENCES users(id)
		)`,
	}

	for _, table := range tables {
		if _, err := DB.Exec(table); err != nil {
			return err
		}
	}
	return nil
}

func seedData() error {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}

	now := time.Now().Format("2006-01-02 15:04:05")

	users := []struct {
		username, password, role, displayName string
	}{
		{"warehouse_clerk", "clerk123", "warehouse_clerk", "仓管员张三"},
		{"temp_supervisor", "temp123", "temp_supervisor", "温控主管李四"},
		{"warehouse_manager", "manager123", "warehouse_manager", "仓储经理王五"},
	}

	userIDs := make([]int64, len(users))
	for i, u := range users {
		res, err := tx.Exec("INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)",
			u.username, u.password, u.role, u.displayName)
		if err != nil {
			tx.Rollback()
			return err
		}
		userIDs[i], _ = res.LastInsertId()
	}

	type seedApp struct {
		orderNo, productName                 string
		productCount                         int
		expectedDate, appointmentTime        string
		temperatureZone, status, currentStep string
		creatorID, handlerID                 int64
		version                              int
		correctionNote                       string
	}

	today := time.Now()
	past15 := today.AddDate(0, 0, -15).Format("2006-01-02")
	past20 := today.AddDate(0, 0, -20).Format("2006-01-02")
	past25 := today.AddDate(0, 0, -25).Format("2006-01-02")
	past30 := today.AddDate(0, 0, -30).Format("2006-01-02")
	past45 := today.AddDate(0, 0, -45).Format("2006-01-02")
	past60 := today.AddDate(0, 0, -60).Format("2006-01-02")
	future15 := today.AddDate(0, 0, 15).Format("2006-01-02")
	future20 := today.AddDate(0, 0, 20).Format("2006-01-02")
	future25 := today.AddDate(0, 0, 25).Format("2006-01-02")
	future30 := today.AddDate(0, 0, 30).Format("2006-01-02")

	apps := []seedApp{
		{"CC-2026-001", "冷冻牛排", 200, future30, "09:00-11:00", "frozen", "completed", "confirmation", userIDs[0], userIDs[1], 4, ""},
		{"CC-2026-002", "冰鲜三文鱼", 150, future25, "10:00-12:00", "chilled", "under_review", "confirmation", userIDs[0], userIDs[1], 3, ""},
		{"CC-2026-003", "冷藏蔬菜", 300, future20, "08:00-10:00", "constant", "pending_temp", "allocation", userIDs[0], 0, 2, ""},
		{"CC-2026-004", "速冻水饺", 500, future15, "14:00-16:00", "frozen", "pending_correction", "appointment", userIDs[0], userIDs[1], 3, "缺少产品质检报告，请补充后重新提交"},
		{"CC-2026-005", "冷鲜牛奶", 100, future25, "07:00-09:00", "chilled", "draft", "appointment", userIDs[0], 0, 1, ""},
		{"CC-2026-006", "冷冻虾仁", 250, future20, "13:00-15:00", "frozen", "pending_temp", "allocation", userIDs[0], 0, 2, ""},
		{"CC-2026-007", "冷藏水果", 180, future15, "09:00-11:00", "constant", "pending_correction", "confirmation", userIDs[0], userIDs[1], 4, "温度区间与产品不匹配，请确认后重新提交"},
		{"CC-2026-008", "冰鲜鳕鱼", 120, future30, "10:00-12:00", "chilled", "under_review", "confirmation", userIDs[0], userIDs[1], 3, ""},
		{"CC-2026-009", "速冻汤圆", 400, future20, "15:00-17:00", "frozen", "draft", "appointment", userIDs[0], 0, 1, ""},
		{"CC-2026-010", "冷藏酸奶", 80, future15, "08:00-10:00", "constant", "pending_temp", "allocation", userIDs[0], 0, 2, ""},
		{"CC-2026-011", "冰鲜金枪鱼", 60, future25, "11:00-13:00", "chilled", "pending_correction", "appointment", userIDs[0], userIDs[1], 3, "入库预约时间已过，请重新预约"},
		{"CC-2026-012", "冷冻羊肉", 350, future30, "09:00-11:00", "frozen", "completed", "confirmation", userIDs[0], userIDs[1], 4, ""},

		{"CC-DEMO-OVERDUE-DRAFT", "过期冷冻鸡翅", 200, past60, "09:00-11:00", "frozen", "draft", "appointment", userIDs[0], 0, 1, ""},
		{"CC-DEMO-OVERDUE-TEMP", "过期冰鲜带鱼", 150, past45, "10:00-12:00", "chilled", "pending_temp", "allocation", userIDs[0], userIDs[1], 2, ""},
		{"CC-DEMO-OVERDUE-REVIEW", "过期冷藏螃蟹", 80, past30, "08:00-10:00", "constant", "under_review", "confirmation", userIDs[0], userIDs[2], 3, ""},
		{"CC-DEMO-OVERDUE-CORRECT", "过期速冻包子", 300, past25, "14:00-16:00", "frozen", "pending_correction", "appointment", userIDs[0], userIDs[1], 3, "预计入库日期已逾期，请确认后重新提交"},

		{"CC-DEMO-MISSING-EVIDENCE", "", 0, "", "10:00-12:00", "", "draft", "appointment", userIDs[0], 0, 1, ""},
		{"CC-DEMO-MISSING-CORRECT", "", 0, "", "09:00-11:00", "", "pending_correction", "appointment", userIDs[0], userIDs[1], 2, "缺少产品基本信息，请补充品名、数量和到期日"},

		{"CC-DEMO-CROSSROLE-CLERK", "越权测试-非我创建的草稿", 100, past15, "09:00-11:00", "frozen", "draft", "appointment", userIDs[1], 0, 1, ""},
		{"CC-DEMO-CROSSROLE-SUPV", "越权测试-分配给他人的温控", 100, past20, "10:00-12:00", "chilled", "pending_temp", "allocation", userIDs[0], userIDs[2], 2, ""},
		{"CC-DEMO-CROSSROLE-MGR", "越权测试-非我复核的单据", 100, past15, "08:00-10:00", "constant", "under_review", "confirmation", userIDs[0], userIDs[1], 3, ""},

		{"CC-DEMO-VERSION-OLD", "旧版本冲突测试-草稿", 80, future20, "09:00-11:00", "frozen", "draft", "appointment", userIDs[0], 0, 2, ""},
		{"CC-DEMO-VERSION-CORRECT", "旧版本冲突测试-待补正", 120, past15, "10:00-12:00", "chilled", "pending_correction", "appointment", userIDs[0], userIDs[1], 4, "此单据版本人为标旧，提交时将触发版本冲突"},
	}

	appIDs := make([]int64, len(apps))
	for i, a := range apps {
		res, err := tx.Exec(
			`INSERT INTO applications (order_no, product_name, product_count, expected_date, appointment_time,
			 temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			a.orderNo, a.productName, a.productCount, a.expectedDate, a.appointmentTime,
			a.temperatureZone, a.status, a.currentStep, a.creatorID, a.handlerID, a.version, a.correctionNote, now, now)
		if err != nil {
			tx.Rollback()
			return err
		}
		appIDs[i], _ = res.LastInsertId()
	}

	type seedRecord struct {
		appID, operatorID                    int64
		action, fromStatus, toStatus, remark string
	}

	records := []seedRecord{
		{appIDs[0], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[0], userIDs[1], "allocate", "pending_temp", "under_review", "分配冷冻区A-01库位"},
		{appIDs[0], userIDs[2], "confirm", "under_review", "completed", "确认入库完成"},

		{appIDs[1], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[1], userIDs[1], "allocate", "pending_temp", "under_review", "分配冷藏区B-03库位"},

		{appIDs[2], userIDs[0], "submit", "draft", "pending_temp", ""},

		{appIDs[3], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[3], userIDs[1], "return", "pending_temp", "pending_correction", "缺少产品质检报告"},

		{appIDs[5], userIDs[0], "submit", "draft", "pending_temp", ""},

		{appIDs[6], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[6], userIDs[1], "allocate", "pending_temp", "under_review", "分配恒温区C-02库位"},
		{appIDs[6], userIDs[2], "return", "under_review", "pending_correction", "温度区间与产品不匹配"},

		{appIDs[7], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[7], userIDs[1], "allocate", "pending_temp", "under_review", "分配冷藏区B-05库位"},

		{appIDs[9], userIDs[0], "submit", "draft", "pending_temp", ""},

		{appIDs[10], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[10], userIDs[1], "return", "pending_temp", "pending_correction", "入库预约时间已过"},

		{appIDs[11], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[11], userIDs[1], "allocate", "pending_temp", "under_review", "分配冷冻区A-05库位"},
		{appIDs[11], userIDs[2], "confirm", "under_review", "completed", "确认入库完成"},

		{appIDs[13], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[14], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[14], userIDs[1], "allocate", "pending_temp", "under_review", "分配恒温区C-04库位"},
		{appIDs[15], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[15], userIDs[1], "return", "pending_temp", "pending_correction", "预计入库日期已逾期"},

		{appIDs[17], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[17], userIDs[1], "return", "pending_temp", "pending_correction", "缺少产品基本信息"},

		{appIDs[19], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[20], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[20], userIDs[1], "allocate", "pending_temp", "under_review", "分配恒温区C-06库位"},

		{appIDs[22], userIDs[0], "submit", "draft", "pending_temp", ""},
		{appIDs[22], userIDs[1], "return", "pending_temp", "pending_correction", "版本冲突演示：此单据版本人为标旧"},
	}

	for _, r := range records {
		_, err := tx.Exec(
			`INSERT INTO processing_records (application_id, operator_id, action, from_status, to_status, remark, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			r.appID, r.operatorID, r.action, r.fromStatus, r.toStatus, r.remark, now)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	type seedException struct {
		appID, operatorID       int64
		reasonType, description string
	}

	exceptions := []seedException{
		{appIDs[3], userIDs[1], "missing_material", "缺少产品质检报告，无法继续分配温区"},
		{appIDs[5], userIDs[1], "timeout", "预计入库日期已过，等待超时处理"},
		{appIDs[6], userIDs[2], "status_conflict", "温度区间与产品类型不匹配，需返回修正"},
		{appIDs[8], userIDs[0], "timeout", "草稿单据超时未提交，预计入库日期已过"},
		{appIDs[10], userIDs[1], "returned", "入库预约时间已过，需重新预约后提交"},

		{appIDs[12], userIDs[0], "overdue", "草稿单据逾期未提交，预计入库日期已过60天"},
		{appIDs[13], userIDs[1], "overdue", "待温控分配单据逾期，预计入库日期已过45天"},
		{appIDs[14], userIDs[2], "overdue", "复核中单据逾期，预计入库日期已过30天"},
		{appIDs[15], userIDs[0], "overdue", "待补正单据逾期，预计入库日期已过25天"},

		{appIDs[16], userIDs[0], "evidence_missing", "缺少必填证据：品名/数量/预计到期日，无法提交"},
		{appIDs[17], userIDs[1], "evidence_missing", "待补正单据缺少必填证据：品名/数量/预计到期日"},

		{appIDs[18], userIDs[1], "cross_role", "越权测试：此草稿单据创建人为温控主管李四，仓管员张三无权提交"},
		{appIDs[19], userIDs[2], "cross_role", "越权测试：此待分配单据已分配给仓储经理王五，温控主管李四无权操作"},
		{appIDs[20], userIDs[1], "cross_role", "越权测试：此复核中单据的当前处理人不是温控主管李四"},

		{appIDs[21], userIDs[0], "version_conflict", "版本冲突测试：单据版本人为标为v2，前端提交v1时将触发拦截"},
		{appIDs[22], userIDs[1], "version_conflict", "版本冲突测试：待补正单据版本人为标为v4，前端提交旧版本将拦截"},
	}

	for _, e := range exceptions {
		_, err := tx.Exec(
			`INSERT INTO exception_reasons (application_id, operator_id, reason_type, description, created_at)
			 VALUES (?, ?, ?, ?, ?)`,
			e.appID, e.operatorID, e.reasonType, e.description, now)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}
