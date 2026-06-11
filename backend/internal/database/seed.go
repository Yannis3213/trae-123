package database

import (
	"database/sql"
	"log"
	"time"

	"hr-onboarding/internal/models"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func Seed() error {
	count := 0
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		log.Println("Seed data already exists, skipping")
		return nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err = seedUsers(tx); err != nil {
		return err
	}
	if err = seedOrders(tx); err != nil {
		return err
	}
	if err = seedAttachments(tx); err != nil {
		return err
	}
	if err = seedProcessRecords(tx); err != nil {
		return err
	}
	if err = seedAuditNotes(tx); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	log.Println("Seed data inserted successfully")
	return nil
}

func hashPassword(password string) string {
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash)
}

func seedUsers(tx *sql.Tx) error {
	users := []struct {
		username string
		name     string
		role     string
		password string
	}{
		{"registrar1", "张登记", models.RoleRegistrar, "123456"},
		{"auditor1", "李审核", models.RoleAuditor, "123456"},
		{"reviewer1", "王复核", models.RoleReviewer, "123456"},
		{"registrar2", "赵登记", models.RoleRegistrar, "123456"},
	}

	for _, u := range users {
		_, err := tx.Exec(
			"INSERT INTO users (id, username, name, role, password) VALUES (?, ?, ?, ?, ?)",
			uuid.New().String(), u.username, u.name, u.role, hashPassword(u.password),
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func getUserIDByName(tx *sql.Tx, name string) string {
	var id string
	tx.QueryRow("SELECT id FROM users WHERE name = ?", name).Scan(&id)
	return id
}

func seedOrders(tx *sql.Tx) error {
	regID := getUserIDByName(tx, "张登记")
	audID := getUserIDByName(tx, "李审核")
	revID := getUserIDByName(tx, "王复核")
	reg2ID := getUserIDByName(tx, "赵登记")

	now := time.Now()

	orders := []struct {
		id              string
		title           string
		candidateName   string
		position        string
		department      string
		status          string
		currentNode     string
		currentRole     string
		handlerID       string
		handlerName     string
		registrarID     string
		registrarName   string
		dueDate         time.Time
		warningLevel    string
		isException     bool
		exceptionReason string
		version         int
	}{
		{
			uuid.New().String(),
			"张三-研发部-入职办理",
			"张三",
			"高级工程师",
			"研发部",
			models.StatusPending,
			models.NodeDocs,
			models.RoleRegistrar,
			"", "",
			regID, "张登记",
			now.AddDate(0, 0, 15),
			models.WarningNormal,
			false, "",
			1,
		},
		{
			uuid.New().String(),
			"李四-市场部-合同签署",
			"李四",
			"市场经理",
			"市场部",
			models.StatusProcessing,
			models.NodeContract,
			models.RoleAuditor,
			audID, "李审核",
			reg2ID, "赵登记",
			now.AddDate(0, 0, 2),
			models.WarningNear,
			false, "",
			2,
		},
		{
			uuid.New().String(),
			"王五-财务部-账号开通-逾期",
			"王五",
			"财务主管",
			"财务部",
			models.StatusProcessing,
			models.NodeAccount,
			models.RoleReviewer,
			revID, "王复核",
			regID, "张登记",
			now.AddDate(0, 0, -3),
			models.WarningOverdue,
			true,
			"合同签署逾期3天，影响入职办理",
			3,
		},
		{
			uuid.New().String(),
			"赵六-人事部-退回补正",
			"赵六",
			"人事专员",
			"人事部",
			models.StatusReturned,
			models.NodeDocs,
			models.RoleRegistrar,
			regID, "张登记",
			reg2ID, "赵登记",
			now.AddDate(0, 0, 7),
			models.WarningNormal,
			false, "",
			2,
		},
	}

	for _, o := range orders {
		_, err := tx.Exec(`
			INSERT INTO onboarding_orders 
			(id, title, candidate_name, position, department, status, current_node, 
			 current_role, handler_id, handler_name, registrar_id, registrar_name, 
			 due_date, warning_level, version, is_exception, exception_reason,
			 created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			o.id, o.title, o.candidateName, o.position, o.department,
			o.status, o.currentNode, o.currentRole,
			o.handlerID, o.handlerName,
			o.registrarID, o.registrarName,
			o.dueDate, o.warningLevel, o.version,
			o.isException, o.exceptionReason,
			now, now,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func seedAttachments(tx *sql.Tx) error {
	var orders []struct {
		id   string
		node string
	}
	rows, err := tx.Query("SELECT id, current_node FROM onboarding_orders")
	if err != nil {
		return err
	}
	for rows.Next() {
		var o struct{ id, node string }
		rows.Scan(&o.id, &o.node)
		orders = append(orders, o)
	}
	rows.Close()

	regID := getUserIDByName(tx, "张登记")

	attachments := []struct {
		orderID string
		node    string
		typ     string
		name    string
		url     string
	}{
		{orders[0].id, models.NodeDocs, "id_card", "身份证.pdf", "/uploads/id_card_1.pdf"},
		{orders[0].id, models.NodeDocs, "diploma", "学历证书.pdf", "/uploads/diploma_1.pdf"},
		{orders[1].id, models.NodeDocs, "id_card", "身份证.pdf", "/uploads/id_card_2.pdf"},
		{orders[1].id, models.NodeContract, "offer", "Offer Letter.pdf", "/uploads/offer_2.pdf"},
		{orders[2].id, models.NodeDocs, "id_card", "身份证.pdf", "/uploads/id_card_3.pdf"},
		{orders[2].id, models.NodeContract, "contract", "劳动合同.pdf", "/uploads/contract_3.pdf"},
		{orders[3].id, models.NodeDocs, "id_card", "身份证.pdf", "/uploads/id_card_4.pdf"},
	}

	for _, a := range attachments {
		_, err := tx.Exec(
			"INSERT INTO attachments (id, order_id, node, type, name, url, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
			uuid.New().String(), a.orderID, a.node, a.typ, a.name, a.url, regID,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func seedProcessRecords(tx *sql.Tx) error {
	regID := getUserIDByName(tx, "张登记")
	audID := getUserIDByName(tx, "李审核")

	var order2ID, order3ID, order4ID string
	tx.QueryRow("SELECT id FROM onboarding_orders WHERE title = '李四-市场部-合同签署'").Scan(&order2ID)
	tx.QueryRow("SELECT id FROM onboarding_orders WHERE title = '王五-财务部-账号开通-逾期'").Scan(&order3ID)
	tx.QueryRow("SELECT id FROM onboarding_orders WHERE title = '赵六-人事部-退回补正'").Scan(&order4ID)

	records := []struct {
		orderID       string
		node          string
		action        string
		opID          string
		opName        string
		opRole        string
		fromStatus    string
		toStatus      string
		fromNode      string
		toNode        string
		remark        string
		exceptionType string
	}{
		{order2ID, models.NodeDocs, "submit", regID, "张登记", models.RoleRegistrar,
			models.StatusPending, models.StatusProcessing, models.NodeDocs, models.NodeContract,
			"资料齐全，提交审核", ""},
		{order3ID, models.NodeDocs, "submit", regID, "张登记", models.RoleRegistrar,
			models.StatusPending, models.StatusProcessing, models.NodeDocs, models.NodeContract,
			"资料提交", ""},
		{order3ID, models.NodeContract, "approve", audID, "李审核", models.RoleAuditor,
			models.StatusProcessing, models.StatusProcessing, models.NodeContract, models.NodeAccount,
			"合同审核通过", "contract_overdue"},
		{order4ID, models.NodeDocs, "submit", regID, "张登记", models.RoleRegistrar,
			models.StatusPending, models.StatusProcessing, models.NodeDocs, models.NodeDocs,
			"初次提交", ""},
		{order4ID, models.NodeDocs, "return", audID, "李审核", models.RoleAuditor,
			models.StatusProcessing, models.StatusReturned, models.NodeDocs, models.NodeDocs,
			"缺少离职证明，需补正", "missing_document"},
	}

	for _, r := range records {
		_, err := tx.Exec(`
			INSERT INTO process_records 
			(id, order_id, node, action, operator_id, operator_name, operator_role,
			 from_status, to_status, from_node, to_node, remark, exception_type)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			uuid.New().String(), r.orderID, r.node, r.action,
			r.opID, r.opName, r.opRole,
			r.fromStatus, r.toStatus, r.fromNode, r.toNode,
			r.remark, r.exceptionType,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func seedAuditNotes(tx *sql.Tx) error {
	regID := getUserIDByName(tx, "张登记")
	audID := getUserIDByName(tx, "李审核")

	var order3ID, order4ID string
	tx.QueryRow("SELECT id FROM onboarding_orders WHERE title = '王五-财务部-账号开通-逾期'").Scan(&order3ID)
	tx.QueryRow("SELECT id FROM onboarding_orders WHERE title = '赵六-人事部-退回补正'").Scan(&order4ID)

	notes := []struct {
		orderID     string
		statusLabel string
		content     string
		createdBy   string
		byName      string
	}{
		{order4ID, "待派发", "登记员发起，等待审核主管派发", regID, "张登记"},
		{order4ID, "处理中", "审核主管已接手，审核中", audID, "李审核"},
		{order3ID, "处理中", "合同签署逾期，已通知HRBP跟进", audID, "李审核"},
		{order4ID, "已关闭", "退回补正，需登记员补充材料", audID, "李审核"},
	}

	for _, n := range notes {
		_, err := tx.Exec(
			"INSERT INTO audit_notes (id, order_id, status_label, content, created_by, created_by_name) VALUES (?, ?, ?, ?, ?, ?)",
			uuid.New().String(), n.orderID, n.statusLabel, n.content, n.createdBy, n.byName,
		)
		if err != nil {
			return err
		}
	}
	return nil
}
