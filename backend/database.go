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

func insertProcessRecord(orderID int, action, fromStatus, toStatus string, operatorID int, operatorRole, remark string, createdAt time.Time) {
	DB.Exec(
		`INSERT INTO process_records (order_id, action, from_status, to_status, operator_id, operator_role, remark, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		orderID, action, fromStatus, toStatus, operatorID, operatorRole, remark, createdAt.Format("2006-01-02 15:04:05"),
	)
}

func insertAttachment(orderID int, fileName, category string, uploadedBy int, uploadRole string, createdAt time.Time) {
	DB.Exec(
		`INSERT INTO attachments (order_id, file_name, category, uploaded_by, upload_role, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		orderID, fileName, category, uploadedBy, uploadRole, createdAt.Format("2006-01-02 15:04:05"),
	)
}

func insertAuditNote(orderID int, note string, authorID int, authorRole string, createdAt time.Time) {
	DB.Exec(
		`INSERT INTO audit_notes (order_id, note, author_id, author_role, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		orderID, note, authorID, authorRole, createdAt.Format("2006-01-02 15:04:05"),
	)
}

func insertExceptionReason(orderID int, reasonType, description string, createdBy int, createdAt time.Time) {
	DB.Exec(
		`INSERT INTO exception_reasons (order_id, reason_type, description, created_by, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		orderID, reasonType, description, createdBy, createdAt.Format("2006-01-02 15:04:05"),
	)
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

	type seedOrder struct {
		orderNo, title, desc, status, priority, exceptionType string
		customerID, technicianID, managerID                   int
		deadline                                              time.Time
		version                                               int
	}

	orders := []seedOrder{
		{"WX-2025-001", "3号楼空调故障", "3号楼5层空调无法制冷，需更换压缩机", "待接单", "normal", "", 1, 0, 0, now.Add(3 * day), 1},
		{"WX-2025-002", "5层水管漏水", "5层走廊水管破裂漏水，紧急处理", "待接单", "urgent", "", 1, 0, 0, now.Add(1 * day), 1},
		{"WX-2025-003", "1楼大厅照明损坏", "1楼大厅多盏照明灯不亮", "已接单", "normal", "", 1, 2, 0, now.Add(2 * day), 2},
		{"WX-2025-004", "7层电梯异响", "7层电梯运行时有异常响声", "施工中", "normal", "", 1, 2, 0, now.Add(5 * day), 3},
		{"WX-2025-005", "地下车库消防栓漏水", "地下车库B区消防栓接口处持续漏水", "待验收", "normal", "超时", 1, 2, 0, now.Add(-1 * day), 4},
		{"WX-2025-006", "2层办公室门锁损坏", "2层201办公室门锁无法正常开关", "验收通过", "normal", "", 1, 2, 3, now.Add(3 * day), 5},
		{"WX-2025-007", "4层卫生间堵漏", "4层卫生间地面渗漏严重", "退回补正", "normal", "缺材料", 1, 2, 3, now.Add(-2 * day), 5},
		{"WX-2025-008", "8层消防通道门故障", "8层消防通道防火门无法自动关闭", "待接单", "urgent", "逾期", 1, 0, 0, now.Add(-5 * day), 1},
	}

	for i, o := range orders {
		createdAt := now.Add(-time.Duration(len(orders)-i+2) * time.Hour)
		_, err := DB.Exec(
			`INSERT INTO repair_orders (order_no, title, description, status, priority, customer_id, technician_id, manager_id, deadline, version, exception_type, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			o.orderNo, o.title, o.desc, o.status, o.priority, o.customerID, o.technicianID, o.managerID,
			o.deadline.Format("2006-01-02 15:04:05"), o.version, o.exceptionType,
			createdAt.Format("2006-01-02 15:04:05"),
			createdAt.Format("2006-01-02 15:04:05"),
		)
		if err != nil {
			fmt.Println("seed order error:", err)
		}
	}

	// Order 1: 正常流转 - 待接单，新建无流转
	t1 := now.Add(-10 * time.Hour)
	insertProcessRecord(1, "建单", "", "待接单", 1, "客服专员", "客户报修3号楼空调故障", t1)
	insertAttachment(1, "报修登记表.pdf", "登记证据", 1, "客服专员", t1)

	// Order 2: 临期 - 待接单，紧急
	t2 := now.Add(-8 * time.Hour)
	insertProcessRecord(2, "建单", "", "待接单", 1, "客服专员", "紧急工单，水管破裂漏水", t2)
	insertAttachment(2, "漏水现场照片.jpg", "登记证据", 1, "客服专员", t2)

	// Order 3: 已接单 - 正常流转中
	t3 := now.Add(-7 * time.Hour)
	insertProcessRecord(3, "建单", "", "待接单", 1, "客服专员", "", t3)
	insertProcessRecord(3, "接单", "待接单", "已接单", 2, "师傅调度", "已到场查看，需采购灯具", t3.Add(2*time.Hour))
	insertAttachment(3, "现场查看照片.jpg", "施工证据", 2, "师傅调度", t3.Add(2*time.Hour))

	// Order 4: 施工中 - 正常流转中
	t4 := now.Add(-6 * time.Hour)
	insertProcessRecord(4, "建单", "", "待接单", 1, "客服专员", "电梯异响需检修", t4)
	insertProcessRecord(4, "接单", "待接单", "已接单", 2, "师傅调度", "", t4.Add(1*time.Hour))
	insertProcessRecord(4, "开工", "已接单", "施工中", 2, "师傅调度", "开始检修电梯导轨", t4.Add(2*time.Hour))

	// Order 5: 待验收 + 超时逾期
	t5 := now.Add(-12 * time.Hour)
	insertProcessRecord(5, "建单", "", "待接单", 1, "客服专员", "消防栓漏水紧急处理", t5)
	insertProcessRecord(5, "接单", "待接单", "已接单", 2, "师傅调度", "", t5.Add(1*time.Hour))
	insertProcessRecord(5, "开工", "已接单", "施工中", 2, "师傅调度", "", t5.Add(2*time.Hour))
	insertProcessRecord(5, "完工", "施工中", "待验收", 2, "师傅调度", "施工完成，已更换接口密封", t5.Add(8*time.Hour))
	insertAttachment(5, "施工照片.jpg", "施工证据", 2, "师傅调度", t5.Add(8*time.Hour))
	insertAttachment(5, "维修对比照片.jpg", "施工证据", 2, "师傅调度", t5.Add(8*time.Hour))
	insertExceptionReason(5, "超时", "施工超期，从接单到完工耗时6小时，已逾期1天", 2, t5.Add(8*time.Hour))
	insertAuditNote(5, "施工已超期，需尽快验收", 2, "师傅调度", t5.Add(8*time.Hour))

	// Order 6: 验收通过 - 完整正常流转
	t6 := now.Add(-24 * time.Hour)
	insertProcessRecord(6, "建单", "", "待接单", 1, "客服专员", "门锁损坏影响办公", t6)
	insertProcessRecord(6, "接单", "待接单", "已接单", 2, "师傅调度", "", t6.Add(2*time.Hour))
	insertProcessRecord(6, "开工", "已接单", "施工中", 2, "师傅调度", "开始更换门锁", t6.Add(4*time.Hour))
	insertProcessRecord(6, "完工", "施工中", "待验收", 2, "师傅调度", "门锁更换完成", t6.Add(6*time.Hour))
	insertAttachment(6, "旧门锁照片.jpg", "施工证据", 2, "师傅调度", t6.Add(6*time.Hour))
	insertAttachment(6, "新门锁安装照片.jpg", "施工证据", 2, "师傅调度", t6.Add(6*time.Hour))
	insertProcessRecord(6, "验收通过", "待验收", "验收通过", 3, "服务经理", "门锁安装到位，功能正常", t6.Add(8*time.Hour))
	insertAttachment(6, "验收报告.pdf", "验收证据", 3, "服务经理", t6.Add(8*time.Hour))
	insertAuditNote(6, "验收合格，维修质量良好", 3, "服务经理", t6.Add(8*time.Hour))

	// Order 7: 退回补正 - 缺材料
	t7 := now.Add(-20 * time.Hour)
	insertProcessRecord(7, "建单", "", "待接单", 1, "客服专员", "卫生间地面渗漏需防水处理", t7)
	insertProcessRecord(7, "接单", "待接单", "已接单", 2, "师傅调度", "", t7.Add(2*time.Hour))
	insertProcessRecord(7, "开工", "已接单", "施工中", 2, "师傅调度", "开始排查渗漏点", t7.Add(4*time.Hour))
	insertProcessRecord(7, "完工", "施工中", "待验收", 2, "师傅调度", "防水处理完成", t7.Add(8*time.Hour))
	insertAttachment(7, "施工照片.jpg", "施工证据", 2, "师傅调度", t7.Add(8*time.Hour))
	insertProcessRecord(7, "退回补正", "待验收", "退回补正", 3, "服务经理", "防水材料不达标，需重新施工", t7.Add(10*time.Hour))
	insertExceptionReason(7, "缺材料", "缺少密封胶和防水涂料，现有材料不达标", 3, t7.Add(10*time.Hour))
	insertAuditNote(7, "材料不齐且不达标，请补充合格材料后重新提交", 3, "服务经理", t7.Add(10*time.Hour))
	insertAuditNote(7, "已联系供应商补货，预计明天到货", 2, "师傅调度", t7.Add(12*time.Hour))

	// Order 8: 待接单 + 逾期
	t8 := now.Add(-7 * 24 * time.Hour)
	insertProcessRecord(8, "建单", "", "待接单", 1, "客服专员", "消防通道门故障，影响安全", t8)
	insertExceptionReason(8, "逾期", "无人接单超过5天，紧急工单逾期", 0, now.Add(-1*time.Hour))
	insertAuditNote(8, "紧急工单逾期未接单，请尽快安排师傅处理", 3, "服务经理", now.Add(-1*time.Hour))

	fmt.Println("Database seeded with demo data")
}
