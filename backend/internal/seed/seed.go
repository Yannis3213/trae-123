package seed

import (
	"database/sql"
	"log"
	"time"

	"github.com/google/uuid"
	"pharmacy-nearexpiry/internal/database"
	"pharmacy-nearexpiry/internal/models"
)

func Seed() error {
	count := 0
	database.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count > 0 {
		log.Println("Seed data already exists, skipping")
		return nil
	}

	log.Println("Seeding database...")

	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	seedUsers(tx)
	seedOrders(tx)
	seedAttachments(tx)
	seedProcessingRecords(tx)
	seedAuditNotes(tx)
	seedExceptionReasons(tx)

	return tx.Commit()
}

func seedUsers(tx *sql.Tx) {
	users := []models.User{
		{ID: "clerk01", Username: "clerk01", Name: "店员小王", Role: models.RoleShopClerk, Store: "朝阳大药房"},
		{ID: "clerk02", Username: "clerk02", Name: "店员小李", Role: models.RoleShopClerk, Store: "海淀大药房"},
		{ID: "pharm01", Username: "pharm01", Name: "执业药师张药师", Role: models.RolePharmacist, Store: "朝阳大药房"},
		{ID: "pharm02", Username: "pharm02", Name: "执业药师刘药师", Role: models.RolePharmacist, Store: "海淀大药房"},
		{ID: "manager01", Username: "manager01", Name: "区域经理陈经理", Role: models.RoleAreaManager, Store: "华北区域"},
	}

	for _, u := range users {
		tx.Exec("INSERT INTO users (id, username, name, role, store) VALUES (?, ?, ?, ?, ?)",
			u.ID, u.Username, u.Name, u.Role, u.Store)
	}
	log.Println("Users seeded")
}

