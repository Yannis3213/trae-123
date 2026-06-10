package database

import (
	"fmt"
	"time"

	"trae-123-4/backend/models"
)

type seedData struct {
	ApplicationNo          string
	TenantName             string
	TenantPhone            string
	RoomNumber             string
	BuildingName           string
	LeaseStartDate         string
	LeaseEndDate           string
	MonthlyRent            float64
	Deposit                float64
	Status                 string
	CurrentHandlerID       string
	CurrentHandlerName     string
	CurrentHandlerRole     string
	Confirmed              int
	TenantSigningStatus    string
	RoomConfirmationStatus string
	MoveInHandoverStatus   string
	ExceptionReason        string
}

func SeedData() error {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM lease_applications").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	now := time.Now().Format(time.RFC3339)
	today := time.Now().Format("2006-01-02")

	expiringSoon := time.Now().Add(20 * 24 * time.Hour).Format("2006-01-02")
	expiringSoon2 := time.Now().Add(15 * 24 * time.Hour).Format("2006-01-02")
	overdue := time.Now().Add(-5 * 24 * time.Hour).Format("2006-01-02")
	normalEnd := time.Now().Add(180 * 24 * time.Hour).Format("2006-01-02")
	normalEnd2 := time.Now().Add(200 * 24 * time.Hour).Format("2006-01-02")
	longEnd := time.Now().Add(300 * 24 * time.Hour).Format("2006-01-02")

	startBase := time.Now().Add(-30 * 24 * time.Hour).Format("2006-01-02")
	startBase2 := time.Now().Add(-60 * 24 * time.Hour).Format("2006-01-02")
	startBase3 := time.Now().Add(-90 * 24 * time.Hour).Format("2006-01-02")

	seeds := []seedData{
		{ApplicationNo: "ZY-2026-001", TenantName: "陈志远", TenantPhone: "13800001001", RoomNumber: "1201", BuildingName: "A栋", LeaseStartDate: startBase, LeaseEndDate: normalEnd, MonthlyRent: 3500, Deposit: 7000, Status: "pending_verification", CurrentHandlerID: "user_002", CurrentHandlerName: "李维修", CurrentHandlerRole: "maintenance_coordinator", TenantSigningStatus: "pending", RoomConfirmationStatus: "pending", MoveInHandoverStatus: "pending", ExceptionReason: ""},
		{ApplicationNo: "ZY-2026-002", TenantName: "王丽华", TenantPhone: "13800001002", RoomNumber: "1503", BuildingName: "B栋", LeaseStartDate: startBase2, LeaseEndDate: normalEnd2, MonthlyRent: 4200, Deposit: 8400, Status: "pending_verification", CurrentHandlerID: "user_002", CurrentHandlerName: "李维修", CurrentHandlerRole: "maintenance_coordinator", TenantSigningStatus: "pending", RoomConfirmationStatus: "pending", MoveInHandoverStatus: "pending", ExceptionReason: ""},
		{ApplicationNo: "ZY-2026-003", TenantName: "刘建国", TenantPhone: "13800001003", RoomNumber: "802", BuildingName: "A栋", LeaseStartDate: startBase3, LeaseEndDate: longEnd, MonthlyRent: 3800, Deposit: 7600, Status: "pending_verification", CurrentHandlerID: "user_002", CurrentHandlerName: "李维修", CurrentHandlerRole: "maintenance_coordinator", TenantSigningStatus: "pending", RoomConfirmationStatus: "pending", MoveInHandoverStatus: "pending", ExceptionReason: ""},
		{ApplicationNo: "ZY-2026-004", TenantName: "张美玲", TenantPhone: "13800001004", RoomNumber: "605", BuildingName: "C栋", LeaseStartDate: startBase, LeaseEndDate: expiringSoon, MonthlyRent: 3100, Deposit: 6200, Status: "pending_verification", CurrentHandlerID: "user_002", CurrentHandlerName: "李维修", CurrentHandlerRole: "maintenance_coordinator", TenantSigningStatus: "pending", RoomConfirmationStatus: "pending", MoveInHandoverStatus: "pending", ExceptionReason: ""},
		{ApplicationNo: "ZY-2026-005", TenantName: "赵伟明", TenantPhone: "13800001005", RoomNumber: "901", BuildingName: "B栋", LeaseStartDate: startBase2, LeaseEndDate: expiringSoon2, MonthlyRent: 4500, Deposit: 9000, Status: "pending_verification", CurrentHandlerID: "user_002", CurrentHandlerName: "李维修", CurrentHandlerRole: "maintenance_coordinator", TenantSigningStatus: "pending", RoomConfirmationStatus: "pending", MoveInHandoverStatus: "pending", ExceptionReason: ""},
		{ApplicationNo: "ZY-2026-006", TenantName: "孙晓红", TenantPhone: "13800001006", RoomNumber: "304", BuildingName: "A栋", LeaseStartDate: startBase3, LeaseEndDate: overdue, MonthlyRent: 3600, Deposit: 7200, Status: "pending_verification", CurrentHandlerID: "user_002", CurrentHandlerName: "李维修", CurrentHandlerRole: "maintenance_coordinator", TenantSigningStatus: "pending", RoomConfirmationStatus: "pending", MoveInHandoverStatus: "pending", ExceptionReason: ""},
		{ApplicationNo: "ZY-2026-007", TenantName: "周文博", TenantPhone: "13800001007", RoomNumber: "1102", BuildingName: "C栋", LeaseStartDate: startBase, LeaseEndDate: normalEnd, MonthlyRent: 4000, Deposit: 8000, Status: "verification_failed", CurrentHandlerID: "user_001", CurrentHandlerName: "张租赁", CurrentHandlerRole: "lease_clerk", TenantSigningStatus: "pending", RoomConfirmationStatus: "pending", MoveInHandoverStatus: "pending", ExceptionReason: "材料不全，缺少身份证复印件"},
		{ApplicationNo: "ZY-2026-008", TenantName: "吴晓燕", TenantPhone: "13800001008", RoomNumber: "704", BuildingName: "B栋", LeaseStartDate: startBase2, LeaseEndDate: normalEnd2, MonthlyRent: 3800, Deposit: 7600, Status: "verification_failed", CurrentHandlerID: "user_001", CurrentHandlerName: "张租赁", CurrentHandlerRole: "lease_clerk", TenantSigningStatus: "pending", RoomConfirmationStatus: "failed", MoveInHandoverStatus: "pending", ExceptionReason: "房态异常，房间存在漏水问题"},
		{ApplicationNo: "ZY-2026-009", TenantName: "郑海涛", TenantPhone: "13800001009", RoomNumber: "506", BuildingName: "A栋", LeaseStartDate: startBase3, LeaseEndDate: longEnd, MonthlyRent: 3500, Deposit: 7000, Status: "verification_failed", CurrentHandlerID: "user_001", CurrentHandlerName: "张租赁", CurrentHandlerRole: "lease_clerk", TenantSigningStatus: "failed", RoomConfirmationStatus: "pending", MoveInHandoverStatus: "pending", ExceptionReason: "签约信息有误，租客姓名与身份证不符"},
		{ApplicationNo: "ZY-2026-010", TenantName: "黄雅琴", TenantPhone: "13800001010", RoomNumber: "203", BuildingName: "C栋", LeaseStartDate: startBase, LeaseEndDate: normalEnd, MonthlyRent: 3200, Deposit: 6400, Status: "verification_failed", CurrentHandlerID: "user_001", CurrentHandlerName: "张租赁", CurrentHandlerRole: "lease_clerk", TenantSigningStatus: "pending", RoomConfirmationStatus: "pending", MoveInHandoverStatus: "pending", ExceptionReason: "材料不全，缺少收入证明"},
		{ApplicationNo: "ZY-2026-011", TenantName: "林大为", TenantPhone: "13800001011", RoomNumber: "1008", BuildingName: "A栋", LeaseStartDate: startBase2, LeaseEndDate: normalEnd2, MonthlyRent: 4500, Deposit: 9000, Status: "verification_complete", CurrentHandlerID: "user_003", CurrentHandlerName: "王经理", CurrentHandlerRole: "store_manager", Confirmed: 0, TenantSigningStatus: "complete", RoomConfirmationStatus: "complete", MoveInHandoverStatus: "complete", ExceptionReason: ""},
		{ApplicationNo: "ZY-2026-012", TenantName: "杨秀英", TenantPhone: "13800001012", RoomNumber: "405", BuildingName: "B栋", LeaseStartDate: startBase3, LeaseEndDate: longEnd, MonthlyRent: 3600, Deposit: 7200, Status: "verification_complete", CurrentHandlerID: "", CurrentHandlerName: "", CurrentHandlerRole: "store_manager", Confirmed: 1, TenantSigningStatus: "complete", RoomConfirmationStatus: "complete", MoveInHandoverStatus: "pending", ExceptionReason: ""},
		{ApplicationNo: "ZY-2026-013", TenantName: "马晓峰", TenantPhone: "13800001013", RoomNumber: "710", BuildingName: "C栋", LeaseStartDate: startBase, LeaseEndDate: expiringSoon, MonthlyRent: 3900, Deposit: 7800, Status: "verification_complete", CurrentHandlerID: "user_003", CurrentHandlerName: "王经理", CurrentHandlerRole: "store_manager", Confirmed: 0, TenantSigningStatus: "complete", RoomConfirmationStatus: "pending", MoveInHandoverStatus: "pending", ExceptionReason: ""},
		{ApplicationNo: "ZY-2026-014", TenantName: "何丽萍", TenantPhone: "13800001014", RoomNumber: "309", BuildingName: "A栋", LeaseStartDate: startBase2, LeaseEndDate: normalEnd, MonthlyRent: 3700, Deposit: 7400, Status: "pending_verification", CurrentHandlerID: "user_002", CurrentHandlerName: "李维修", CurrentHandlerRole: "maintenance_coordinator", Confirmed: 0, TenantSigningStatus: "complete", RoomConfirmationStatus: "pending", MoveInHandoverStatus: "failed", ExceptionReason: "交接时发现家具损坏"},
		{ApplicationNo: "ZY-2026-015", TenantName: "许振宇", TenantPhone: "13800001015", RoomNumber: "607", BuildingName: "B栋", LeaseStartDate: startBase3, LeaseEndDate: normalEnd2, MonthlyRent: 4100, Deposit: 8200, Status: "verification_complete", CurrentHandlerID: "", CurrentHandlerName: "", CurrentHandlerRole: "store_manager", Confirmed: 1, TenantSigningStatus: "pending", RoomConfirmationStatus: "complete", MoveInHandoverStatus: "complete", ExceptionReason: ""},
	}

	tx, err := DB.Begin()
	if err != nil {
		return fmt.Errorf("开启事务失败: %v", err)
	}

	stmt, err := tx.Prepare(`INSERT INTO lease_applications
		(id, application_no, tenant_name, tenant_phone, room_number, building_name,
		lease_start_date, lease_end_date, monthly_rent, deposit, status,
		current_handler_id, current_handler_name, current_handler_role, version, confirmed,
		tenant_signing_status, room_confirmation_status, move_in_handover_status,
		exception_reason, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	for i, s := range seeds {
		id := models.GenerateID()
		_, err = stmt.Exec(id, s.ApplicationNo, s.TenantName, s.TenantPhone,
			s.RoomNumber, s.BuildingName, s.LeaseStartDate, s.LeaseEndDate,
			s.MonthlyRent, s.Deposit, s.Status,
			s.CurrentHandlerID, s.CurrentHandlerName, s.CurrentHandlerRole, 1, s.Confirmed,
			s.TenantSigningStatus, s.RoomConfirmationStatus, s.MoveInHandoverStatus,
			s.ExceptionReason, now, now)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("插入第%d条数据失败: %v", i+1, err)
		}
	}

	auditStmt, err := tx.Prepare(`INSERT INTO audit_logs
		(id, application_id, operator_id, operator_name, operator_role, action,
		before_status, after_status, detail, failure_reason, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer auditStmt.Close()

	rows, err := tx.Query("SELECT id, application_no, status FROM lease_applications")
	if err != nil {
		tx.Rollback()
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var appID, appNo, status string
		rows.Scan(&appID, &appNo, &status)
		auditID := models.GenerateID()
		action := "创建申请"
		if status == "verification_failed" {
			action = "核验失败"
		} else if status == "verification_complete" {
			action = "核验通过"
		}
		auditStmt.Exec(auditID, appID, "user_001", "张租赁", "lease_clerk",
			action, "", status, fmt.Sprintf("申请编号 %s 初始化", appNo), "", now)
	}

	return tx.Commit()
}
