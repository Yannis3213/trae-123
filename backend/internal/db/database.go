package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() error {
	dbPath := filepath.Join("backend", "data", "prescription_flow.db")
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return err
	}

	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_fk=1&_journal=WAL")
	if err != nil {
		return err
	}

	if err = createTables(); err != nil {
		return err
	}

	if err = seedData(); err != nil {
		log.Printf("Seed data warning: %v", err)
	}

	return nil
}

func createTables() error {
	sqlStatements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			role TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS prescription_flows (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			flow_no TEXT UNIQUE NOT NULL,
			patient_name TEXT NOT NULL,
			prescription_info TEXT,
			decoction_info TEXT,
			delivery_info TEXT,
			status TEXT NOT NULL DEFAULT 'draft',
			urgency TEXT NOT NULL DEFAULT 'normal',
			current_handler TEXT,
			current_role TEXT,
			version INTEGER NOT NULL DEFAULT 1,
			created_by TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			due_at DATETIME NOT NULL,
			abnormal_reason TEXT,
			return_reason TEXT,
			is_material_complete INTEGER NOT NULL DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS attachments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			flow_id INTEGER NOT NULL,
			type TEXT NOT NULL,
			name TEXT NOT NULL,
			url TEXT NOT NULL,
			uploaded_by TEXT NOT NULL,
			uploaded_at DATETIME NOT NULL,
			FOREIGN KEY (flow_id) REFERENCES prescription_flows(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS process_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			flow_id INTEGER NOT NULL,
			action TEXT NOT NULL,
			operator TEXT NOT NULL,
			operator_role TEXT NOT NULL,
			from_status TEXT,
			to_status TEXT,
			remark TEXT,
			evidence TEXT,
			created_at DATETIME NOT NULL,
			FOREIGN KEY (flow_id) REFERENCES prescription_flows(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS audit_notes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			flow_id INTEGER NOT NULL,
			note TEXT NOT NULL,
			operator TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			FOREIGN KEY (flow_id) REFERENCES prescription_flows(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS abnormal_reasons (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			flow_id INTEGER NOT NULL,
			reason TEXT NOT NULL,
			type TEXT NOT NULL,
			operator TEXT NOT NULL,
			responsible_person TEXT NOT NULL DEFAULT '',
			attempt_count INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			FOREIGN KEY (flow_id) REFERENCES prescription_flows(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_flows_status ON prescription_flows(status)`,
		`CREATE INDEX IF NOT EXISTS idx_flows_urgency ON prescription_flows(urgency)`,
		`CREATE INDEX IF NOT EXISTS idx_flows_handler ON prescription_flows(current_handler)`,
		`CREATE INDEX IF NOT EXISTS idx_records_flow ON process_records(flow_id)`,
	}

	for _, stmt := range sqlStatements {
		if _, err := DB.Exec(stmt); err != nil {
			return err
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

	users := []struct {
		Username string
		Name     string
		Role     string
	}{
		{"registrar01", "张登记", "registrar"},
		{"supervisor01", "李审核", "review_supervisor"},
		{"archivist01", "王复核", "archivist"},
		{"assistant01", "赵助理", "assistant"},
		{"physician01", "钱医师", "physician"},
		{"pharmacist01", "孙药房", "pharmacist"},
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, u := range users {
		_, err := tx.Exec(
			"INSERT INTO users (username, name, role) VALUES (?, ?, ?)",
			u.Username, u.Name, u.Role,
		)
		if err != nil {
			return err
		}
	}

	now := time.Now()
	flows := []struct {
		flowNo           string
		patientName      string
		prescriptionInfo string
		decoctionInfo    string
		deliveryInfo     string
		status           string
		urgency          string
		currentHandler   string
		currentRole      string
		createdBy        string
		dueAt            time.Time
		materialComplete bool
	}{
		{
			"PF20260601001", "张三", "感冒方：麻黄、桂枝、杏仁、甘草各10g", "煎药：水煎服，一日一剂", "配送：快递到付，地址北京市朝阳区",
			"to_confirm", "normal", "supervisor01", "review_supervisor", "registrar01",
			now.Add(24 * time.Hour), true,
		},
		{
			"PF20260601002", "李四", "调理方：人参、黄芪、白术各15g", "", "",
			"draft", "warning", "registrar01", "registrar", "registrar01",
			now.Add(4 * time.Hour), false,
		},
		{
			"PF20260601003", "王五", "止咳方：川贝、枇杷叶、桔梗各10g", "代煎服务，每日2次", "自取",
			"recheck", "normal", "archivist01", "archivist", "registrar01",
			now.Add(48 * time.Hour), true,
		},
		{
			"PF20260601004", "赵六", "退热方：柴胡、黄芩、葛根各12g", "", "同城速递，地址上海市浦东新区",
			"returned", "overdue", "registrar01", "registrar", "registrar01",
			now.Add(-2 * time.Hour), false,
		},
	}

	for _, f := range flows {
		abnormalReason := ""
		if !f.materialComplete {
			abnormalReason = "处方开具、煎药配送信息不齐全"
		} else if f.urgency == "overdue" {
			abnormalReason = "处理超时"
		}
		returnReason := ""
		if f.status == "returned" {
			returnReason = "处方信息不完整，请补正"
		}

		result, err := tx.Exec(
			`INSERT INTO prescription_flows 
			(flow_no, patient_name, prescription_info, decoction_info, delivery_info, 
			 status, urgency, current_handler, current_role, created_by, 
			 created_at, updated_at, due_at, is_material_complete, abnormal_reason, return_reason)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			f.flowNo, f.patientName, f.prescriptionInfo, f.decoctionInfo, f.deliveryInfo,
			f.status, f.urgency, f.currentHandler, f.currentRole, f.createdBy,
			now, now, f.dueAt,
			map[bool]int{true: 1, false: 0}[f.materialComplete],
			abnormalReason, returnReason,
		)
		if err != nil {
			return err
		}

		flowID, _ := result.LastInsertId()

		actions := []struct {
			action       string
			operator     string
			operatorRole string
			fromStatus   string
			toStatus     string
			remark       string
			evidence     string
		}{
			{"create", "registrar01", "registrar", "", "draft", "创建处方流转单", "登记发起"},
		}
		if f.status != "draft" {
			actions = append(actions, struct {
				action       string
				operator     string
				operatorRole string
				fromStatus   string
				toStatus     string
				remark       string
				evidence     string
			}{"submit", "registrar01", "registrar", "draft", "to_confirm", "提交审核", "提交凭证"})
		}

		for _, a := range actions {
			_, err := tx.Exec(
				`INSERT INTO process_records 
				(flow_id, action, operator, operator_role, from_status, to_status, remark, evidence, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				flowID, a.action, a.operator, a.operatorRole, a.fromStatus, a.toStatus, a.remark, a.evidence, now,
			)
			if err != nil {
				return err
			}
		}

		for _, a := range actions {
			fromStatusDisplay := a.fromStatus
			if fromStatusDisplay == "" {
				fromStatusDisplay = "无"
			}
			note := fmt.Sprintf(
				"操作人[%s(%s)]执行动作[%s]，状态从[%s]流转至[%s]，备注：%s，证据：%s",
				a.operator, a.operatorRole, a.action,
				fromStatusDisplay, a.toStatus, a.remark, a.evidence,
			)
			_, err := tx.Exec(
				`INSERT INTO audit_notes (flow_id, note, operator, created_at) VALUES (?, ?, ?, ?)`,
				flowID, note, a.operator, now,
			)
			if err != nil {
				return err
			}
		}

		if !f.materialComplete {
			_, err := tx.Exec(
				`INSERT INTO abnormal_reasons (flow_id, reason, type, operator, responsible_person, attempt_count, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
				flowID, "处方开具、煎药配送信息不齐全，停留原队列", "material_missing", "registrar01", f.currentHandler, now,
			)
			if err != nil {
				return err
			}
			note2 := fmt.Sprintf(
				"系统自动标记异常：处方开具、煎药配送信息不齐全，流转单停留在原队列，操作人[%s]，责任人[%s]",
				"registrar01", f.currentHandler,
			)
			_, err = tx.Exec(
				`INSERT INTO audit_notes (flow_id, note, operator, created_at) VALUES (?, ?, ?, ?)`,
				flowID, note2, f.currentHandler, now,
			)
			if err != nil {
				return err
			}
		}

		if f.status == "returned" {
			_, err := tx.Exec(
				`INSERT INTO abnormal_reasons (flow_id, reason, type, operator, responsible_person, attempt_count, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
				flowID, "处方信息不完整，请补正", "returned", "supervisor01", f.currentHandler, now,
			)
			if err != nil {
				return err
			}
			note3 := fmt.Sprintf(
				"操作人[supervisor01(review_supervisor)]执行动作[退回补正]，状态从[to_confirm]流转至[returned]，原因：处方信息不完整，请补正，责任人[%s]",
				f.currentHandler,
			)
			_, err = tx.Exec(
				`INSERT INTO audit_notes (flow_id, note, operator, created_at) VALUES (?, ?, ?, ?)`,
				flowID, note3, "supervisor01", now,
			)
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func GetDB() *sql.DB {
	return DB
}
