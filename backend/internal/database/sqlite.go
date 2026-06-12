package database

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

func InitDB(dbPath string) (*sql.DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite3", dbPath+"?_fk=1&_journal_mode=WAL")
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	if err := createTables(db); err != nil {
		return nil, err
	}

	return db, nil
}

func createTables(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS trademark_applications (
		id TEXT PRIMARY KEY,
		application_no TEXT UNIQUE NOT NULL,
		trademark_name TEXT NOT NULL,
		applicant_name TEXT NOT NULL,
		applicant_contact TEXT,
		category TEXT,
		status TEXT NOT NULL DEFAULT 'pending_assign',
		current_handler TEXT,
		created_by TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		due_date DATETIME NOT NULL,
		warning_status TEXT NOT NULL DEFAULT 'normal',
		warning_text TEXT,
		last_opinion TEXT,
		last_handler_name TEXT,
		last_handle_time DATETIME,
		version INTEGER NOT NULL DEFAULT 1,
		material_complete INTEGER NOT NULL DEFAULT 0,
		evidence_complete INTEGER NOT NULL DEFAULT 0,
		current_node TEXT,
		node_due_date DATETIME,
		node_overdue INTEGER NOT NULL DEFAULT 0,
		node_responsible TEXT
	);

	CREATE TABLE IF NOT EXISTS attachments (
		id TEXT PRIMARY KEY,
		application_id TEXT NOT NULL,
		file_name TEXT NOT NULL,
		file_type TEXT,
		file_size INTEGER,
		module_type TEXT NOT NULL,
		uploaded_by TEXT NOT NULL,
		uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		evidence_type TEXT,
		FOREIGN KEY (application_id) REFERENCES trademark_applications(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS processing_records (
		id TEXT PRIMARY KEY,
		application_id TEXT NOT NULL,
		action TEXT NOT NULL,
		old_status TEXT,
		new_status TEXT,
		handler TEXT NOT NULL,
		opinion TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		module_type TEXT,
		FOREIGN KEY (application_id) REFERENCES trademark_applications(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS audit_remarks (
		id TEXT PRIMARY KEY,
		application_id TEXT NOT NULL,
		content TEXT NOT NULL,
		created_by TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (application_id) REFERENCES trademark_applications(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS exception_reasons (
		id TEXT PRIMARY KEY,
		application_id TEXT NOT NULL,
		reason TEXT NOT NULL,
		reason_type TEXT,
		created_by TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		module_type TEXT,
		resolved INTEGER NOT NULL DEFAULT 0,
		resolved_at DATETIME,
		material_complete INTEGER,
		evidence_complete INTEGER,
		opinion TEXT,
		summary TEXT,
		FOREIGN KEY (application_id) REFERENCES trademark_applications(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_app_status ON trademark_applications(status);
	CREATE INDEX IF NOT EXISTS idx_app_handler ON trademark_applications(current_handler);
	CREATE INDEX IF NOT EXISTS idx_app_created ON trademark_applications(created_at);
	CREATE INDEX IF NOT EXISTS idx_app_warning ON trademark_applications(warning_status);
	CREATE INDEX IF NOT EXISTS idx_records_app ON processing_records(application_id);
	CREATE INDEX IF NOT EXISTS idx_records_created ON processing_records(created_at);
	CREATE INDEX IF NOT EXISTS idx_attach_app ON attachments(application_id);
	CREATE INDEX IF NOT EXISTS idx_audit_app ON audit_remarks(application_id);
	CREATE INDEX IF NOT EXISTS idx_exception_app ON exception_reasons(application_id);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return err
	}

	migrations := []string{
		"ALTER TABLE exception_reasons ADD COLUMN material_complete INTEGER",
		"ALTER TABLE exception_reasons ADD COLUMN evidence_complete INTEGER",
		"ALTER TABLE exception_reasons ADD COLUMN opinion TEXT",
		"ALTER TABLE exception_reasons ADD COLUMN summary TEXT",
	}
	for _, m := range migrations {
		db.Exec(m)
	}

	return nil
}
