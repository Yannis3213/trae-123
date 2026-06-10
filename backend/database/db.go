package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("创建数据库目录失败: %v", err)
		}
	}

	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return fmt.Errorf("打开数据库失败: %v", err)
	}

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("连接数据库失败: %v", err)
	}

	if err = createTables(); err != nil {
		return fmt.Errorf("创建表失败: %v", err)
	}

	if err = migrateSchema(); err != nil {
		return fmt.Errorf("迁移表结构失败: %v", err)
	}

	return nil
}

func migrateSchema() error {
	columns := map[string]string{
		"confirmed": "INTEGER NOT NULL DEFAULT 0",
	}

	for col, def := range columns {
		var exists bool
		DB.QueryRow("SELECT 1 FROM pragma_table_info('lease_applications') WHERE name = ?", col).Scan(&exists)
		if !exists {
			_, err := DB.Exec(fmt.Sprintf("ALTER TABLE lease_applications ADD COLUMN %s %s", col, def))
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func createTables() error {
	sqls := []string{
		`CREATE TABLE IF NOT EXISTS lease_applications (
			id TEXT PRIMARY KEY,
			application_no TEXT UNIQUE NOT NULL,
			tenant_name TEXT NOT NULL,
			tenant_phone TEXT NOT NULL,
			room_number TEXT NOT NULL,
			building_name TEXT NOT NULL,
			lease_start_date TEXT NOT NULL,
			lease_end_date TEXT NOT NULL,
			monthly_rent REAL NOT NULL,
			deposit REAL NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending_verification',
			current_handler_id TEXT DEFAULT '',
			current_handler_name TEXT DEFAULT '',
			current_handler_role TEXT DEFAULT '',
			version INTEGER NOT NULL DEFAULT 1,
			confirmed INTEGER NOT NULL DEFAULT 0,
			tenant_signing_status TEXT DEFAULT 'pending',
			room_confirmation_status TEXT DEFAULT 'pending',
			move_in_handover_status TEXT DEFAULT 'pending',
			exception_reason TEXT DEFAULT '',
			created_at TEXT DEFAULT '',
			updated_at TEXT DEFAULT ''
		)`,
		`CREATE TABLE IF NOT EXISTS attachments (
			id TEXT PRIMARY KEY,
			application_id TEXT NOT NULL,
			file_name TEXT NOT NULL,
			file_type TEXT NOT NULL,
			file_path TEXT NOT NULL,
			uploaded_by TEXT NOT NULL,
			upload_role TEXT NOT NULL,
			created_at TEXT DEFAULT ''
		)`,
		`CREATE TABLE IF NOT EXISTS processing_records (
			id TEXT PRIMARY KEY,
			application_id TEXT NOT NULL,
			handler_id TEXT NOT NULL,
			handler_name TEXT NOT NULL,
			handler_role TEXT NOT NULL,
			action TEXT NOT NULL,
			from_status TEXT DEFAULT '',
			to_status TEXT DEFAULT '',
			remark TEXT DEFAULT '',
			exception_reason TEXT DEFAULT '',
			created_at TEXT DEFAULT ''
		)`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			application_id TEXT NOT NULL,
			operator_id TEXT NOT NULL,
			operator_name TEXT NOT NULL,
			operator_role TEXT NOT NULL,
			action TEXT NOT NULL,
			before_status TEXT DEFAULT '',
			after_status TEXT DEFAULT '',
			detail TEXT DEFAULT '',
			failure_reason TEXT DEFAULT '',
			created_at TEXT DEFAULT ''
		)`,
	}

	for _, s := range sqls {
		if _, err := DB.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}
