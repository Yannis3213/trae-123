package database

import (
	"database/sql"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func Init(dataSource string) error {
	var err error
	DB, err = sql.Open("sqlite3", dataSource)
	if err != nil {
		return err
	}

	DB.SetMaxOpenConns(1)
	DB.SetMaxIdleConns(1)

	if err = createTables(); err != nil {
		return err
	}

	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		role TEXT NOT NULL,
		password TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS onboarding_orders (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		candidate_name TEXT NOT NULL,
		position TEXT NOT NULL,
		department TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		current_node TEXT NOT NULL DEFAULT 'docs',
		current_role TEXT NOT NULL DEFAULT 'registrar',
		handler_id TEXT,
		handler_name TEXT,
		registrar_id TEXT NOT NULL,
		registrar_name TEXT NOT NULL,
		due_date DATETIME NOT NULL,
		warning_level TEXT NOT NULL DEFAULT 'normal',
		version INTEGER NOT NULL DEFAULT 1,
		is_exception INTEGER NOT NULL DEFAULT 0,
		exception_reason TEXT,
		remark TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS attachments (
		id TEXT PRIMARY KEY,
		order_id TEXT NOT NULL,
		node TEXT NOT NULL,
		type TEXT NOT NULL,
		name TEXT NOT NULL,
		url TEXT NOT NULL,
		uploaded_by TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (order_id) REFERENCES onboarding_orders(id)
	);

	CREATE TABLE IF NOT EXISTS process_records (
		id TEXT PRIMARY KEY,
		order_id TEXT NOT NULL,
		node TEXT NOT NULL,
		action TEXT NOT NULL,
		operator_id TEXT NOT NULL,
		operator_name TEXT NOT NULL,
		operator_role TEXT NOT NULL,
		from_status TEXT,
		to_status TEXT,
		from_node TEXT,
		to_node TEXT,
		remark TEXT,
		exception_type TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (order_id) REFERENCES onboarding_orders(id)
	);

	CREATE TABLE IF NOT EXISTS audit_notes (
		id TEXT PRIMARY KEY,
		order_id TEXT NOT NULL,
		status_label TEXT NOT NULL,
		content TEXT NOT NULL,
		created_by TEXT NOT NULL,
		created_by_name TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (order_id) REFERENCES onboarding_orders(id)
	);

	CREATE INDEX IF NOT EXISTS idx_orders_status ON onboarding_orders(status);
	CREATE INDEX IF NOT EXISTS idx_orders_role ON onboarding_orders(current_role);
	CREATE INDEX IF NOT EXISTS idx_orders_due ON onboarding_orders(due_date);
	CREATE INDEX IF NOT EXISTS idx_records_order ON process_records(order_id);
	CREATE INDEX IF NOT EXISTS idx_attachments_order ON attachments(order_id);
	CREATE INDEX IF NOT EXISTS idx_audit_order ON audit_notes(order_id);
	`

	_, err := DB.Exec(schema)
	if err != nil {
		log.Printf("Error creating tables: %v", err)
		return err
	}
	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}
