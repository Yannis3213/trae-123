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
			"张三-研发部-入职办理-待提交",
			"张三", "高级工程师", "研发部",
			models.StatusPending, models.NodeDocs, models.RoleRegistrar,
			"", "",
			regID, "张登记",
			now.AddDate(0, 0, 15),
			models.WarningNormal, false, "",
			1,
		},
		{
			uuid.New().String(),
			"李四-市场部-合同签署-临期",
			"李四", "市场经理", "市场部",
			models.StatusProcessing, models.NodeContract, models.RoleAuditor,
			audID, "李审核",
			reg2ID, "赵登记",
			now.AddDate(0, 0, 2),
			models.WarningNear, false, "",
			2,
		},
		{
			uuid.New().String(),
			"王五-财务部-账号开通-逾期",
			"王五", "财务主管", "财务部",
			models.StatusProcessing, models.NodeAccount, models.RoleReviewer,
			revID, "王复核",
			regID, "张登记",
			now.AddDate(0, 0, -3),
			models.WarningOverdue, true, "合同签署逾期3天，影响入职办理",
			3,
		},
		{
			uuid.New().String(),
			"赵六-人事部-退回补正-缺材料",
			"赵六", "人事专员", "人事部",
			models.StatusReturned, models.NodeDocs, models.RoleRegistrar,
			reg2ID, "赵登记",
			reg2ID, "赵登记",
			now.AddDate(0, 0, 7),
			models.WarningNormal, false, "缺少离职证明和学历证书，退回补正",
			2,
		},
		{
			uuid.New().String(),
			"孙七-运维部-已完成",
			"孙七", "运维工程师", "运维部",
			models.StatusCompleted, models.NodeAccount, models.RoleReviewer,
			revID, "王复核",
			regID, "张登记",
			now.AddDate(0, 0, 20),
			models.WarningNormal, false, "",
			5,
		},
		{
			uuid.New().String(),
			"周八-法务部-已关闭",
			"周八", "法务顾问", "法务部",
			models.StatusClosed, models.NodeContract, models.RoleReviewer,
			revID, "王复核",
			reg2ID, "赵登记",
			now.AddDate(0, 0, -10),
			models.WarningOverdue, true, "候选人放弃入职，手动关闭",
			4,
		},
		{
			uuid.New().String(),
			"吴九-产品部-待派发合同审核",
			"吴九", "产品经理", "产品部",
			models.StatusProcessing, models.NodeContract, models.RoleAuditor,
			"", "",
			regID, "张登记",
			now.AddDate(0, 0, 5),
			models.WarningNormal, false, "",
			2,
		},
		{
			uuid.New().String(),
			"郑十-设计部-账号开通-待认领",
			"郑十", "UI设计师", "设计部",
			models.StatusProcessing, models.NodeAccount, models.RoleReviewer,
			"", "",
			reg2ID, "赵登记",
			now.AddDate(0, 0, 1),
			models.WarningNear, false, "",
			3,
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

func getOrderIDByTitle(tx *sql.Tx, title string) string {
	var id string
	tx.QueryRow("SELECT id FROM onboarding_orders WHERE title = ?", title).Scan(&id)
	return id
}

func seedAttachments(tx *sql.Tx) error {
	regID := getUserIDByName(tx, "张登记")
	reg2ID := getUserIDByName(tx, "赵登记")

	o1 := getOrderIDByTitle(tx, "张三-研发部-入职办理-待提交")
	o2 := getOrderIDByTitle(tx, "李四-市场部-合同签署-临期")
	o3 := getOrderIDByTitle(tx, "王五-财务部-账号开通-逾期")
	o4 := getOrderIDByTitle(tx, "赵六-人事部-退回补正-缺材料")
	o5 := getOrderIDByTitle(tx, "孙七-运维部-已完成")
	o7 := getOrderIDByTitle(tx, "吴九-产品部-待派发合同审核")
	o8 := getOrderIDByTitle(tx, "郑十-设计部-账号开通-待认领")

	attachments := []struct {
		orderID    string
		node       string
		typ        string
		name       string
		url        string
		uploadedBy string
	}{
		{o1, models.NodeDocs, "id_card", "身份证.pdf", "/uploads/o1/id_card.pdf", regID},
		{o1, models.NodeDocs, "diploma", "学历证书.pdf", "/uploads/o1/diploma.pdf", regID},
		{o1, models.NodeDocs, "resignation_cert", "离职证明.pdf", "/uploads/o1/resignation.pdf", regID},

		{o2, models.NodeDocs, "id_card", "身份证.pdf", "/uploads/o2/id_card.pdf", reg2ID},
		{o2, models.NodeDocs, "diploma", "学历证书.pdf", "/uploads/o2/diploma.pdf", reg2ID},
		{o2, models.NodeDocs, "resignation_cert", "离职证明.pdf", "/uploads/o2/resignation.pdf", reg2ID},
		{o2, models.NodeContract, "offer", "Offer Letter.pdf", "/uploads/o2/offer.pdf", reg2ID},

		{o3, models.NodeDocs, "id_card", "身份证.pdf", "/uploads/o3/id_card.pdf", regID},
		{o3, models.NodeDocs, "diploma", "学历证书.pdf", "/uploads/o3/diploma.pdf", regID},
		{o3, models.NodeDocs, "resignation_cert", "离职证明.pdf", "/uploads/o3/resignation.pdf", regID},
		{o3, models.NodeContract, "offer", "Offer Letter.pdf", "/uploads/o3/offer.pdf", regID},
		{o3, models.NodeContract, "contract", "劳动合同.pdf", "/uploads/o3/contract.pdf", regID},

		{o4, models.NodeDocs, "id_card", "身份证.pdf", "/uploads/o4/id_card.pdf", reg2ID},

		{o5, models.NodeDocs, "id_card", "身份证.pdf", "/uploads/o5/id_card.pdf", regID},
		{o5, models.NodeDocs, "diploma", "学历证书.pdf", "/uploads/o5/diploma.pdf", regID},
		{o5, models.NodeDocs, "resignation_cert", "离职证明.pdf", "/uploads/o5/resignation.pdf", regID},
		{o5, models.NodeContract, "offer", "Offer Letter.pdf", "/uploads/o5/offer.pdf", regID},
		{o5, models.NodeContract, "contract", "劳动合同.pdf", "/uploads/o5/contract.pdf", regID},
		{o5, models.NodeAccount, "system_access", "系统权限开通单.pdf", "/uploads/o5/system_access.pdf", regID},
		{o5, models.NodeAccount, "email_account", "邮箱账号开通单.pdf", "/uploads/o5/email.pdf", regID},

		{o7, models.NodeDocs, "id_card", "身份证.pdf", "/uploads/o7/id_card.pdf", regID},
		{o7, models.NodeDocs, "diploma", "学历证书.pdf", "/uploads/o7/diploma.pdf", regID},
		{o7, models.NodeDocs, "resignation_cert", "离职证明.pdf", "/uploads/o7/resignation.pdf", regID},

		{o8, models.NodeDocs, "id_card", "身份证.pdf", "/uploads/o8/id_card.pdf", reg2ID},
		{o8, models.NodeDocs, "diploma", "学历证书.pdf", "/uploads/o8/diploma.pdf", reg2ID},
		{o8, models.NodeDocs, "resignation_cert", "离职证明.pdf", "/uploads/o8/resignation.pdf", reg2ID},
		{o8, models.NodeContract, "offer", "Offer Letter.pdf", "/uploads/o8/offer.pdf", reg2ID},
		{o8, models.NodeContract, "contract", "劳动合同.pdf", "/uploads/o8/contract.pdf", reg2ID},
	}

	for _, a := range attachments {
		_, err := tx.Exec(
			"INSERT INTO attachments (id, order_id, node, type, name, url, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			uuid.New().String(), a.orderID, a.node, a.typ, a.name, a.url, a.uploadedBy, time.Now(),
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
	revID := getUserIDByName(tx, "王复核")
	reg2ID := getUserIDByName(tx, "赵登记")

	o1 := getOrderIDByTitle(tx, "张三-研发部-入职办理-待提交")
	o2 := getOrderIDByTitle(tx, "李四-市场部-合同签署-临期")
	o3 := getOrderIDByTitle(tx, "王五-财务部-账号开通-逾期")
	o4 := getOrderIDByTitle(tx, "赵六-人事部-退回补正-缺材料")
	o5 := getOrderIDByTitle(tx, "孙七-运维部-已完成")
	o6 := getOrderIDByTitle(tx, "周八-法务部-已关闭")
	o7 := getOrderIDByTitle(tx, "吴九-产品部-待派发合同审核")
	o8 := getOrderIDByTitle(tx, "郑十-设计部-账号开通-待认领")

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
		{o1, models.NodeDocs, "create", regID, "张登记", models.RoleRegistrar,
			"", models.StatusPending, "", models.NodeDocs,
			"登记员发起入职办理单", ""},

		{o2, models.NodeDocs, "create", reg2ID, "赵登记", models.RoleRegistrar,
			"", models.StatusPending, "", models.NodeDocs,
			"登记员发起入职办理单", ""},
		{o2, models.NodeDocs, "submit", reg2ID, "赵登记", models.RoleRegistrar,
			models.StatusPending, models.StatusProcessing, models.NodeDocs, models.NodeContract,
			"资料齐全，提交合同审核", ""},
		{o2, models.NodeContract, "claim", audID, "李审核", models.RoleAuditor,
			models.StatusProcessing, models.StatusProcessing, models.NodeContract, models.NodeContract,
			"审核主管认领", ""},

		{o3, models.NodeDocs, "create", regID, "张登记", models.RoleRegistrar,
			"", models.StatusPending, "", models.NodeDocs,
			"登记员发起入职办理单", ""},
		{o3, models.NodeDocs, "submit", regID, "张登记", models.RoleRegistrar,
			models.StatusPending, models.StatusProcessing, models.NodeDocs, models.NodeContract,
			"资料提交", ""},
		{o3, models.NodeContract, "claim", audID, "李审核", models.RoleAuditor,
			models.StatusProcessing, models.StatusProcessing, models.NodeContract, models.NodeContract,
			"审核主管认领", ""},
		{o3, models.NodeContract, "approve", audID, "李审核", models.RoleAuditor,
			models.StatusProcessing, models.StatusProcessing, models.NodeContract, models.NodeAccount,
			"合同审核通过，已逾期", "contract_overdue"},
		{o3, models.NodeAccount, "claim", revID, "王复核", models.RoleReviewer,
			models.StatusProcessing, models.StatusProcessing, models.NodeAccount, models.NodeAccount,
			"复核负责人认领", "overdue"},

		{o4, models.NodeDocs, "create", reg2ID, "赵登记", models.RoleRegistrar,
			"", models.StatusPending, "", models.NodeDocs,
			"登记员发起入职办理单", ""},
		{o4, models.NodeDocs, "submit", reg2ID, "赵登记", models.RoleRegistrar,
			models.StatusPending, models.StatusProcessing, models.NodeDocs, models.NodeDocs,
			"初次提交（资料不全，仅上传身份证）", ""},
		{o4, models.NodeDocs, "return", audID, "李审核", models.RoleAuditor,
			models.StatusProcessing, models.StatusReturned, models.NodeDocs, models.NodeDocs,
			"缺少学历证书和离职证明，退回补正", "missing_documents"},

		{o5, models.NodeDocs, "create", regID, "张登记", models.RoleRegistrar,
			"", models.StatusPending, "", models.NodeDocs,
			"登记员发起入职办理单", ""},
		{o5, models.NodeDocs, "submit", regID, "张登记", models.RoleRegistrar,
			models.StatusPending, models.StatusProcessing, models.NodeDocs, models.NodeContract,
			"资料齐全，提交审核", ""},
		{o5, models.NodeContract, "claim", audID, "李审核", models.RoleAuditor,
			models.StatusProcessing, models.StatusProcessing, models.NodeContract, models.NodeContract,
			"审核主管认领", ""},
		{o5, models.NodeContract, "approve", audID, "李审核", models.RoleAuditor,
			models.StatusProcessing, models.StatusProcessing, models.NodeContract, models.NodeAccount,
			"合同审核通过", ""},
		{o5, models.NodeAccount, "claim", revID, "王复核", models.RoleReviewer,
			models.StatusProcessing, models.StatusProcessing, models.NodeAccount, models.NodeAccount,
			"复核负责人认领", ""},
		{o5, models.NodeAccount, "approve", revID, "王复核", models.RoleReviewer,
			models.StatusProcessing, models.StatusCompleted, models.NodeAccount, models.NodeAccount,
			"全部节点通过，完成归档", ""},

		{o6, models.NodeDocs, "create", reg2ID, "赵登记", models.RoleRegistrar,
			"", models.StatusPending, "", models.NodeDocs,
			"登记员发起入职办理单", ""},
		{o6, models.NodeDocs, "submit", reg2ID, "赵登记", models.RoleRegistrar,
			models.StatusPending, models.StatusProcessing, models.NodeDocs, models.NodeContract,
			"资料提交", ""},
		{o6, models.NodeContract, "claim", audID, "李审核", models.RoleAuditor,
			models.StatusProcessing, models.StatusProcessing, models.NodeContract, models.NodeContract,
			"审核主管认领", ""},
		{o6, models.NodeContract, "close", revID, "王复核", models.RoleReviewer,
			models.StatusProcessing, models.StatusClosed, models.NodeContract, models.NodeContract,
			"候选人放弃入职，手动关闭", "candidate_withdraw"},

		{o7, models.NodeDocs, "create", regID, "张登记", models.RoleRegistrar,
			"", models.StatusPending, "", models.NodeDocs,
			"登记员发起入职办理单", ""},
		{o7, models.NodeDocs, "submit", regID, "张登记", models.RoleRegistrar,
			models.StatusPending, models.StatusProcessing, models.NodeDocs, models.NodeContract,
			"资料齐全，提交合同审核", ""},

		{o8, models.NodeDocs, "create", reg2ID, "赵登记", models.RoleRegistrar,
			"", models.StatusPending, "", models.NodeDocs,
			"登记员发起入职办理单", ""},
		{o8, models.NodeDocs, "submit", reg2ID, "赵登记", models.RoleRegistrar,
			models.StatusPending, models.StatusProcessing, models.NodeDocs, models.NodeContract,
			"资料提交", ""},
		{o8, models.NodeContract, "claim", audID, "李审核", models.RoleAuditor,
			models.StatusProcessing, models.StatusProcessing, models.NodeContract, models.NodeContract,
			"审核主管认领", ""},
		{o8, models.NodeContract, "approve", audID, "李审核", models.RoleAuditor,
			models.StatusProcessing, models.StatusProcessing, models.NodeContract, models.NodeAccount,
			"合同审核通过", ""},
	}

	for _, r := range records {
		_, err := tx.Exec(`
			INSERT INTO process_records 
			(id, order_id, node, action, operator_id, operator_name, operator_role,
			 from_status, to_status, from_node, to_node, remark, exception_type, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			uuid.New().String(), r.orderID, r.node, r.action,
			r.opID, r.opName, r.opRole,
			r.fromStatus, r.toStatus, r.fromNode, r.toNode,
			r.remark, r.exceptionType, time.Now(),
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
	revID := getUserIDByName(tx, "王复核")

	o1 := getOrderIDByTitle(tx, "张三-研发部-入职办理-待提交")
	o3 := getOrderIDByTitle(tx, "王五-财务部-账号开通-逾期")
	o4 := getOrderIDByTitle(tx, "赵六-人事部-退回补正-缺材料")
	o5 := getOrderIDByTitle(tx, "孙七-运维部-已完成")
	o6 := getOrderIDByTitle(tx, "周八-法务部-已关闭")

	notes := []struct {
		orderID     string
		statusLabel string
		content     string
		createdBy   string
		byName      string
	}{
		{o1, "待派发", "登记员张登记发起入职办理单，等待提交", regID, "张登记"},
		{o4, "待派发", "登记员赵登记初次提交入职资料", reg2ID, "赵登记"},
		{o4, "处理中", "李审核已接手审核，发现缺离职证明和学历证书", audID, "李审核"},
		{o4, "处理中", "退回补正，需登记员补充学历证书和离职证明后重新提交", audID, "李审核"},
		{o3, "处理中", "合同签署已逾期3天，已通知HRBP负责人跟进，合同逾期影响入职", audID, "李审核"},
		{o3, "处理中", "复核负责人王复核已认领，正在处理账号开通，需注意逾期异常", revID, "王复核"},
		{o5, "处理中", "合同审核通过，流转至账号开通节点", audID, "李审核"},
		{o5, "已关闭", "三节点全部通过，已完成入职办理归档", revID, "王复核"},
		{o6, "处理中", "候选人来电表示放弃入职，申请关闭单据", audID, "李审核"},
		{o6, "已关闭", "复核确认，手动关闭单据，标注候选人放弃入职", revID, "王复核"},
	}

	for _, n := range notes {
		_, err := tx.Exec(
			"INSERT INTO audit_notes (id, order_id, status_label, content, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
			uuid.New().String(), n.orderID, n.statusLabel, n.content, n.createdBy, n.byName, time.Now(),
		)
		if err != nil {
			return err
		}
	}
	return nil
}
