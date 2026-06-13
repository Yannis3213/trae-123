package database

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dataDir string) error {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}

	dbPath := filepath.Join(dataDir, "pharmacy.db")
	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return err
	}

	if err = DB.Ping(); err != nil {
		return err
	}

	if err = createTables(); err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		role TEXT NOT NULL,
		store TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS near_expiry_orders (
		id TEXT PRIMARY KEY,
		order_no TEXT UNIQUE NOT NULL,
		store_name TEXT NOT NULL,
		product_name TEXT NOT NULL,
		batch_no TEXT NOT NULL,
		expiry_date DATETIME NOT NULL,
		quantity INTEGER NOT NULL,
		status TEXT NOT NULL,
		current_handler TEXT NOT NULL,
		created_by TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		version INTEGER NOT NULL DEFAULT 1,
		due_date DATETIME NOT NULL,
		closed_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS attachments (
		id TEXT PRIMARY KEY,
		order_id TEXT NOT NULL,
		evidence_type TEXT NOT NULL,
		file_name TEXT NOT NULL,
		uploaded_by TEXT NOT NULL,
		uploaded_at DATETIME NOT NULL,
		remark TEXT,
		FOREIGN KEY (order_id) REFERENCES near_expiry_orders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS processing_records (
		id TEXT PRIMARY KEY,
		order_id TEXT NOT NULL,
		action TEXT NOT NULL,
		from_status TEXT NOT NULL,
		to_status TEXT NOT NULL,
		operator TEXT NOT NULL,
		operator_role TEXT NOT NULL,
		remark TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (order_id) REFERENCES near_expiry_orders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS audit_notes (
		id TEXT PRIMARY KEY,
		order_id TEXT NOT NULL,
		content TEXT NOT NULL,
		author TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (order_id) REFERENCES near_expiry_orders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS exception_reasons (
		id TEXT PRIMARY KEY,
		order_id TEXT NOT NULL,
		reason TEXT NOT NULL,
		exception_type TEXT NOT NULL,
		reported_by TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		resolved INTEGER NOT NULL DEFAULT 0,
		FOREIGN KEY (order_id) REFERENCES near_expiry_orders(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_orders_status ON near_expiry_orders(status);
	CREATE INDEX IF NOT EXISTS idx_orders_handler ON near_expiry_orders(current_handler);
	CREATE INDEX IF NOT EXISTS idx_orders_store ON near_expiry_orders(store_name);
	CREATE INDEX IF NOT EXISTS idx_attachments_order ON attachments(order_id);
	CREATE INDEX IF NOT EXISTS idx_records_order ON processing_records(order_id);
	`

	_, err := DB.Exec(schema)
	return err
}