func seedOrders(tx *sql.Tx) {
	now := time.Now()

	orders := []struct {
		models.NearExpiryOrder
		hasInspection bool
		hasTransfer   bool
		hasRemoval    bool
	}{
		{
			NearExpiryOrder: models.NearExpiryOrder{
				ID: uuid.NewString(), OrderNo: "JXQ-2026-0001",
				StoreName: "朝阳大药房", ProductName: "阿莫西林胶囊",
				BatchNo: "AM20260101", ExpiryDate: now.AddDate(0, 1, 0),
				Quantity: 50, Status: models.StatusPendingDispatch,
				CurrentHandler: "pharm01", CreatedBy: "clerk01",
				CreatedAt: now.AddDate(0, 0, -3), UpdatedAt: now.AddDate(0, 0, -3),
				Version: 1, DueDate: now.AddDate(0, 0, 2),
			},
			hasInspection: true, hasTransfer: false, hasRemoval: false,
		},
		{
			NearExpiryOrder: models.NearExpiryOrder{
				ID: uuid.NewString(), OrderNo: "JXQ-2026-0002",
				StoreName: "朝阳大药房", ProductName: "布洛芬缓释胶囊",
				BatchNo: "BL20260201", ExpiryDate: now.AddDate(0, 0, 20),
				Quantity: 30, Status: models.StatusProcessing,
				CurrentHandler: "manager01", CreatedBy: "clerk01",
				CreatedAt: now.AddDate(0, 0, -5), UpdatedAt: now.AddDate(0, 0, -1),
				Version: 2, DueDate: now.AddDate(0, 0, 3),
			},
			hasInspection: true, hasTransfer: true, hasRemoval: true,
		},
		{
			NearExpiryOrder: models.NearExpiryOrder{
				ID: uuid.NewString(), OrderNo: "JXQ-2026-0003",
				StoreName: "海淀大药房", ProductName: "维生素C片",
				BatchNo: "VC20260301", ExpiryDate: now.AddDate(0, 2, 0),
				Quantity: 100, Status: models.StatusPendingDispatch,
				CurrentHandler: "pharm02", CreatedBy: "clerk02",
				CreatedAt: now.AddDate(0, 0, -1), UpdatedAt: now.AddDate(0, 0, -1),
				Version: 1, DueDate: now.AddDate(0, 0, 7),
			},
			hasInspection: false, hasTransfer: false, hasRemoval: false,
		},
		{
			NearExpiryOrder: models.NearExpiryOrder{
				ID: uuid.NewString(), OrderNo: "JXQ-2026-0004",
				StoreName: "朝阳大药房", ProductName: "感冒灵颗粒",
				BatchNo: "GM20251201", ExpiryDate: now.AddDate(0, 0, -5),
				Quantity: 20, Status: models.StatusPendingDispatch,
				CurrentHandler: "pharm01", CreatedBy: "clerk01",
				CreatedAt: now.AddDate(0, 0, -10), UpdatedAt: now.AddDate(0, 0, -10),
				Version: 1, DueDate: now.AddDate(0, 0, -2),
			},
			hasInspection: true, hasTransfer: false, hasRemoval: false,
		},
		{
			NearExpiryOrder: models.NearExpiryOrder{
				ID: uuid.NewString(), OrderNo: "JXQ-2026-0005",
				StoreName: "海淀大药房", ProductName: "诺氟沙星胶囊",
				BatchNo: "NF20260101", ExpiryDate: now.AddDate(0, 1, 15),
				Quantity: 40, Status: models.StatusReturned,
				CurrentHandler: "clerk02", CreatedBy: "clerk02",
				CreatedAt: now.AddDate(0, 0, -7), UpdatedAt: now.AddDate(0, 0, -2),
				Version: 3, DueDate: now.AddDate(0, 0, 5),
			},
			hasInspection: true, hasTransfer: true, hasRemoval: false,
		},
		{
			NearExpiryOrder: models.NearExpiryOrder{
				ID: uuid.NewString(), OrderNo: "JXQ-2026-0006",
				StoreName: "朝阳大药房", ProductName: "复方丹参片",
				BatchNo: "DS20251001", ExpiryDate: now.AddDate(0, 0, -15),
				Quantity: 60, Status: models.StatusClosed,
				CurrentHandler: "", CreatedBy: "clerk01",
				CreatedAt: now.AddDate(0, 0, -20), UpdatedAt: now.AddDate(0, 0, -5),
				Version: 5, DueDate: now.AddDate(0, 0, -10),
				ClosedAt: func() *time.Time { t := now.AddDate(0, 0, -5); return &t }(),
			},
			hasInspection: true, hasTransfer: true, hasRemoval: true,
		},
		{
			NearExpiryOrder: models.NearExpiryOrder{
				ID: uuid.NewString(), OrderNo: "JXQ-2026-0007",
				StoreName: "海淀大药房", ProductName: "蒙脱石散",
				BatchNo: "MT20260201", ExpiryDate: now.AddDate(0, 0, 10),
				Quantity: 25, Status: models.StatusProcessing,
				CurrentHandler: "manager01", CreatedBy: "clerk02",
				CreatedAt: now.AddDate(0, 0, -4), UpdatedAt: now.AddDate(0, 0, -1),
				Version: 2, DueDate: now.AddDate(0, 0, -1),
			},
			hasInspection: true, hasTransfer: true, hasRemoval: false,
		},
		{
			NearExpiryOrder: models.NearExpiryOrder{
				ID: uuid.NewString(), OrderNo: "JXQ-2026-0008",
				StoreName: "朝阳大药房", ProductName: "藿香正气水",
				BatchNo: "HZ20260101", ExpiryDate: now.AddDate(0, 3, 0),
				Quantity: 80, Status: models.StatusPendingDispatch,
				CurrentHandler: "pharm01", CreatedBy: "clerk01",
				CreatedAt: now.AddDate(0, 0, -2), UpdatedAt: now.AddDate(0, 0, -2),
				Version: 1, DueDate: now.AddDate(0, 0, 10),
			},
			hasInspection: false, hasTransfer: false, hasRemoval: false,
		},
	}

	for _, o := range orders {
		closedAt := o.ClosedAt
		var closedAtVal interface{}
		if closedAt != nil {
			closedAtVal = *closedAt
		} else {
			closedAtVal = nil
		}
		tx.Exec(`INSERT INTO near_expiry_orders 
			(id, order_no, store_name, product_name, batch_no, expiry_date, 
			 quantity, status, current_handler, created_by, created_at, updated_at, version, due_date, closed_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			o.ID, o.OrderNo, o.StoreName, o.ProductName, o.BatchNo, o.ExpiryDate,
			o.Quantity, o.Status, o.CurrentHandler, o.CreatedBy, o.CreatedAt, o.UpdatedAt, o.Version, o.DueDate, closedAtVal)
	}
	log.Println("Orders seeded")
}

func seedAttachments(tx *sql.Tx) {
	var orders []struct {
		ID            string
		Status        string
		CurrentHandler string
	}
	rows, _ := tx.Query("SELECT id, status, current_handler FROM near_expiry_orders ORDER BY order_no")
	for rows.Next() {
		var id, status, handler string
		rows.Scan(&id, &status, &handler)
		orders = append(orders, struct {
			ID            string
			Status        string
			CurrentHandler string
		}{id, status, handler})
	}
	rows.Close()

	now := time.Now()

	attachments := []struct {
		orderIdx int
		evType   models.EvidenceType
		fileName string
		uploader string
		offset   int
	}{
		{0, models.EvidenceInspection, "巡检记录_阿莫西林.pdf", "clerk01", -3},
		{1, models.EvidenceInspection, "巡检记录_布洛芬.pdf", "clerk01", -5},
		{1, models.EvidenceTransfer, "调拨申请_布洛芬.pdf", "pharm01", -3},
		{1, models.EvidenceRemoval, "下架确认_布洛芬.pdf", "pharm01", -2},
		{3, models.EvidenceInspection, "巡检记录_感冒灵.pdf", "clerk01", -10},
		{4, models.EvidenceInspection, "巡检记录_诺氟沙星.pdf", "clerk02", -7},
		{4, models.EvidenceTransfer, "调拨申请_诺氟沙星.pdf", "pharm02", -5},
		{5, models.EvidenceInspection, "巡检记录_丹参片.pdf", "clerk01", -20},
		{5, models.EvidenceTransfer, "调拨申请_丹参片.pdf", "pharm01", -15},
		{5, models.EvidenceRemoval, "下架确认_丹参片.pdf", "pharm01", -10},
		{6, models.EvidenceInspection, "巡检记录_蒙脱石散.pdf", "clerk02", -4},
		{6, models.EvidenceTransfer, "调拨申请_蒙脱石散.pdf", "pharm02", -2},
	}

	for _, a := range attachments {
		if a.orderIdx < len(orders) {
			tx.Exec(`INSERT INTO attachments (id, order_id, evidence_type, file_name, uploaded_by, uploaded_at, remark)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
				uuid.NewString(), orders[a.orderIdx].ID, a.evType, a.fileName, a.uploader,
				now.AddDate(0, 0, a.offset), "系统初始导入")
		}
	}
	log.Println("Attachments seeded")
}

