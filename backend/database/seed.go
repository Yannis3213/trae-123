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
		{ID: uuid.NewString(), Username: "auditor", Password: "123456", Name: "王审核主管", Role: models.RoleAuditor},
		{ID: uuid.NewString(), Username: "reviewer", Password: "123456", Name: "张复核校长", Role: models.RoleReviewer},
	}

	userStmt, _ := tx.Prepare("INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)")
	defer userStmt.Close()
	for _, u := range users {
		if _, err := userStmt.Exec(u.ID, u.Username, u.Password, u.Name, string(u.Role)); err != nil {
			return err
		}
	}

	var registrarID, auditorID, reviewerID string
	var registrarName, auditorName, reviewerName string
	DB.QueryRow("SELECT id, name FROM users WHERE role = 'registrar'").Scan(&registrarID, &registrarName)
	DB.QueryRow("SELECT id, name FROM users WHERE role = 'auditor'").Scan(&auditorID, &auditorName)
	DB.QueryRow("SELECT id, name FROM users WHERE role = 'reviewer'").Scan(&reviewerID, &reviewerName)

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
	}{
		{
			"赵正常", "110101199001011234", "13800138001", "数控技术",
			models.StatusPending, registrarID, registrarName, models.RoleRegistrar,
			auditorID, auditorName, models.RoleAuditor,
			now.AddDate(0, 0, 3), now.AddDate(0, 0, 5), now.AddDate(0, 0, 7),
			models.UrgencyNormal, registrarID, registrarName,
			true, true, true,
		},
		{
			"钱材料", "110101199002022345", "13800138002", "电子商务",
			models.StatusPending, registrarID, registrarName, models.RoleRegistrar,
			auditorID, auditorName, models.RoleAuditor,
			now.AddDate(0, 0, 2), now.AddDate(0, 0, 4), now.AddDate(0, 0, 6),
			models.UrgencyWarning, registrarID, registrarName,
			false, true, true,
		},
		{
			"孙逾期", "110101199003033456", "13800138003", "汽车维修",
			models.StatusTransferred, auditorID, auditorName, models.RoleAuditor,
			reviewerID, reviewerName, models.RoleReviewer,
			now.AddDate(0, 0, -3), now.AddDate(0, 0, -1), now.AddDate(0, 0, 2),
			models.UrgencyOverdue, auditorID, auditorName,
			true, true, true,
		},
		{
			"周补正", "110101199004044567", "13800138004", "会计电算化",
			models.StatusPending, registrarID, registrarName, models.RoleRegistrar,
			auditorID, auditorName, models.RoleAuditor,
			now.AddDate(0, 0, 4), now.AddDate(0, 0, 6), now.AddDate(0, 0, 8),
			models.UrgencyNormal, registrarID, registrarName,
			true, false, false,
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
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`)
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
			now, now, string(a.Urgency),
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
