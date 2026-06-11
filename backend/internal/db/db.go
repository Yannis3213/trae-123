package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建数据目录失败: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath+"?_pragma=journal_mode=WAL&_pragma=foreign_keys=on")
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	DB.SetMaxOpenConns(1)

	if err = createTables(); err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}

	if err = seedData(); err != nil {
		return fmt.Errorf("初始化数据失败: %w", err)
	}

	return nil
}

func createTables() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			password TEXT NOT NULL,
			role TEXT NOT NULL,
			name TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS live_selection_orders (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_no TEXT NOT NULL UNIQUE,
			product_name TEXT NOT NULL,
			product_category TEXT NOT NULL,
			price REAL NOT NULL DEFAULT 0,
			stock INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'draft',
			current_handler TEXT NOT NULL,
			current_role TEXT NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			deadline DATETIME NOT NULL,
			submission_evidence TEXT NOT NULL DEFAULT '[]',
			sample_evidence TEXT NOT NULL DEFAULT '[]',
			registration_evidence TEXT NOT NULL DEFAULT '[]',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			created_by TEXT NOT NULL,
			exception_reason TEXT NOT NULL DEFAULT '',
			is_overdue INTEGER NOT NULL DEFAULT 0,
			overdue_reason TEXT NOT NULL DEFAULT ''
		)`,
		`CREATE TABLE IF NOT EXISTS selection_attachments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_id INTEGER NOT NULL,
			file_name TEXT NOT NULL,
			file_type TEXT NOT NULL,
			file_url TEXT NOT NULL,
			uploaded_by TEXT NOT NULL,
			uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			module_type TEXT NOT NULL DEFAULT 'submission',
			FOREIGN KEY (order_id) REFERENCES live_selection_orders(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS process_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_id INTEGER NOT NULL,
			operator TEXT NOT NULL,
			operator_role TEXT NOT NULL,
			action TEXT NOT NULL,
			from_status TEXT NOT NULL,
			to_status TEXT NOT NULL,
			opinion TEXT NOT NULL DEFAULT '',
			version INTEGER NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (order_id) REFERENCES live_selection_orders(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS audit_remarks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_id INTEGER NOT NULL,
			operator TEXT NOT NULL,
			operator_role TEXT NOT NULL,
			remark_type TEXT NOT NULL,
			content TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (order_id) REFERENCES live_selection_orders(id) ON DELETE CASCADE
		)`,
	}

	for _, stmt := range statements {
		if _, err := DB.Exec(stmt); err != nil {
			return fmt.Errorf("执行建表语句失败: %w, SQL: %s", err, stmt)
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

	now := time.Now()
	location, _ := time.LoadLocation("Asia/Shanghai")
	now = now.In(location)

	users := []struct {
		username string
		password string
		role     string
		name     string
	}{
		{"registrar", "123456", "registrar", "张登记"},
		{"auditor", "123456", "auditor", "李审核"},
		{"reviewer", "123456", "reviewer", "王复核"},
	}

	for _, u := range users {
		_, err := DB.Exec(
			"INSERT INTO users (username, password, role, name, created_at) VALUES (?, ?, ?, ?, ?)",
			u.username, u.password, u.role, u.name, now,
		)
		if err != nil {
			return err
		}
	}

	orders := []struct {
		orderNo         string
		productName     string
		productCategory string
		price           float64
		stock           int
		status          string
		currentHandler  string
		currentRole     string
		version         int
		deadline        time.Time
		subEv           string
		sampleEv        string
		regEv           string
		createdBy       string
		exceptionReason string
		isOverdue       bool
		overdueReason   string
	}{
		{
			"XZ20250601001", "高端护肤精华液", "美妆护肤", 299.0, 500,
			"draft", "registrar", "registrar", 1,
			now.AddDate(0, 0, 7),
			`[{"name":"产品资质证明.pdf","url":"/files/1.pdf"}]`,
			`[]`, `[]`,
			"registrar", "", false, "",
		},
		{
			"XZ20250601002", "有机坚果礼盒", "食品生鲜", 128.0, 1000,
			"pending_audit", "auditor", "auditor", 2,
			now.AddDate(0, 0, 5),
			`[{"name":"产品资质证明.pdf","url":"/files/2.pdf"},{"name":"样品检测报告.pdf","url":"/files/3.pdf"}]`,
			`[{"name":"样品照片.jpg","url":"/files/4.jpg"}]`,
			`[]`,
			"registrar", "", false, "",
		},
		{
			"XZ20250601003", "智能蓝牙音箱", "数码家电", 499.0, 300,
			"audit_passed", "reviewer", "reviewer", 3,
			now.AddDate(0, 0, 3),
			`[{"name":"产品资质证明.pdf","url":"/files/5.pdf"}]`,
			`[{"name":"样品检测报告.pdf","url":"/files/6.pdf"},{"name":"样品照片.jpg","url":"/files/7.jpg"}]`,
			`[{"name":"选品登记单.pdf","url":"/files/8.pdf"}]`,
			"registrar", "", false, "",
		},
		{
			"XZ20250601004", "夏季新款连衣裙", "服装鞋包", 199.0, 800,
			"synced", "", "", 4,
			now.AddDate(0, 0, -1),
			`[{"name":"产品资质证明.pdf","url":"/files/9.pdf"}]`,
			`[{"name":"样品检测报告.pdf","url":"/files/10.pdf"}]`,
			`[{"name":"选品登记单.pdf","url":"/files/11.pdf"},{"name":"归档确认单.pdf","url":"/files/12.pdf"}]`,
			"registrar", "", false, "",
		},
		{
			"XZ20250601005", "儿童益智玩具套装", "母婴玩具", 159.0, 600,
			"draft", "registrar", "registrar", 2,
			now.AddDate(0, 0, -2),
			`[]`,
			`[]`, `[]`,
			"registrar", "缺少产品安全认证和质检报告", false, "",
		},
		{
			"XZ20250601006", "家用空气净化器", "数码家电", 899.0, 200,
			"pending_audit", "auditor", "auditor", 1,
			now.AddDate(0, 0, -5),
			`[{"name":"产品资质证明.pdf","url":"/files/13.pdf"}]`,
			`[{"name":"样品检测报告.pdf","url":"/files/14.pdf"}]`,
			`[]`,
			"registrar", "", true, "审核超期未处理",
		},
		{
			"XZ20250601007", "进口零食大礼包", "食品生鲜", 88.0, 1200,
			"returned", "registrar", "registrar", 2,
			now.AddDate(0, 0, 10),
			`[{"name":"产品资质证明.pdf","url":"/files/15.pdf"}]`,
			`[{"name":"样品照片.jpg","url":"/files/16.jpg"}]`,
			`[]`,
			"registrar", "样品检测报告缺失，配料表信息不完整", false, "",
		},
	}

	for _, o := range orders {
		result, err := DB.Exec(`
			INSERT INTO live_selection_orders 
			(order_no, product_name, product_category, price, stock, status, 
			 current_handler, current_role, version, deadline, 
			 submission_evidence, sample_evidence, registration_evidence, 
			 created_by, exception_reason, is_overdue, overdue_reason, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			o.orderNo, o.productName, o.productCategory, o.price, o.stock, o.status,
			o.currentHandler, o.currentRole, o.version, o.deadline,
			o.subEv, o.sampleEv, o.regEv,
			o.createdBy, o.exceptionReason, o.isOverdue, o.overdueReason, now, now,
		)
		if err != nil {
			return err
		}

		orderID, _ := result.LastInsertId()

		if o.status == "pending_audit" && orderID == 2 {
			_, err = DB.Exec(`
				INSERT INTO process_records 
				(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, orderID, "registrar", "registrar", "submit", "draft", "pending_audit", "提交审核，材料齐全", 2, now)
			if err != nil {
				return err
			}
			_, err = DB.Exec(`
				INSERT INTO audit_remarks 
				(order_id, operator, operator_role, remark_type, content, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`, orderID, "registrar", "registrar", "status_change", "状态变更：草稿 -> 待审核", now)
			if err != nil {
				return err
			}
		}

		if o.status == "audit_passed" {
			records := []struct {
				operator string
				role     string
				action   string
				from     string
				to       string
				opinion  string
				version  int
			}{
				{"registrar", "registrar", "submit", "draft", "pending_audit", "提交审核", 2},
				{"auditor", "auditor", "audit", "pending_audit", "audit_passed", "审核通过，样品质量达标", 3},
			}
			for _, r := range records {
				_, err = DB.Exec(`
					INSERT INTO process_records 
					(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				`, orderID, r.operator, r.role, r.action, r.from, r.to, r.opinion, r.version, now.AddDate(0, 0, -r.version+1))
				if err != nil {
					return err
				}
				_, err = DB.Exec(`
					INSERT INTO audit_remarks 
					(order_id, operator, operator_role, remark_type, content, created_at)
					VALUES (?, ?, ?, ?, ?, ?)
				`, orderID, r.operator, r.role, "status_change",
					fmt.Sprintf("状态变更：%s -> %s", r.from, r.to),
					now.AddDate(0, 0, -r.version+1))
				if err != nil {
					return err
				}
			}
		}

		if o.status == "synced" {
			records := []struct {
				operator string
				role     string
				action   string
				from     string
				to       string
				opinion  string
				version  int
			}{
				{"registrar", "registrar", "submit", "draft", "pending_audit", "提交审核", 2},
				{"auditor", "auditor", "audit", "pending_audit", "audit_passed", "审核通过", 3},
				{"reviewer", "reviewer", "review", "audit_passed", "synced", "复核通过，已归档", 4},
			}
			for _, r := range records {
				_, err = DB.Exec(`
					INSERT INTO process_records 
					(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				`, orderID, r.operator, r.role, r.action, r.from, r.to, r.opinion, r.version, now.AddDate(0, 0, -r.version+1))
				if err != nil {
					return err
				}
				_, err = DB.Exec(`
					INSERT INTO audit_remarks 
					(order_id, operator, operator_role, remark_type, content, created_at)
					VALUES (?, ?, ?, ?, ?, ?)
				`, orderID, r.operator, r.role, "status_change",
					fmt.Sprintf("状态变更：%s -> %s", r.from, r.to),
					now.AddDate(0, 0, -r.version+1))
				if err != nil {
					return err
				}
			}
		}

		if o.status == "returned" {
			records := []struct {
				operator string
				role     string
				action   string
				from     string
				to       string
				opinion  string
				version  int
			}{
				{"registrar", "registrar", "submit", "draft", "pending_audit", "提交审核", 2},
				{"auditor", "auditor", "return", "pending_audit", "returned", "材料不齐，退回补正", 2},
			}
			for _, r := range records {
				_, err = DB.Exec(`
					INSERT INTO process_records 
					(order_id, operator, operator_role, action, from_status, to_status, opinion, version, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				`, orderID, r.operator, r.role, r.action, r.from, r.to, r.opinion, r.version, now.AddDate(0, 0, -r.version))
				if err != nil {
					return err
				}
			}
			_, err = DB.Exec(`
				INSERT INTO audit_remarks 
				(order_id, operator, operator_role, remark_type, content, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`, orderID, "auditor", "auditor", "exception", "审核退回：样品检测报告缺失，配料表信息不完整", now.AddDate(0, 0, -1))
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}
