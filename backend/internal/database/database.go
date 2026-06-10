package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
	"workshop-system/internal/config"
	"workshop-system/internal/models"
)

var DB *sql.DB

func Init() error {
	dbPath := config.AppConfig.DBPath

	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return fmt.Errorf("failed to create data directory: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err := createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	if err := seedData(); err != nil {
		return fmt.Errorf("failed to seed data: %w", err)
	}

	log.Println("Database initialized successfully")
	return nil
}

func createTables() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			password TEXT NOT NULL,
			name TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS work_orders (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			order_no TEXT NOT NULL UNIQUE,
			appointment_clue TEXT NOT NULL,
			customer_name TEXT NOT NULL,
			phone TEXT NOT NULL,
			license_plate TEXT NOT NULL,
			car_model TEXT NOT NULL,
			mileage INTEGER DEFAULT 0,
			fault_description TEXT,
			status TEXT NOT NULL,
			registrar_id INTEGER NOT NULL,
			registrar_name TEXT NOT NULL,
			current_handler_id INTEGER NOT NULL,
			current_handler_name TEXT NOT NULL,
			supervisor_id INTEGER,
			supervisor_name TEXT,
			manager_id INTEGER,
			manager_name TEXT,
			expected_complete_at DATETIME NOT NULL,
			warning_level TEXT DEFAULT 'normal',
			is_overdue INTEGER DEFAULT 0,
			version INTEGER DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (registrar_id) REFERENCES users(id)
		)`,

		`CREATE TABLE IF NOT EXISTS attachments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			work_order_id INTEGER NOT NULL,
			file_name TEXT NOT NULL,
			file_type TEXT NOT NULL,
			file_size INTEGER NOT NULL,
			file_path TEXT NOT NULL,
			uploaded_by INTEGER NOT NULL,
			uploader TEXT NOT NULL,
			evidence_type TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
		)`,

		`CREATE TABLE IF NOT EXISTS processing_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			work_order_id INTEGER NOT NULL,
			operator_id INTEGER NOT NULL,
			operator TEXT NOT NULL,
			action TEXT NOT NULL,
			from_status TEXT,
			to_status TEXT,
			remark TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
		)`,

		`CREATE TABLE IF NOT EXISTS audit_notes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			work_order_id INTEGER NOT NULL,
			operator_id INTEGER NOT NULL,
			operator TEXT NOT NULL,
			note TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
		)`,

		`CREATE TABLE IF NOT EXISTS exception_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			work_order_id INTEGER NOT NULL,
			exception_type TEXT NOT NULL,
			reason TEXT NOT NULL,
			operator_id INTEGER NOT NULL,
			operator TEXT NOT NULL,
			current_status TEXT NOT NULL,
			resolution TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			resolved_at DATETIME,
			FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
		)`,

		`CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status)`,
		`CREATE INDEX IF NOT EXISTS idx_work_orders_handler ON work_orders(current_handler_id)`,
		`CREATE INDEX IF NOT EXISTS idx_work_orders_warning ON work_orders(warning_level)`,
		`CREATE INDEX IF NOT EXISTS idx_work_orders_appointment ON work_orders(appointment_clue)`,
		`CREATE INDEX IF NOT EXISTS idx_attachments_order ON attachments(work_order_id)`,
		`CREATE INDEX IF NOT EXISTS idx_logs_order ON processing_logs(work_order_id)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_order ON audit_notes(work_order_id)`,
		`CREATE INDEX IF NOT EXISTS idx_exceptions_order ON exception_records(work_order_id)`,
	}

	for _, stmt := range statements {
		if _, err := DB.Exec(stmt); err != nil {
			return fmt.Errorf("failed to execute statement: %w", err)
		}
	}

	return nil
}

func seedData() error {
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count > 0 {
		return nil
	}

	users := []struct {
		username string
		password string
		name     string
		role     models.Role
	}{
		{"registrar", "123456", "张登记", models.RoleRegistrar},
		{"supervisor", "123456", "李主管", models.RoleSupervisor},
		{"manager", "123456", "王经理", models.RoleManager},
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, _ := tx.Prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)")
	defer stmt.Close()

	for _, u := range users {
		hashed, _ := bcrypt.GenerateFromPassword([]byte(u.password), bcrypt.DefaultCost)
		_, err := stmt.Exec(u.username, string(hashed), u.name, u.role)
		if err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Println("Demo users created successfully")
	return seedWorkOrders()
}

func seedWorkOrders() error {
	now := time.Now()

	orders := []struct {
		orderNo          string
		appointmentClue  string
		customerName     string
		phone            string
		licensePlate     string
		carModel         string
		mileage          int
		faultDescription string
		status           models.WorkOrderStatus
		registrarID      int64
		registrarName    string
		handlerID        int64
		handlerName      string
		supervisorID     *int64
		supervisorName   *string
		expectedAt       time.Time
		exceptionType    string
		exceptionReason  string
	}{
		{
			orderNo:          "WO20240601001",
			appointmentClue:  "AP20240530001",
			customerName:     "陈先生",
			phone:            "13800138001",
			licensePlate:     "京A12345",
			carModel:         "宝马530Li",
			mileage:          45000,
			faultDescription: "正常保养，更换机油机滤",
			status:           models.StatusPendingReview,
			registrarID:      1,
			registrarName:    "张登记",
			handlerID:        3,
			handlerName:      "王经理",
			supervisorID:     int64Ptr(2),
			supervisorName:   stringPtr("李主管"),
			expectedAt:       now.AddDate(0, 0, 5),
		},
		{
			orderNo:          "WO20240601002",
			appointmentClue:  "AP20240530002",
			customerName:     "刘女士",
			phone:            "13800138002",
			licensePlate:     "京B67890",
			carModel:         "奔驰E300",
			mileage:          32000,
			faultDescription: "刹车片磨损报警，需要更换",
			status:           models.StatusPendingAudit,
			registrarID:      1,
			registrarName:    "张登记",
			handlerID:        2,
			handlerName:      "李主管",
			expectedAt:       now.AddDate(0, 0, 1),
			exceptionType:    "missing_materials",
			exceptionReason:  "缺少刹车片检测报告和报价单",
		},
		{
			orderNo:          "WO20240601003",
			appointmentClue:  "AP20240528003",
			customerName:     "赵先生",
			phone:            "13800138003",
			licensePlate:     "京C11111",
			carModel:         "奥迪A6L",
			mileage:          78000,
			faultDescription: "发动机异响，需要大修检测",
			status:           models.StatusCorrection,
			registrarID:      1,
			registrarName:    "张登记",
			handlerID:        1,
			handlerName:      "张登记",
			supervisorID:     int64Ptr(2),
			supervisorName:   stringPtr("李主管"),
			expectedAt:       now.AddDate(0, 0, -2),
			exceptionType:    "overdue",
			exceptionReason:  "工单已逾期2天，发动机配件尚未到货",
		},
		{
			orderNo:          "WO20240601004",
			appointmentClue:  "AP20240525004",
			customerName:     "孙先生",
			phone:            "13800138004",
			licensePlate:     "京D22222",
			carModel:         "丰田凯美瑞",
			mileage:          56000,
			faultDescription: "空调不制冷，需要检修",
			status:           models.StatusCorrection,
			registrarID:      1,
			registrarName:    "张登记",
			handlerID:        1,
			handlerName:      "张登记",
			expectedAt:       now.AddDate(0, 0, 3),
			exceptionType:    "correction",
			exceptionReason:  "退回补正：缺少故障检测照片，维修技师信息不完整",
		},
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, o := range orders {
		res, err := tx.Exec(`
			INSERT INTO work_orders (
				order_no, appointment_clue, customer_name, phone, license_plate,
				car_model, mileage, fault_description, status,
				registrar_id, registrar_name, current_handler_id, current_handler_name,
				supervisor_id, supervisor_name, expected_complete_at,
				warning_level, is_overdue, version
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			o.orderNo, o.appointmentClue, o.customerName, o.phone, o.licensePlate,
			o.carModel, o.mileage, o.faultDescription, o.status,
			o.registrarID, o.registrarName, o.handlerID, o.handlerName,
			o.supervisorID, o.supervisorName, o.expectedAt,
			calculateWarningLevel(o.expectedAt), isOverdue(o.expectedAt), 1,
		)
		if err != nil {
			return err
		}

		orderID, _ := res.LastInsertId()

		if o.exceptionType != "" {
			_, err := tx.Exec(`
				INSERT INTO exception_records (
					work_order_id, exception_type, reason,
					operator_id, operator, current_status
				) VALUES (?, ?, ?, ?, ?, ?)
			`, orderID, o.exceptionType, o.exceptionReason, 2, "李主管", o.status)
			if err != nil {
				return err
			}
		}

		_, err = tx.Exec(`
			INSERT INTO processing_logs (
				work_order_id, operator_id, operator, action,
				from_status, to_status, remark
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`, orderID, 1, "张登记", "创建工单", "", o.status, "系统自动创建演示工单")
		if err != nil {
			return err
		}
	}

	if err := seedAttachments(tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Println("Demo work orders created successfully")
	return nil
}