func seedProcessingRecords(tx *sql.Tx) {
	var orders []struct {
		ID     string
		Status string
		OrderNo string
	}
	rows, _ := tx.Query("SELECT id, status, order_no FROM near_expiry_orders ORDER BY order_no")
	for rows.Next() {
		var id, status, orderNo string
		rows.Scan(&id, &status, &orderNo)
		orders = append(orders, struct {
			ID     string
			Status string
			OrderNo string
		}{id, status, orderNo})
	}
	rows.Close()

	now := time.Now()

	records := []struct {
		orderIdx   int
		action     string
		fromStatus models.OrderStatus
		toStatus   models.OrderStatus
		operator   string
		opRole     models.Role
		remark     string
		offset     int
	}{
		{0, "创建", "", models.StatusPendingDispatch, "clerk01", models.RoleShopClerk, "创建近效期处理单", -3},
		{0, "派发", models.StatusPendingDispatch, models.StatusPendingDispatch, "clerk01", models.RoleShopClerk, "派发给执业药师处理", -3},
		{1, "创建", "", models.StatusPendingDispatch, "clerk01", models.RoleShopClerk, "创建近效期处理单", -5},
		{1, "派发", models.StatusPendingDispatch, models.StatusPendingDispatch, "clerk01", models.RoleShopClerk, "派发给执业药师处理", -5},
		{1, "处理完成", models.StatusPendingDispatch, models.StatusProcessing, "pharm01", models.RolePharmacist, "已完成调拨和下架", -2},
		{1, "提交复核", models.StatusProcessing, models.StatusProcessing, "pharm01", models.RolePharmacist, "提交区域经理复核", -1},
		{2, "创建", "", models.StatusPendingDispatch, "clerk02", models.RoleShopClerk, "创建近效期处理单", -1},
		{2, "派发", models.StatusPendingDispatch, models.StatusPendingDispatch, "clerk02", models.RoleShopClerk, "派发给执业药师处理", -1},
		{3, "创建", "", models.StatusPendingDispatch, "clerk01", models.RoleShopClerk, "创建近效期处理单（已逾期）", -10},
		{3, "派发", models.StatusPendingDispatch, models.StatusPendingDispatch, "clerk01", models.RoleShopClerk, "派发给执业药师处理", -10},
		{4, "创建", "", models.StatusPendingDispatch, "clerk02", models.RoleShopClerk, "创建近效期处理单", -7},
		{4, "派发", models.StatusPendingDispatch, models.StatusPendingDispatch, "clerk02", models.RoleShopClerk, "派发给执业药师处理", -7},
		{4, "处理中", models.StatusPendingDispatch, models.StatusProcessing, "pharm02", models.RolePharmacist, "已完成调拨，待下架确认", -5},
		{4, "退回补正", models.StatusProcessing, models.StatusReturned, "manager01", models.RoleAreaManager, "缺少下架确认凭证，请补正", -2},
		{5, "创建", "", models.StatusPendingDispatch, "clerk01", models.RoleShopClerk, "创建近效期处理单", -20},
		{5, "派发", models.StatusPendingDispatch, models.StatusPendingDispatch, "clerk01", models.RoleShopClerk, "派发给执业药师处理", -20},
		{5, "处理完成", models.StatusPendingDispatch, models.StatusProcessing, "pharm01", models.RolePharmacist, "已完成全部处理", -15},
		{5, "提交复核", models.StatusProcessing, models.StatusProcessing, "pharm01", models.RolePharmacist, "提交区域经理复核", -12},
		{5, "复核通过", models.StatusProcessing, models.StatusClosed, "manager01", models.RoleAreaManager, "复核通过，关闭处理单", -5},
		{6, "创建", "", models.StatusPendingDispatch, "clerk02", models.RoleShopClerk, "创建近效期处理单（临期）", -4},
		{6, "派发", models.StatusPendingDispatch, models.StatusPendingDispatch, "clerk02", models.RoleShopClerk, "派发给执业药师处理", -4},
		{6, "处理完成", models.StatusPendingDispatch, models.StatusProcessing, "pharm02", models.RolePharmacist, "已完成调拨，待下架", -2},
		{6, "提交复核", models.StatusProcessing, models.StatusProcessing, "pharm02", models.RolePharmacist, "提交区域经理复核（临期）", -1},
		{7, "创建", "", models.StatusPendingDispatch, "clerk01", models.RoleShopClerk, "创建近效期处理单", -2},
		{7, "派发", models.StatusPendingDispatch, models.StatusPendingDispatch, "clerk01", models.RoleShopClerk, "派发给执业药师处理", -2},
	}

	for _, r := range records {
		if r.orderIdx < len(orders) {
			tx.Exec(`INSERT INTO processing_records 
				(id, order_id, action, from_status, to_status, operator, operator_role, remark, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				uuid.NewString(), orders[r.orderIdx].ID, r.action, r.fromStatus, r.toStatus,
				r.operator, r.opRole, r.remark, now.AddDate(0, 0, r.offset))
		}
	}
	log.Println("Processing records seeded")
}

func seedAuditNotes(tx *sql.Tx) {
	var orders []string
	rows, _ := tx.Query("SELECT id FROM near_expiry_orders ORDER BY order_no")
	for rows.Next() {
		var id string
		rows.Scan(&id)
		orders = append(orders, id)
	}
	rows.Close()

	now := time.Now()

	notes := []struct {
		orderIdx int
		content  string
		author   string
		offset   int
	}{
		{1, "该批次药品质量良好，建议优先调拨至需求门店", "pharm01", -4},
		{3, "已逾期，请尽快处理，避免监管风险", "manager01", -1},
		{4, "请尽快补上下架确认凭证，否则无法通过复核", "manager01", -2},
		{5, "已完成全流程归档，处理规范", "manager01", -5},
		{6, "临期预警，请加急处理下架流程", "pharm02", -1},
	}

	for _, n := range notes {
		if n.orderIdx < len(orders) {
			tx.Exec(`INSERT INTO audit_notes (id, order_id, content, author, created_at)
				VALUES (?, ?, ?, ?, ?)`,
				uuid.NewString(), orders[n.orderIdx], n.content, n.author, now.AddDate(0, 0, n.offset))
		}
	}
	log.Println("Audit notes seeded")
}

func seedExceptionReasons(tx *sql.Tx) {
	var orders []string
	rows, _ := tx.Query("SELECT id FROM near_expiry_orders ORDER BY order_no")
	for rows.Next() {
		var id string
		rows.Scan(&id)
		orders = append(orders, id)
	}
	rows.Close()

	now := time.Now()

	exceptions := []struct {
		orderIdx       int
		reason         string
		exceptionType  string
		reportedBy     string
		offset         int
		resolved       bool
	}{
		{2, "缺少近效期巡检记录", "missing_evidence", "pharm02", -1, false},
		{3, "已逾期2天未处理", "overdue", "manager01", -1, false},
		{4, "缺少下架确认凭证，退回补正", "missing_evidence", "manager01", -2, false},
		{6, "已临期，需加急处理", "near_due", "pharm02", -1, false},
		{7, "缺少全部证据材料", "missing_evidence", "pharm01", -2, false},
	}

	for _, e := range exceptions {
		if e.orderIdx < len(orders) {
			resolved := 0
			if e.resolved {
				resolved = 1
			}
			tx.Exec(`INSERT INTO exception_reasons 
				(id, order_id, reason, exception_type, reported_by, created_at, resolved)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
				uuid.NewString(), orders[e.orderIdx], e.reason, e.exceptionType,
				e.reportedBy, now.AddDate(0, 0, e.offset), resolved)
		}
	}
	log.Println("Exception reasons seeded")
}
