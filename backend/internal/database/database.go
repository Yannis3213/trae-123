package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

func Init(dbPath string) (*sql.DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := migrate(db); err != nil {
		return nil, fmt.Errorf("failed to migrate: %w", err)
	}

	return db, nil
}

func migrate(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS checkin_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			flight_no TEXT NOT NULL,
			passenger_name TEXT NOT NULL,
			passenger_id TEXT NOT NULL,
			seat_no TEXT NOT NULL,
			checkin_time TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'draft',
			version INTEGER NOT NULL DEFAULT 1,
			deadline TEXT NOT NULL,
			created_by INTEGER NOT NULL,
			current_handler_role TEXT NOT NULL,
			return_reason TEXT DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS attachments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			record_id INTEGER NOT NULL,
			type TEXT NOT NULL,
			file_name TEXT NOT NULL,
			file_path TEXT NOT NULL,
			uploaded_by INTEGER NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY (record_id) REFERENCES checkin_records(id)
		)`,
		`CREATE TABLE IF NOT EXISTS processing_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			record_id INTEGER NOT NULL,
			handler_id INTEGER NOT NULL,
			handler_role TEXT NOT NULL,
			action TEXT NOT NULL,
			comment TEXT DEFAULT '',
			created_at TEXT NOT NULL,
			FOREIGN KEY (record_id) REFERENCES checkin_records(id)
		)`,
		`CREATE TABLE IF NOT EXISTS audit_notes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			record_id INTEGER NOT NULL,
			handler_id INTEGER NOT NULL,
			note TEXT NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY (record_id) REFERENCES checkin_records(id)
		)`,
		`CREATE TABLE IF NOT EXISTS exception_reasons (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			record_id INTEGER NOT NULL,
			reason_type TEXT NOT NULL,
			description TEXT NOT NULL,
			created_by INTEGER NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY (record_id) REFERENCES checkin_records(id)
		)`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("failed to execute migration: %w", err)
		}
	}

	return nil
}
