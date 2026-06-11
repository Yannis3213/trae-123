package database

import (
	"fmt"
	"insurance-system/models"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(dbPath string) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return fmt.Errorf("open sqlite: %w", err)
	}
	return nil
}

func Migrate() error {
	return DB.AutoMigrate(
		&models.PatrolOrder{},
		&models.Attachment{},
		&models.OrderHistory{},
		&models.AuditNote{},
	)
}

func SeedData() error {
	var count int64
	DB.Model(&models.PatrolOrder{}).Count(&count)
	if count > 0 {
		return nil
	}

	now := time.Now()
	startDate := now
	endDate := now.AddDate(1, 0, 0)

	type seedDef struct {
		order    models.PatrolOrder
		attachFn func(uint) []models.Attachment
		histFn   func(models.PatrolOrder) []models.OrderHistory
		noteFn   func(models.PatrolOrder) []models.AuditNote
	}

	seeds := []seedDef{
		{
			order: models.PatrolOrder{
				OrderNo: fmt.Sprintf("BX%d001", now.Year()), CustomerName: "张三",
				IDNumber: "110101199001011234", Phone: "13800138001",
				InsuranceType: "重疾险", InsuranceAmount: 500000, Premium: 8800, InsurancePeriod: "20年",
				Status: "待审核", CurrentHandlerID: "underwriter_01", CurrentHandler: "核保专员-李",
				CreatorID: "cm_01", CreatorName: "客户经理-王",
				Deadline: timePtr(now.AddDate(0, 0, 7)), Version: 1,
				EvidenceUploaded: true,
				StartDate: &startDate, EndDate: &endDate,
				CreatedAt: now.AddDate(0, 0, -2), UpdatedAt: now.AddDate(0, 0, -1),
			},
			attachFn: func(oid uint) []models.Attachment {
				return []models.Attachment{
					{PatrolOrderID: oid, FileName: "投保单.pdf", FileType: "application/pdf", FileSize: 150000, Category: "application_form", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -2)},
					{PatrolOrderID: oid, FileName: "身份证正反面.jpg", FileType: "image/jpeg", FileSize: 200000, Category: "id_card", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -2)},
					{PatrolOrderID: oid, FileName: "收入证明.pdf", FileType: "application/pdf", FileSize: 100000, Category: "income", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -2)},
				}
			},
			histFn: func(o models.PatrolOrder) []models.OrderHistory {
				return []models.OrderHistory{
					{PatrolOrderID: o.ID, Action: "submit", PreviousStatus: "", CurrentStatus: "待审核", OperatorID: "cm_01", OperatorName: "客户经理-王", OperatorRole: "customer_manager", Remark: "提交投保申请，附件齐全", CreatedAt: o.CreatedAt},
				}
			},
			noteFn: func(o models.PatrolOrder) []models.AuditNote { return nil },
		},
		{
			order: models.PatrolOrder{
				OrderNo: fmt.Sprintf("BX%d002", now.Year()), CustomerName: "李四",
				IDNumber: "110101199203032234", Phone: "13800138002",
				InsuranceType: "意外险", InsuranceAmount: 200000, Premium: 1200, InsurancePeriod: "1年",
				Status: "待补正", CurrentHandlerID: "cm_01", CurrentHandler: "客户经理-王",
				CreatorID: "cm_01", CreatorName: "客户经理-王",
				Deadline: timePtr(now.AddDate(0, 0, 2)), Version: 2,
				SupplementReason: "缺少被保险人身份证明文件，请补充身份证扫描件",
				EvidenceUploaded: false,
				StartDate: &startDate, EndDate: &endDate,
				CreatedAt: now.AddDate(0, 0, -5), UpdatedAt: now.AddDate(0, 0, -3),
			},
			attachFn: func(oid uint) []models.Attachment {
				return []models.Attachment{
					{PatrolOrderID: oid, FileName: "投保单.pdf", FileType: "application/pdf", FileSize: 150000, Category: "application_form", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -5)},
				}
			},
			histFn: func(o models.PatrolOrder) []models.OrderHistory {
				return []models.OrderHistory{
					{PatrolOrderID: o.ID, Action: "submit", PreviousStatus: "", CurrentStatus: "待审核", OperatorID: "cm_01", OperatorName: "客户经理-王", OperatorRole: "customer_manager", Remark: "提交投保申请", CreatedAt: o.CreatedAt},
					{PatrolOrderID: o.ID, Action: "reject", PreviousStatus: "待审核", CurrentStatus: "待补正", OperatorID: "underwriter_01", OperatorName: "核保专员-李", OperatorRole: "underwriter", Remark: "资料不齐，退回补正", AbnormalReason: "缺少被保险人身份证明文件，请补充身份证扫描件", CreatedAt: now.AddDate(0, 0, -3)},
				}
			},
			noteFn: func(o models.PatrolOrder) []models.AuditNote {
				return []models.AuditNote{
					{PatrolOrderID: o.ID, NoteType: "supplement", Content: "缺少被保险人身份证明文件，请补充身份证扫描件", OperatorID: "underwriter_01", OperatorName: "核保专员-李", CreatedAt: now.AddDate(0, 0, -3)},
				}
			},
		},
		{
			order: models.PatrolOrder{
				OrderNo: fmt.Sprintf("BX%d003", now.Year()), CustomerName: "王五",
				IDNumber: "110101198506063234", Phone: "13800138003",
				InsuranceType: "寿险", InsuranceAmount: 1000000, Premium: 15600, InsurancePeriod: "30年",
				Status: "待审核", CurrentHandlerID: "underwriter_01", CurrentHandler: "核保专员-李",
				CreatorID: "cm_02", CreatorName: "客户经理-赵",
				Deadline: timePtr(now.AddDate(0, 0, -1)), Version: 1,
				AbnormalReason: "已逾期1天，需尽快处理",
				EvidenceUploaded: true,
				StartDate: &startDate, EndDate: &endDate,
				CreatedAt: now.AddDate(0, 0, -8), UpdatedAt: now.AddDate(0, 0, -6),
			},
			attachFn: func(oid uint) []models.Attachment {
				return []models.Attachment{
					{PatrolOrderID: oid, FileName: "投保单.pdf", FileType: "application/pdf", FileSize: 150000, Category: "application_form", IsEvidence: true, UploaderID: "cm_02", UploaderName: "客户经理-赵", CreatedAt: now.AddDate(0, 0, -8)},
					{PatrolOrderID: oid, FileName: "身份证扫描件.jpg", FileType: "image/jpeg", FileSize: 200000, Category: "id_card", IsEvidence: true, UploaderID: "cm_02", UploaderName: "客户经理-赵", CreatedAt: now.AddDate(0, 0, -8)},
					{PatrolOrderID: oid, FileName: "收入证明.pdf", FileType: "application/pdf", FileSize: 100000, Category: "income", IsEvidence: true, UploaderID: "cm_02", UploaderName: "客户经理-赵", CreatedAt: now.AddDate(0, 0, -7)},
				}
			},
			histFn: func(o models.PatrolOrder) []models.OrderHistory {
				return []models.OrderHistory{
					{PatrolOrderID: o.ID, Action: "submit", PreviousStatus: "", CurrentStatus: "待审核", OperatorID: "cm_02", OperatorName: "客户经理-赵", OperatorRole: "customer_manager", Remark: "提交投保申请", CreatedAt: o.CreatedAt},
				}
			},
			noteFn: func(o models.PatrolOrder) []models.AuditNote {
				return []models.AuditNote{
					{PatrolOrderID: o.ID, NoteType: "abnormal", Content: "已逾期1天，需尽快处理", OperatorID: "system", OperatorName: "系统", CreatedAt: now},
				}
			},
		},
		{
			order: models.PatrolOrder{
				OrderNo: fmt.Sprintf("BX%d004", now.Year()), CustomerName: "赵六",
				IDNumber: "110101197809094234", Phone: "13800138004",
				InsuranceType: "医疗险", InsuranceAmount: 300000, Premium: 3200, InsurancePeriod: "1年",
				Status: "审核通过", CurrentHandlerID: "bo_01", CurrentHandler: "业务负责人-陈",
				CreatorID: "cm_01", CreatorName: "客户经理-王",
				Deadline: timePtr(now.AddDate(0, 0, 5)), Version: 1,
				EvidenceUploaded: true,
				StartDate: &startDate, EndDate: &endDate,
				CreatedAt: now.AddDate(0, 0, -6), UpdatedAt: now.AddDate(0, 0, -4),
			},
			attachFn: func(oid uint) []models.Attachment {
				return []models.Attachment{
					{PatrolOrderID: oid, FileName: "投保单.pdf", FileType: "application/pdf", FileSize: 150000, Category: "application_form", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -6)},
					{PatrolOrderID: oid, FileName: "身份证正反面.jpg", FileType: "image/jpeg", FileSize: 200000, Category: "id_card", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -6)},
					{PatrolOrderID: oid, FileName: "收入证明.pdf", FileType: "application/pdf", FileSize: 100000, Category: "income", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -5)},
					{PatrolOrderID: oid, FileName: "出单确认单.pdf", FileType: "application/pdf", FileSize: 80000, Category: "policy_confirm", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -4)},
				}
			},
			histFn: func(o models.PatrolOrder) []models.OrderHistory {
				return []models.OrderHistory{
					{PatrolOrderID: o.ID, Action: "submit", PreviousStatus: "", CurrentStatus: "待审核", OperatorID: "cm_01", OperatorName: "客户经理-王", OperatorRole: "customer_manager", Remark: "提交投保申请", CreatedAt: o.CreatedAt},
					{PatrolOrderID: o.ID, Action: "approve", PreviousStatus: "待审核", CurrentStatus: "审核通过", OperatorID: "underwriter_01", OperatorName: "核保专员-李", OperatorRole: "underwriter", Remark: "核保审核通过，待业务负责人复核出单证据", CreatedAt: now.AddDate(0, 0, -4)},
				}
			},
			noteFn: func(o models.PatrolOrder) []models.AuditNote { return nil },
		},
		{
			order: models.PatrolOrder{
				OrderNo: fmt.Sprintf("BX%d005", now.Year()), CustomerName: "钱七",
				IDNumber: "110101199512125234", Phone: "13800138005",
				InsuranceType: "重疾险", InsuranceAmount: 800000, Premium: 12800, InsurancePeriod: "25年",
				Status: "审核通过", CurrentHandlerID: "bo_01", CurrentHandler: "业务负责人-陈",
				CreatorID: "cm_02", CreatorName: "客户经理-赵",
				Deadline: timePtr(now.AddDate(0, 0, -2)), Version: 1,
				EvidenceUploaded: true, AbnormalReason: "出单确认已逾期2天",
				StartDate: &startDate, EndDate: &endDate,
				CreatedAt: now.AddDate(0, 0, -10), UpdatedAt: now.AddDate(0, 0, -5),
			},
			attachFn: func(oid uint) []models.Attachment {
				return []models.Attachment{
					{PatrolOrderID: oid, FileName: "投保单.pdf", FileType: "application/pdf", FileSize: 150000, Category: "application_form", IsEvidence: true, UploaderID: "cm_02", UploaderName: "客户经理-赵", CreatedAt: now.AddDate(0, 0, -10)},
					{PatrolOrderID: oid, FileName: "身份证正反面.jpg", FileType: "image/jpeg", FileSize: 200000, Category: "id_card", IsEvidence: true, UploaderID: "cm_02", UploaderName: "客户经理-赵", CreatedAt: now.AddDate(0, 0, -10)},
					{PatrolOrderID: oid, FileName: "收入证明.pdf", FileType: "application/pdf", FileSize: 100000, Category: "income", IsEvidence: true, UploaderID: "cm_02", UploaderName: "客户经理-赵", CreatedAt: now.AddDate(0, 0, -9)},
					{PatrolOrderID: oid, FileName: "出单确认单.pdf", FileType: "application/pdf", FileSize: 80000, Category: "policy_confirm", IsEvidence: true, UploaderID: "cm_02", UploaderName: "客户经理-赵", CreatedAt: now.AddDate(0, 0, -5)},
				}
			},
			histFn: func(o models.PatrolOrder) []models.OrderHistory {
				return []models.OrderHistory{
					{PatrolOrderID: o.ID, Action: "submit", PreviousStatus: "", CurrentStatus: "待审核", OperatorID: "cm_02", OperatorName: "客户经理-赵", OperatorRole: "customer_manager", Remark: "提交投保申请", CreatedAt: o.CreatedAt},
					{PatrolOrderID: o.ID, Action: "approve", PreviousStatus: "待审核", CurrentStatus: "审核通过", OperatorID: "underwriter_01", OperatorName: "核保专员-李", OperatorRole: "underwriter", Remark: "核保审核通过", CreatedAt: now.AddDate(0, 0, -5)},
				}
			},
			noteFn: func(o models.PatrolOrder) []models.AuditNote {
				return []models.AuditNote{
					{PatrolOrderID: o.ID, NoteType: "abnormal", Content: "出单确认已逾期2天", OperatorID: "system", OperatorName: "系统", CreatedAt: now},
				}
			},
		},
		{
			order: models.PatrolOrder{
				OrderNo: fmt.Sprintf("BX%d006", now.Year()), CustomerName: "孙八",
				IDNumber: "110101198811116234", Phone: "13800138006",
				InsuranceType: "车险", InsuranceAmount: 300000, Premium: 4500, InsurancePeriod: "1年",
				Status: "已同步", CurrentHandlerID: "bo_01", CurrentHandler: "业务负责人-陈",
				CreatorID: "cm_01", CreatorName: "客户经理-王",
				Deadline: timePtr(now.AddDate(0, 0, 10)), Version: 1,
				EvidenceUploaded: true, ConfirmEvidence: true,
				StartDate: &startDate, EndDate: &endDate,
				CreatedAt: now.AddDate(0, 0, -15), UpdatedAt: now.AddDate(0, 0, -6),
			},
			attachFn: func(oid uint) []models.Attachment {
				return []models.Attachment{
					{PatrolOrderID: oid, FileName: "投保单.pdf", FileType: "application/pdf", FileSize: 150000, Category: "application_form", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -15)},
					{PatrolOrderID: oid, FileName: "身份证正反面.jpg", FileType: "image/jpeg", FileSize: 200000, Category: "id_card", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -15)},
					{PatrolOrderID: oid, FileName: "收入证明.pdf", FileType: "application/pdf", FileSize: 100000, Category: "income", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -14)},
					{PatrolOrderID: oid, FileName: "出单确认单.pdf", FileType: "application/pdf", FileSize: 80000, Category: "policy_confirm", IsEvidence: true, UploaderID: "bo_01", UploaderName: "业务负责人-陈", CreatedAt: now.AddDate(0, 0, -7)},
				}
			},
			histFn: func(o models.PatrolOrder) []models.OrderHistory {
				return []models.OrderHistory{
					{PatrolOrderID: o.ID, Action: "submit", PreviousStatus: "", CurrentStatus: "待审核", OperatorID: "cm_01", OperatorName: "客户经理-王", OperatorRole: "customer_manager", Remark: "提交投保申请", CreatedAt: o.CreatedAt},
					{PatrolOrderID: o.ID, Action: "approve", PreviousStatus: "待审核", CurrentStatus: "审核通过", OperatorID: "underwriter_01", OperatorName: "核保专员-李", OperatorRole: "underwriter", Remark: "核保审核通过", CreatedAt: now.AddDate(0, 0, -10)},
					{PatrolOrderID: o.ID, Action: "sync", PreviousStatus: "审核通过", CurrentStatus: "已同步", OperatorID: "bo_01", OperatorName: "业务负责人-陈", OperatorRole: "business_owner", Remark: "出单确认证据核验完成，系统同步成功", CreatedAt: now.AddDate(0, 0, -6)},
				}
			},
			noteFn: func(o models.PatrolOrder) []models.AuditNote { return nil },
		},
		{
			order: models.PatrolOrder{
				OrderNo: fmt.Sprintf("BX%d007", now.Year()), CustomerName: "周九",
				IDNumber: "110101199102027234", Phone: "13800138007",
				InsuranceType: "意外险", InsuranceAmount: 500000, Premium: 2800, InsurancePeriod: "1年",
				Status: "待审核", CurrentHandlerID: "underwriter_01", CurrentHandler: "核保专员-李",
				CreatorID: "cm_02", CreatorName: "客户经理-赵",
				Deadline: timePtr(now.AddDate(0, 0, 1)), Version: 1,
				EvidenceUploaded: true,
				StartDate: &startDate, EndDate: &endDate,
				CreatedAt: now.AddDate(0, 0, -3), UpdatedAt: now.AddDate(0, 0, -2),
			},
			attachFn: func(oid uint) []models.Attachment {
				return []models.Attachment{
					{PatrolOrderID: oid, FileName: "投保单.pdf", FileType: "application/pdf", FileSize: 150000, Category: "application_form", IsEvidence: true, UploaderID: "cm_02", UploaderName: "客户经理-赵", CreatedAt: now.AddDate(0, 0, -3)},
					{PatrolOrderID: oid, FileName: "身份证正反面.jpg", FileType: "image/jpeg", FileSize: 200000, Category: "id_card", IsEvidence: true, UploaderID: "cm_02", UploaderName: "客户经理-赵", CreatedAt: now.AddDate(0, 0, -3)},
					{PatrolOrderID: oid, FileName: "收入证明.pdf", FileType: "application/pdf", FileSize: 100000, Category: "income", IsEvidence: true, UploaderID: "cm_02", UploaderName: "客户经理-赵", CreatedAt: now.AddDate(0, 0, -2)},
				}
			},
			histFn: func(o models.PatrolOrder) []models.OrderHistory {
				return []models.OrderHistory{
					{PatrolOrderID: o.ID, Action: "submit", PreviousStatus: "", CurrentStatus: "待审核", OperatorID: "cm_02", OperatorName: "客户经理-赵", OperatorRole: "customer_manager", Remark: "提交投保申请", CreatedAt: o.CreatedAt},
				}
			},
			noteFn: func(o models.PatrolOrder) []models.AuditNote { return nil },
		},
		{
			order: models.PatrolOrder{
				OrderNo: fmt.Sprintf("BX%d008", now.Year()), CustomerName: "吴十",
				IDNumber: "110101198707078234", Phone: "13800138008",
				InsuranceType: "财险", InsuranceAmount: 2000000, Premium: 8800, InsurancePeriod: "1年",
				Status: "审核退回", CurrentHandlerID: "cm_01", CurrentHandler: "客户经理-王",
				CreatorID: "cm_01", CreatorName: "客户经理-王",
				Deadline: timePtr(now.AddDate(0, 0, 15)), Version: 1,
				RejectReason: "投保人经济状况证明材料不足，且健康告知存在未披露项",
				EvidenceUploaded: true,
				StartDate: &startDate, EndDate: &endDate,
				CreatedAt: now.AddDate(0, 0, -12), UpdatedAt: now.AddDate(0, 0, -5),
			},
			attachFn: func(oid uint) []models.Attachment {
				return []models.Attachment{
					{PatrolOrderID: oid, FileName: "投保单.pdf", FileType: "application/pdf", FileSize: 150000, Category: "application_form", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -12)},
					{PatrolOrderID: oid, FileName: "身份证正反面.jpg", FileType: "image/jpeg", FileSize: 200000, Category: "id_card", IsEvidence: true, UploaderID: "cm_01", UploaderName: "客户经理-王", CreatedAt: now.AddDate(0, 0, -12)},
				}
			},
			histFn: func(o models.PatrolOrder) []models.OrderHistory {
				return []models.OrderHistory{
					{PatrolOrderID: o.ID, Action: "submit", PreviousStatus: "", CurrentStatus: "待审核", OperatorID: "cm_01", OperatorName: "客户经理-王", OperatorRole: "customer_manager", Remark: "提交投保申请", CreatedAt: o.CreatedAt},
					{PatrolOrderID: o.ID, Action: "reject", PreviousStatus: "待审核", CurrentStatus: "审核退回", OperatorID: "underwriter_01", OperatorName: "核保专员-李", OperatorRole: "underwriter", Remark: "审核不通过", AbnormalReason: "投保人经济状况证明材料不足，且健康告知存在未披露项", CreatedAt: now.AddDate(0, 0, -5)},
				}
			},
			noteFn: func(o models.PatrolOrder) []models.AuditNote {
				return []models.AuditNote{
					{PatrolOrderID: o.ID, NoteType: "reject", Content: "投保人经济状况证明材料不足，且健康告知存在未披露项", OperatorID: "underwriter_01", OperatorName: "核保专员-李", CreatedAt: now.AddDate(0, 0, -5)},
				}
			},
		},
	}

	for _, s := range seeds {
		if err := DB.Create(&s.order).Error; err != nil {
			return fmt.Errorf("seed order %s: %w", s.order.OrderNo, err)
		}
		for _, a := range s.attachFn(s.order.ID) {
			if err := DB.Create(&a).Error; err != nil {
				return fmt.Errorf("seed attachment: %w", err)
			}
		}
		for _, h := range s.histFn(s.order) {
			if err := DB.Create(&h).Error; err != nil {
				return fmt.Errorf("seed history: %w", err)
			}
		}
		for _, n := range s.noteFn(s.order) {
			if err := DB.Create(&n).Error; err != nil {
				return fmt.Errorf("seed audit note: %w", err)
			}
		}
	}

	return nil
}

func timePtr(t time.Time) *time.Time { return &t }
