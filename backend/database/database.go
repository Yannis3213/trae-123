package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func Init() error {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/vocational_school.db"
	}

	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建数据目录失败: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	DB.SetMaxOpenConns(5)
	DB.SetMaxIdleConns(2)
	DB.SetConnMaxLifetime(0)

	if _, err = DB.Exec("PRAGMA journal_mode=WAL"); err != nil {
		log.Printf("设置 WAL 模式失败（不影响运行）: %v", err)
	}
	if _, err = DB.Exec("PRAGMA busy_timeout=5000"); err != nil {
		log.Printf("设置 busy_timeout 失败: %v", err)
	}

	if err = createTables(); err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}

	log.Println("数据库初始化成功")
	return nil
}

func createTables() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			name TEXT NOT NULL,
			role TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS student_applications (
			id TEXT PRIMARY KEY,
			student_name TEXT NOT NULL,
			id_card TEXT NOT NULL,
			phone TEXT NOT NULL,
			program TEXT NOT NULL,
			status TEXT NOT NULL,
			current_handler TEXT NOT NULL,
			current_handler_name TEXT NOT NULL,
			current_handler_role TEXT NOT NULL,
			next_handler TEXT DEFAULT '',
			next_handler_name TEXT DEFAULT '',
			next_handler_role TEXT DEFAULT '',
			assignment_deadline DATETIME NOT NULL,
			audit_deadline DATETIME NOT NULL,
			review_deadline DATETIME NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			urgency TEXT NOT NULL DEFAULT 'normal',
			responsible_person TEXT NOT NULL,
			responsible_person_name TEXT NOT NULL,
			materials_complete INTEGER NOT NULL DEFAULT 0,
			class_assigned INTEGER NOT NULL DEFAULT 0,
			payment_confirmed INTEGER NOT NULL DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS attachments (
			id TEXT PRIMARY KEY,
			application_id TEXT NOT NULL,
			type TEXT NOT NULL,
			name TEXT NOT NULL,
			uploaded_by TEXT NOT NULL,
			uploaded_at DATETIME NOT NULL,
			verified INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY (application_id) REFERENCES student_applications(id)
		)`,
		`CREATE TABLE IF NOT EXISTS processing_records (
			id TEXT PRIMARY KEY,
			application_id TEXT NOT NULL,
			action TEXT NOT NULL,
			handler_id TEXT NOT NULL,
			handler_name TEXT NOT NULL,
			handler_role TEXT NOT NULL,
			previous_status TEXT NOT NULL,
			new_status TEXT NOT NULL,
			previous_handler TEXT NOT NULL,
			new_handler TEXT NOT NULL,
			remark TEXT DEFAULT '',
			created_at DATETIME NOT NULL,
			version INTEGER NOT NULL,
			is_correction INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY (application_id) REFERENCES student_applications(id)
		)`,
		`CREATE TABLE IF NOT EXISTS audit_notes (
			id TEXT PRIMARY KEY,
			application_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			user_name TEXT NOT NULL,
			content TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			FOREIGN KEY (application_id) REFERENCES student_applications(id)
		)`,
		`CREATE TABLE IF NOT EXISTS exception_records (
			id TEXT PRIMARY KEY,
			application_id TEXT NOT NULL,
			type TEXT NOT NULL,
			reason TEXT NOT NULL,
			triggered_by TEXT NOT NULL,
			triggered_by_name TEXT NOT NULL,
			triggered_at DATETIME NOT NULL,
			resolved INTEGER NOT NULL DEFAULT 0,
			resolved_at DATETIME,
			resolution_note TEXT DEFAULT '',
			FOREIGN KEY (application_id) REFERENCES student_applications(id)
		)`,
	}

	for _, stmt := range statements {
		if _, err := DB.Exec(stmt); err != nil {
			return fmt.Errorf("执行语句失败 %s: %w", stmt, err)
		}
	}
	return nil
}
