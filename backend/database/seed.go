package database

import (
	"database/sql"
	"log"
	"time"
	"vocational-school/models"

	"github.com/google/uuid"
)

func Seed() error {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		log.Println("数据库已有数据，跳过 seed")
		return nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	users := []models.User{
		{ID: uuid.NewString(), Username: "registrar", Password: "123456", Name: "李登记员", Role: models.RoleRegistrar},
		{ID: uuid.NewString(), Username: "registrar2", Password: "123456", Name: "赵登记员(同角色非处理人)", Role: models.RoleRegistrar},
		{ID: uuid.NewString(), Username: "auditor", Password: "123456", Name: "王审核主管", Role: models.RoleAuditor},
		{ID: uuid.NewString(), Username: "auditor2", Password: "123456", Name: "刘审核主管(同角色非处理人)", Role: models.RoleAuditor},
		{ID: uuid.NewString(), Username: "reviewer", Password: "123456", Name: "张复核校长", Role: models.RoleReviewer},
	}

	var registrarID, registrar2ID, auditorID, auditor2ID, reviewerID string
	var registrarName, registrar2Name, auditorName, auditor2Name, reviewerName string
	for _, u := range users {
		switch u.Username {
		case "registrar":
			registrarID = u.ID
			registrarName = u.Name
		case "registrar2":
			registrar2ID = u.ID
			registrar2Name = u.Name
		case "auditor":
			auditorID = u.ID
			auditorName = u.Name
		case "auditor2":
			auditor2ID = u.ID
			auditor2Name = u.Name
		case "reviewer":
			reviewerID = u.ID
			reviewerName = u.Name
		}
	}

	userStmt, _ := tx.Prepare("INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)")
	defer userStmt.Close()
	for _, u := range users {
		if _, err := userStmt.Exec(u.ID, u.Username, u.Password, u.Name, string(u.Role)); err != nil {
			return err
		}
	}

	now := time.Now()
	applications := []struct {
		StudentName    string
		IdCard         string
		Phone          string
		Program        string
		Status         models.ApplicationStatus
		Handler        string
		HandlerName    string
		HandlerRole    models.Role
		NextHandler    string
		NextName       string
		NextRole       models.Role
		AssignDeadline time.Time
		AuditDeadline  time.Time
		ReviewDeadline time.Time
		Urgency        models.UrgencyLevel
		Responsible    string
		ResName        string
		MaterialsOK    bool
		ClassOK        bool
		PaymentOK      bool
		InitVersion    int
	}{
		{
			"赵正常", "110101199001011234", "13800138001", "数控技术",
			models.StatusPending, registrarID, registrarName, models.RoleRegistrar,
			auditorID, auditorName, models.RoleAuditor,
			now.AddDate(0, 0, 3), now.AddDate(0, 0, 5), now.AddDate(0, 0, 7),
			models.UrgencyNormal, registrarID, registrarName,
			true, true, true, 1,
		},
		{
			"钱材料", "110101199002022345", "13800138002", "电子商务",
			models.StatusPending, registrarID, registrarName, models.RoleRegistrar,
			auditorID, auditorName, models.RoleAuditor,
			now.AddDate(0, 0, 2), now.AddDate(0, 0, 4), now.AddDate(0, 0, 6),
			models.UrgencyWarning, registrarID, registrarName,
			false, true, true, 1,
		},
		{
			"孙逾期", "110101199003033456", "13800138003", "汽车维修",
			models.StatusTransferred, auditorID, auditorName, models.RoleAuditor,
			reviewerID, reviewerName, models.RoleReviewer,
			now.AddDate(0, 0, -3), now.AddDate(0, 0, -1), now.AddDate(0, 0, 2),
			models.UrgencyOverdue, auditorID, auditorName,
			true, true, true, 2,
		},
		{
			"周补正", "110101199004044567", "13800138004", "会计电算化",
			models.StatusPending, registrarID, registrarName, models.RoleRegistrar,
			auditorID, auditorName, models.RoleAuditor,
			now.AddDate(0, 0, 4), now.AddDate(0, 0, 6), now.AddDate(0, 0, 8),
			models.UrgencyNormal, registrarID, registrarName,
			true, false, false, 2,
		},
		{
			"吴非处理人", "110101199005055678", "13800138005", "机电一体化",
			models.StatusPending, registrarID, registrarName, models.RoleRegistrar,
			auditorID, auditorName, models.RoleAuditor,
			now.AddDate(0, 0, 5), now.AddDate(0, 0, 7), now.AddDate(0, 0, 9),
			models.UrgencyNormal, registrarID, registrarName,
			true, true, true, 1,
		},
		{
			"郑非处理人2", "110101199006066789", "13800138006", "计算机应用",
			models.StatusTransferred, auditorID, auditorName, models.RoleAuditor,
			reviewerID, reviewerName, models.RoleReviewer,
			now.AddDate(0, 0, 1), now.AddDate(0, 0, 3), now.AddDate(0, 0, 5),
			models.UrgencyNormal, auditorID, auditorName,
			true, true, true, 2,
		},
		{
			"王批量1", "110101199007077890", "13800138007", "数控技术(批量)",
			models.StatusPending, registrarID, registrarName, models.RoleRegistrar,
			auditorID, auditorName, models.RoleAuditor,
			now.AddDate(0, 0, 6), now.AddDate(0, 0, 8), now.AddDate(0, 0, 10),
			models.UrgencyNormal, registrarID, registrarName,
			true, true, true, 1,
		},
		{
			"王批量2", "110101199008088901", "13800138008", "电子商务(批量)",
			models.StatusPending, registrarID, registrarName, models.RoleRegistrar,
			auditorID, auditorName, models.RoleAuditor,
			now.AddDate(0, 0, 6), now.AddDate(0, 0, 8), now.AddDate(0, 0, 10),
			models.UrgencyWarning, registrarID, registrarName,
			true, true, true, 1,
		},
		{
			"王批量3", "110101199009099012", "13800138009", "汽车维修(批量)",
			models.StatusTransferred, auditorID, auditorName, models.RoleAuditor,
			reviewerID, reviewerName, models.RoleReviewer,
			now.AddDate(0, 0, 2), now.AddDate(0, 0, 4), now.AddDate(0, 0, 6),
			models.UrgencyNormal, auditorID, auditorName,
			true, true, true, 2,
		},
		{
			"王批量4(旧版本演示)", "110101199010100123", "13800138010", "机电一体化(批量旧版本)",
			models.StatusPending, registrarID, registrarName, models.RoleRegistrar,
			auditorID, auditorName, models.RoleAuditor,
			now.AddDate(0, 0, 7), now.AddDate(0, 0, 9), now.AddDate(0, 0, 11),
			models.UrgencyNormal, registrarID, registrarName,
			true, true, true, 3,
		},
		{
			"王批量5(旧版本演示)", "110101199011111234", "13800138011", "会计电算化(批量旧版本)",
			models.StatusTransferred, auditorID, auditorName, models.RoleAuditor,
			reviewerID, reviewerName, models.RoleReviewer,
			now.AddDate(0, 0, 3), now.AddDate(0, 0, 5), now.AddDate(0, 0, 7),
			models.UrgencyWarning, auditorID, auditorName,
			true, true, true, 4,
		},
	}

	appStmt, _ := tx.Prepare(`INSERT INTO student_applications 
		(id, student_name, id_card, phone, program, status, 
		 current_handler, current_handler_name, current_handler_role,
		 next_handler, next_handler_name, next_handler_role,
		 assignment_deadline, audit_deadline, review_deadline,
		 created_at, updated_at, version, urgency,
		 responsible_person, responsible_person_name,
		 materials_complete, class_assigned, payment_confirmed)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	defer appStmt.Close()

	appIDs := make([]string, 0)
	for _, a := range applications {
		id := uuid.NewString()
		appIDs = append(appIDs, id)
		if _, err := appStmt.Exec(
			id, a.StudentName, a.IdCard, a.Phone, a.Program, string(a.Status),
			a.Handler, a.HandlerName, string(a.HandlerRole),
			a.NextHandler, a.NextName, string(a.NextRole),
			a.AssignDeadline, a.AuditDeadline, a.ReviewDeadline,
			now, now, a.InitVersion, string(a.Urgency),
			a.Responsible, a.ResName,
			a.MaterialsOK, a.ClassOK, a.PaymentOK,
		); err != nil {
			return err
		}
	}

	attachStmt, _ := tx.Prepare(`INSERT INTO attachments 
		(id, application_id, type, name, uploaded_by, uploaded_at, verified)
		VALUES (?, ?, ?, ?, ?, ?, ?)`)
	defer attachStmt.Close()

	attachmentData := []struct {
		appIndex int
		types    []string
		verified []bool
	}{
		{0, []string{"身份证", "学历证明", "照片", "报名表"}, []bool{true, true, true, true}},
		{1, []string{"身份证", "照片"}, []bool{true, true}},
		{2, []string{"身份证", "学历证明", "照片", "报名表", "体检报告"}, []bool{true, true, true, true, true}},
		{3, []string{"身份证", "学历证明"}, []bool{true, true}},
		{4, []string{"身份证", "学历证明", "照片", "报名表"}, []bool{true, true, true, true}},
		{5, []string{"身份证", "学历证明", "照片", "报名表", "体检报告"}, []bool{true, true, true, true, true}},
		{6, []string{"身份证", "学历证明", "照片", "报名表"}, []bool{true, true, true, true}},
		{7, []string{"身份证", "学历证明", "照片", "报名表"}, []bool{true, true, true, true}},
		{8, []string{"身份证", "学历证明", "照片", "报名表", "体检报告"}, []bool{true, true, true, true, true}},
		{9, []string{"身份证", "学历证明", "照片", "报名表"}, []bool{true, true, true, true}},
		{10, []string{"身份证", "学历证明", "照片", "报名表", "体检报告"}, []bool{true, true, true, true, true}},
	}

	for _, ad := range attachmentData {
		for i, t := range ad.types {
			if _, err := attachStmt.Exec(
				uuid.NewString(), appIDs[ad.appIndex], t, t+".pdf",
				registrarID, now, ad.verified[i],
			); err != nil {
				return err
			}
		}
	}

	recordStmt, _ := tx.Prepare(`INSERT INTO processing_records 
		(id, application_id, action, handler_id, handler_name, handler_role,
		 previous_status, new_status, previous_handler, new_handler,
		 remark, created_at, version, is_correction)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	defer recordStmt.Close()

	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[0], "create", registrarID, registrarName, string(models.RoleRegistrar),
		"", string(models.StatusPending), "", registrarID,
		"学员报名单创建，资料齐全", now, 1, false,
	); err != nil {
		return err
	}

	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[1], "create", registrarID, registrarName, string(models.RoleRegistrar),
		"", string(models.StatusPending), "", registrarID,
		"创建报名单，缺少学历证明材料", now, 1, false,
	); err != nil {
		return err
	}

	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[2], "create", registrarID, registrarName, string(models.RoleRegistrar),
		"", string(models.StatusPending), "", registrarID,
		"创建报名单", now.AddDate(0, 0, -5), 1, false,
	); err != nil {
		return err
	}
	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[2], "assign", registrarID, registrarName, string(models.RoleRegistrar),
		string(models.StatusPending), string(models.StatusTransferred), registrarID, auditorID,
		"资料审核通过，已分派至审核主管", now.AddDate(0, 0, -4), 2, false,
	); err != nil {
		return err
	}

	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[3], "create", registrarID, registrarName, string(models.RoleRegistrar),
		"", string(models.StatusPending), "", registrarID,
		"创建报名单", now.AddDate(0, 0, -2), 1, false,
	); err != nil {
		return err
	}
	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[3], "correct_reject", auditorID, auditorName, string(models.RoleAuditor),
		string(models.StatusTransferred), string(models.StatusPending), auditorID, registrarID,
		"退回补正：班级未分配，缴费未确认", now.AddDate(0, 0, -1), 2, true,
	); err != nil {
		return err
	}

	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[4], "create", registrarID, registrarName, string(models.RoleRegistrar),
		"", string(models.StatusPending), "", registrarID,
		"创建报名单：同角色非处理人场景演示（当前处理人李登记员）", now, 1, false,
	); err != nil {
		return err
	}

	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[5], "create", registrarID, registrarName, string(models.RoleRegistrar),
		"", string(models.StatusPending), "", registrarID,
		"创建报名单", now.AddDate(0, 0, -4), 1, false,
	); err != nil {
		return err
	}
	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[5], "assign", registrarID, registrarName, string(models.RoleRegistrar),
		string(models.StatusPending), string(models.StatusTransferred), registrarID, auditorID,
		"分派至审核主管：同角色非处理人场景（当前处理人王审核主管）", now.AddDate(0, 0, -3), 2, false,
	); err != nil {
		return err
	}

	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[6], "create", registrarID, registrarName, string(models.RoleRegistrar),
		"", string(models.StatusPending), "", registrarID,
		"批量场景1：创建报名单", now, 1, false,
	); err != nil {
		return err
	}

	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[7], "create", registrarID, registrarName, string(models.RoleRegistrar),
		"", string(models.StatusPending), "", registrarID,
		"批量场景2：创建报名单", now, 1, false,
	); err != nil {
		return err
	}

	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[8], "create", registrarID, registrarName, string(models.RoleRegistrar),
		"", string(models.StatusPending), "", registrarID,
		"批量场景3：创建报名单", now.AddDate(0, 0, -5), 1, false,
	); err != nil {
		return err
	}
	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[8], "assign", registrarID, registrarName, string(models.RoleRegistrar),
		string(models.StatusPending), string(models.StatusTransferred), registrarID, auditorID,
		"批量场景3：分派至审核主管", now.AddDate(0, 0, -4), 2, false,
	); err != nil {
		return err
	}

	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[9], "create", registrarID, registrarName, string(models.RoleRegistrar),
		"", string(models.StatusPending), "", registrarID,
		"旧版本演示1：创建", now.AddDate(0, 0, -10), 1, false,
	); err != nil {
		return err
	}
	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[9], "assign", registrarID, registrarName, string(models.RoleRegistrar),
		string(models.StatusPending), string(models.StatusTransferred), registrarID, auditorID,
		"旧版本演示1：分派后退回补正", now.AddDate(0, 0, -8), 2, false,
	); err != nil {
		return err
	}
	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[9], "correct_reject", auditorID, auditorName, string(models.RoleAuditor),
		string(models.StatusTransferred), string(models.StatusPending), auditorID, registrarID,
		"旧版本演示1：退回补正，版本升至v3", now.AddDate(0, 0, -6), 3, true,
	); err != nil {
		return err
	}

	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[10], "create", registrarID, registrarName, string(models.RoleRegistrar),
		"", string(models.StatusPending), "", registrarID,
		"旧版本演示2：创建", now.AddDate(0, 0, -15), 1, false,
	); err != nil {
		return err
	}
	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[10], "assign", registrarID, registrarName, string(models.RoleRegistrar),
		string(models.StatusPending), string(models.StatusTransferred), registrarID, auditorID,
		"旧版本演示2：分派", now.AddDate(0, 0, -13), 2, false,
	); err != nil {
		return err
	}
	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[10], "audit_pass", auditorID, auditorName, string(models.RoleAuditor),
		string(models.StatusTransferred), string(models.StatusVisited), auditorID, reviewerID,
		"旧版本演示2：审核通过", now.AddDate(0, 0, -11), 3, false,
	); err != nil {
		return err
	}
	if _, err := recordStmt.Exec(
		uuid.NewString(), appIDs[10], "correct_reject", reviewerID, reviewerName, string(models.RoleReviewer),
		string(models.StatusVisited), string(models.StatusTransferred), reviewerID, auditorID,
		"旧版本演示2：复核退回补正，版本升至v4", now.AddDate(0, 0, -9), 4, true,
	); err != nil {
		return err
	}

	exceptionStmt, _ := tx.Prepare(`INSERT INTO exception_records 
		(id, application_id, type, reason, triggered_by, triggered_by_name, triggered_at, resolved)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
	defer exceptionStmt.Close()

	if _, err := exceptionStmt.Exec(
		uuid.NewString(), appIDs[1], "missing_materials",
		"报名资料不完整：缺少学历证明",
		auditorID, auditorName, now, false,
	); err != nil {
		return err
	}

	if _, err := exceptionStmt.Exec(
		uuid.NewString(), appIDs[2], "overdue",
		"审核节点逾期：超过审核时限1天未处理",
		auditorID, auditorName, now, false,
	); err != nil {
		return err
	}

	if _, err := exceptionStmt.Exec(
		uuid.NewString(), appIDs[3], "return_correction",
		"退回补正：班级分配和缴费确认未完成",
		auditorID, auditorName, now, false,
	); err != nil {
		return err
	}

	if _, err := exceptionStmt.Exec(
		uuid.NewString(), appIDs[4], "permission_denied",
		"同角色非处理人演示：赵登记员非当前处理人，尝试访问被拒绝",
		registrar2ID, registrar2Name, now, false,
	); err != nil {
		return err
	}

	if _, err := exceptionStmt.Exec(
		uuid.NewString(), appIDs[5], "permission_denied",
		"同角色非处理人演示：刘审核主管非当前处理人，尝试操作被拒绝",
		auditor2ID, auditor2Name, now, false,
	); err != nil {
		return err
	}

	if _, err := exceptionStmt.Exec(
		uuid.NewString(), appIDs[9], "version_conflict",
		"旧版本演示：客户端v1提交，服务端已升至v3，批量处理版本冲突",
		auditorID, auditorName, now, false,
	); err != nil {
		return err
	}

	if _, err := exceptionStmt.Exec(
		uuid.NewString(), appIDs[10], "version_conflict",
		"旧版本演示：客户端v2提交，服务端已升至v4，批量处理版本冲突",
		reviewerID, reviewerName, now, false,
	); err != nil {
		return err
	}

	if _, err := exceptionStmt.Exec(
		uuid.NewString(), appIDs[10], "return_correction",
		"旧版本演示v4：复核退回补正",
		reviewerID, reviewerName, now, false,
	); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Println("数据库 seed 数据初始化成功")
	return nil
}

func ScanApplication(rows *sql.Rows) (*models.StudentApplication, error) {
	var app models.StudentApplication
	var materialsOK, classOK, paymentOK int
	err := rows.Scan(
		&app.ID, &app.StudentName, &app.IdCard, &app.Phone, &app.Program,
		&app.Status, &app.CurrentHandler, &app.CurrentHandlerName, &app.CurrentHandlerRole,
		&app.NextHandler, &app.NextHandlerName, &app.NextHandlerRole,
		&app.AssignmentDeadline, &app.AuditDeadline, &app.ReviewDeadline,
		&app.CreatedAt, &app.UpdatedAt, &app.Version, &app.Urgency,
		&app.ResponsiblePerson, &app.ResponsiblePersonName,
		&materialsOK, &classOK, &paymentOK,
	)
	app.MaterialsComplete = materialsOK == 1
	app.ClassAssigned = classOK == 1
	app.PaymentConfirmed = paymentOK == 1
	return &app, err
}

func ScanApplicationRow(row *sql.Row) (*models.StudentApplication, error) {
	var app models.StudentApplication
	var materialsOK, classOK, paymentOK int
	err := row.Scan(
		&app.ID, &app.StudentName, &app.IdCard, &app.Phone, &app.Program,
		&app.Status, &app.CurrentHandler, &app.CurrentHandlerName, &app.CurrentHandlerRole,
		&app.NextHandler, &app.NextHandlerName, &app.NextHandlerRole,
		&app.AssignmentDeadline, &app.AuditDeadline, &app.ReviewDeadline,
		&app.CreatedAt, &app.UpdatedAt, &app.Version, &app.Urgency,
		&app.ResponsiblePerson, &app.ResponsiblePersonName,
		&materialsOK, &classOK, &paymentOK,
	)
	app.MaterialsComplete = materialsOK == 1
	app.ClassAssigned = classOK == 1
	app.PaymentConfirmed = paymentOK == 1
	return &app, err
}
