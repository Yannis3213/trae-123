package repository

import (
	"database/sql"
	"fmt"
	"log"

	"consultation-system/internal/config"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() error {
	var err error
	DB, err = sql.Open("sqlite3", config.SQLitePath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	DB.SetMaxOpenConns(1)

	if err = createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	log.Println("Database initialized successfully")
	return nil
}

func createTables() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			real_name TEXT NOT NULL,
			role TEXT NOT NULL,
			department TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS consultations (
			id TEXT PRIMARY KEY,
			patient_name TEXT NOT NULL,
			patient_id TEXT NOT NULL,
			age INTEGER,
			gender TEXT,
			department TEXT,
			attending_physician TEXT,
			consultation_type TEXT,
			consultation_reason TEXT,
			consultation_dept TEXT,
			requested_doctor TEXT,
			appointment_time DATETIME,
			deadline DATETIME,
			status TEXT NOT NULL,
			current_stage TEXT NOT NULL,
			current_handler TEXT,
			registrar_id TEXT,
			auditor_id TEXT,
			reviewer_id TEXT,
			urgency TEXT DEFAULT 'normal',
			evidence_list TEXT,
			version INTEGER DEFAULT 1,
			is_archived INTEGER DEFAULT 0,
			created_by TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_by TEXT,
			result TEXT,
			schedule_verified INTEGER DEFAULT 0,
			feedback_verified INTEGER DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS attachments (
			id TEXT PRIMARY KEY,
			consultation_id TEXT NOT NULL,
			file_name TEXT NOT NULL,
			file_type TEXT,
			evidence_type TEXT,
			uploaded_by TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (consultation_id) REFERENCES consultations(id)
		)`,
		`CREATE TABLE IF NOT EXISTS process_records (
			id TEXT PRIMARY KEY,
			consultation_id TEXT NOT NULL,
			stage TEXT NOT NULL,
			action TEXT NOT NULL,
			from_status TEXT,
			to_status TEXT,
			handler_id TEXT NOT NULL,
			handler_name TEXT NOT NULL,
			handler_role TEXT NOT NULL,
			remark TEXT,
			evidence_used TEXT,
			version INTEGER,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (consultation_id) REFERENCES consultations(id)
		)`,
		`CREATE TABLE IF NOT EXISTS abnormal_records (
			id TEXT PRIMARY KEY,
			consultation_id TEXT NOT NULL,
			abnormal_type TEXT NOT NULL,
			reason TEXT NOT NULL,
			reported_by TEXT,
			is_resolved INTEGER DEFAULT 0,
			resolution TEXT,
			resolved_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (consultation_id) REFERENCES consultations(id)
		)`,
		`CREATE TABLE IF NOT EXISTS audit_notes (
			id TEXT PRIMARY KEY,
			consultation_id TEXT NOT NULL,
			note TEXT NOT NULL,
			created_by TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (consultation_id) REFERENCES consultations(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status)`,
		`CREATE INDEX IF NOT EXISTS idx_consultations_stage ON consultations(current_stage)`,
		`CREATE INDEX IF NOT EXISTS idx_consultations_deadline ON consultations(deadline)`,
		`CREATE INDEX IF NOT EXISTS idx_process_consultation ON process_records(consultation_id)`,
		`CREATE INDEX IF NOT EXISTS idx_abnormal_consultation ON abnormal_records(consultation_id)`,
	}

	for _, stmt := range statements {
		if _, err := DB.Exec(stmt); err != nil {
			return fmt.Errorf("failed to execute statement: %w, sql: %s", err, stmt)
		}
	}

	return nil
}