func seedAttachments(tx *sql.Tx) error {
	attachments := []struct {
		orderID      int64
		fileName     string
		fileType     string
		fileSize     int64
		evidenceType string
		uploadedBy   int64
		uploader     string
	}{
		{1, "工单登记表_宝马530Li.pdf", "application/pdf", 102400, "registration_form", 1, "张登记"},
		{1, "车辆检测清单_宝马530Li.pdf", "application/pdf", 89600, "vehicle_checklist", 1, "张登记"},
		{1, "检测报告_宝马530Li.pdf", "application/pdf", 153600, "inspection_report", 2, "李主管"},
		{1, "维修报价单_宝马530Li.pdf", "application/pdf", 76800, "repair_quote", 2, "李主管"},
		{1, "配件确认单_宝马530Li.pdf", "application/pdf", 64000, "parts_confirmation", 2, "李主管"},
		{2, "工单登记表_奔驰E300.pdf", "application/pdf", 98000, "registration_form", 1, "张登记"},
		{2, "车辆检测清单_奔驰E300.pdf", "application/pdf", 87000, "vehicle_checklist", 1, "张登记"},
		{3, "工单登记表_奥迪A6L.pdf", "application/pdf", 112000, "registration_form", 1, "张登记"},
		{4, "工单登记表_丰田凯美瑞.pdf", "application/pdf", 95000, "registration_form", 1, "张登记"},
	}

	for _, a := range attachments {
		_, err := tx.Exec(`
			INSERT INTO attachments (work_order_id, file_name, file_type, file_size, file_path, uploaded_by, uploader, evidence_type)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, a.orderID, a.fileName, a.fileType, a.fileSize,
			fmt.Sprintf("seed/order_%d/%s", a.orderID, a.fileName),
			a.uploadedBy, a.uploader, a.evidenceType)
		if err != nil {
			return err
		}
	}

	return nil
}

func int64Ptr(i int64) *int64 { return &i }
func stringPtr(s string) *string { return &s }

func calculateWarningLevel(expected time.Time) models.WarningLevel {
	days := time.Until(expected).Hours() / 24
	if days < 0 {
		return models.WarningOverdue
	}
	if days <= 1 {
		return models.WarningNearDue
	}
	return models.WarningNormal
}

func isOverdue(expected time.Time) int {
	if time.Until(expected) < 0 {
		return 1
	}
	return 0
}

func UpdateWarningLevels() error {
	_, err := DB.Exec(`
		UPDATE work_orders SET
			warning_level = CASE
				WHEN julianday(expected_complete_at) - julianday('now') < 0 THEN 'overdue'
				WHEN julianday(expected_complete_at) - julianday('now') <= 1 THEN 'near_due'
				ELSE 'normal'
			END,
			is_overdue = CASE WHEN julianday(expected_complete_at) - julianday('now') < 0 THEN 1 ELSE 0 END
		WHERE status NOT IN ('completed', 'rejected')
	`)
	return err
}
