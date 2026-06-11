package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB() error {
	dbPath := filepath.Join("data", "fire_hazard.db")
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return fmt.Errorf("创建数据目录失败: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("连接数据库失败: %w", err)
	}

	if err = createTables(); err != nil {
		return fmt.Errorf("创建数据表失败: %w", err)
	}

	log.Println("数据库初始化成功")
	return nil
}

func createTables() error {
	sqlStmt := `
	CREATE TABLE IF NOT EXISTS fire_hazards (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		hazard_no TEXT UNIQUE NOT NULL,
		title TEXT NOT NULL,
		description TEXT,
		location TEXT,
		priority TEXT NOT NULL DEFAULT 'medium',
		responsible TEXT,
		current_handler TEXT,
		status TEXT NOT NULL DEFAULT 'draft',
		deadline DATETIME,
		warning_level TEXT NOT NULL DEFAULT 'normal',
		abnormal_tags TEXT DEFAULT '[]',
		rectify_notice TEXT,
		recheck_result TEXT,
		return_reason TEXT,
		version INTEGER NOT NULL DEFAULT 1,
		created_by TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS attachments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		hazard_id INTEGER NOT NULL,
		file_name TEXT NOT NULL,
		file_type TEXT,
		file_size INTEGER DEFAULT 0,
		file_url TEXT,
		uploaded_by TEXT,
		uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (hazard_id) REFERENCES fire_hazards(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS process_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		hazard_id INTEGER NOT NULL,
		action TEXT NOT NULL,
		from_status TEXT,
		to_status TEXT,
		operator TEXT NOT NULL,
		operator_role TEXT NOT NULL,
		remark TEXT,
		evidence TEXT DEFAULT '[]',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (hazard_id) REFERENCES fire_hazards(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS audit_notes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		hazard_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		auditor TEXT NOT NULL,
		auditor_role TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (hazard_id) REFERENCES fire_hazards(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS abnormal_reasons (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		hazard_id INTEGER NOT NULL,
		reason TEXT NOT NULL,
		category TEXT,
		reported_by TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		resolved INTEGER NOT NULL DEFAULT 0,
		FOREIGN KEY (hazard_id) REFERENCES fire_hazards(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_hazards_status ON fire_hazards(status);
	CREATE INDEX IF NOT EXISTS idx_hazards_handler ON fire_hazards(current_handler);
	CREATE INDEX IF NOT EXISTS idx_hazards_deadline ON fire_hazards(deadline);
	CREATE INDEX IF NOT EXISTS idx_records_hazard ON process_records(hazard_id);
	`
	_, err := DB.Exec(sqlStmt)
	return err
}
