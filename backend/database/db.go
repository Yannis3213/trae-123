package database

import (
	"fmt"
	"insurance-system/models"
	"math/rand"
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
	orders := []models.PatrolOrder{
		{
			OrderNo:          fmt.Sprintf("BX%d001", now.Year()),
			CustomerName:     "张三",
			IDNumber:         "110101199001011234",
			Phone:            "13800138001",
			InsuranceType:    "重疾险",
			InsuranceAmount:  500000,
			Premium:          8800,
			InsurancePeriod:  "20年",
			Status:           "待审核",
			CurrentHandlerID: "underwriter_01",
			CurrentHandler:   "核保专员-李",
			CreatorID:        "cm_01",
			CreatorName:      "客户经理-王",
			Deadline:         timePtr(now.AddDate(0, 0, 7)),
			Version:          1,
		},
		{
			OrderNo:          fmt.Sprintf("BX%d002", now.Year()),
			CustomerName:     "李四",
			IDNumber:         "110101199203032234",
			Phone:            "13800138002",
			InsuranceType:    "意外险",
			InsuranceAmount:  200000,
			Premium:          1200,
			InsurancePeriod:  "1年",
			Status:           "待补正",
			CurrentHandlerID: "cm_01",
			CurrentHandler:   "客户经理-王",
			CreatorID:        "cm_01",
			CreatorName:      "客户经理-王",
			Deadline:         timePtr(now.AddDate(0, 0, 2)),
			Version:          2,
			SupplementReason: "缺少被保险人身份证明文件，请补充身份证扫描件",
		},
		{
			OrderNo:          fmt.Sprintf("BX%d003", now.Year()),
			CustomerName:     "王五",
			IDNumber:         "110101198506063234",
			Phone:            "13800138003",
			InsuranceType:    "寿险",
			InsuranceAmount:  1000000,
			Premium:          15600,
			InsurancePeriod:  "30年",
			Status:           "待审核",
			CurrentHandlerID: "underwriter_01",
			CurrentHandler:   "核保专员-李",
			CreatorID:        "cm_02",
			CreatorName:      "客户经理-赵",
			Deadline:         timePtr(now.AddDate(0, 0, -1)),
			Version:          1,
			AbnormalReason:   "已逾期1天，需尽快处理",
		},
		{
			OrderNo:          fmt.Sprintf("BX%d004", now.Year()),
			CustomerName:     "赵六",
			IDNumber:         "110101197809094234",
			Phone:            "13800138004",
			InsuranceType:    "医疗险",
			InsuranceAmount:  300000,
			Premium:          3200,
			InsurancePeriod:  "1年",
			Status:           "审核通过",
			CurrentHandlerID: "bo_01",
			CurrentHandler:   "业务负责人-陈",
			CreatorID:        "cm_01",
			CreatorName:      "客户经理-王",
			Deadline:         timePtr(now.AddDate(0, 0, 5)),
			Version:          1,
			EvidenceUploaded: true,
		},
		{
			OrderNo:          fmt.Sprintf("BX%d005", now.Year()),
			CustomerName:     "钱七",
			IDNumber:         "110101199512125234",
			Phone:            "13800138005",
			InsuranceType:    "重疾险",
			InsuranceAmount:  800000,
			Premium:          12800,
			InsurancePeriod:  "25年",
			Status:           "审核通过",
			CurrentHandlerID: "bo_01",
			CurrentHandler:   "业务负责人-陈",
			CreatorID:        "cm_02",
			CreatorName:      "客户经理-赵",
			Deadline:         timePtr(now.AddDate(0, 0, -2)),
			Version:          1,
			EvidenceUploaded: true,
			AbnormalReason:   "出单确认已逾期2天",
		},
		{
			OrderNo:          fmt.Sprintf("BX%d006", now.Year()),
			CustomerName:     "孙八",
			IDNumber:         "110101198811116234",
			Phone:            "13800138006",
			InsuranceType:    "车险",
			InsuranceAmount:  300000,
			Premium:          4500,
			InsurancePeriod:  "1年",
			Status:           "已同步",
			CurrentHandlerID: "bo_01",
			CurrentHandler:   "业务负责人-陈",
			CreatorID:        "cm_01",
			CreatorName:      "客户经理-王",
			Deadline:         timePtr(now.AddDate(0, 0, 10)),
			Version:          1,
			EvidenceUploaded: true,
			ConfirmEvidence:  true,
		},
		{
			OrderNo:          fmt.Sprintf("BX%d007", now.Year()),
			CustomerName:     "周九",
			IDNumber:         "110101199102027234",
			Phone:            "13800138007",
			InsuranceType:    "意外险",
			InsuranceAmount:  500000,
			Premium:          2800,
			InsurancePeriod:  "1年",
			Status:           "待审核",
			CurrentHandlerID: "underwriter_01",
			CurrentHandler:   "核保专员-李",
			CreatorID:        "cm_02",
			CreatorName:      "客户经理-赵",
			Deadline:         timePtr(now.AddDate(0, 0, 1)),
			Version:          1,
		},
		{
			OrderNo:          fmt.Sprintf("BX%d008", now.Year()),
			CustomerName:     "吴十",
			IDNumber:         "110101198707078234",
			Phone:            "13800138008",
			InsuranceType:    "财险",
			InsuranceAmount:  2000000,
			Premium:          8800,
			InsurancePeriod:  "1年",
			Status:           "审核退回",
			CurrentHandlerID: "cm_01",
			CurrentHandler:   "客户经理-王",
			CreatorID:        "cm_01",
			CreatorName:      "客户经理-王",
			Deadline:         timePtr(now.AddDate(0, 0, 15)),
			Version:          1,
			RejectReason:     "投保人经济状况证明材料不足，且健康告知存在未披露项",
		},
	}

	for i := range orders {
		start := now
		end := now.AddDate(1, 0, 0)
		orders[i].StartDate = &start
		orders[i].EndDate = &end
		orders[i].CreatedAt = now.AddDate(0, 0, -rand.Intn(20))
		orders[i].UpdatedAt = now.AddDate(0, 0, -rand.Intn(10))
		if err := DB.Create(&orders[i]).Error; err != nil {
			return err
		}

		seedHistory(orders[i])
		seedAttachments(orders[i])
		seedAuditNotes(orders[i])
	}

	return nil
}

func seedHistory(order models.PatrolOrder) {
	now := time.Now()
	histories := []models.OrderHistory{
		{
			PatrolOrderID:  order.ID,
			Action:         "submit",
			PreviousStatus: "",
			CurrentStatus:  "待审核",
			OperatorID:     order.CreatorID,
			OperatorName:   order.CreatorName,
			OperatorRole:   "customer_manager",
			Remark:         "提交投保申请",
			CreatedAt:      order.CreatedAt,
		},
	}

	switch order.Status {
	case "待补正":
		histories = append(histories, models.OrderHistory{
			PatrolOrderID:  order.ID,
			Action:         "reject",
			PreviousStatus: "待审核",
			CurrentStatus:  "待补正",
			OperatorID:     "underwriter_01",
			OperatorName:   "核保专员-李",
			OperatorRole:   "underwriter",
			Remark:         "资料不齐，退回补正",
			AbnormalReason: order.SupplementReason,
			CreatedAt:      now.AddDate(0, 0, -3),
		})
	case "审核退回":
		histories = append(histories, models.OrderHistory{
			PatrolOrderID:  order.ID,
			Action:         "reject",
			PreviousStatus: "待审核",
			CurrentStatus:  "审核退回",
			OperatorID:     "underwriter_01",
			OperatorName:   "核保专员-李",
			OperatorRole:   "underwriter",
			Remark:         "审核不通过",
			AbnormalReason: order.RejectReason,
			CreatedAt:      now.AddDate(0, 0, -5),
		})
	case "审核通过":
		histories = append(histories, models.OrderHistory{
			PatrolOrderID:  order.ID,
			Action:         "approve",
			PreviousStatus: "待审核",
			CurrentStatus:  "审核通过",
			OperatorID:     "underwriter_01",
			OperatorName:   "核保专员-李",
			OperatorRole:   "underwriter",
			Remark:         "核保审核通过，待业务负责人复核出单证据",
			CreatedAt:      now.AddDate(0, 0, -4),
		})
	case "已同步":
		histories = append(histories, models.OrderHistory{
			PatrolOrderID:  order.ID,
			Action:         "approve",
			PreviousStatus: "待审核",
			CurrentStatus:  "审核通过",
			OperatorID:     "underwriter_01",
			OperatorName:   "核保专员-李",
			OperatorRole:   "underwriter",
			Remark:         "核保审核通过",
			CreatedAt:      now.AddDate(0, 0, -10),
		}, models.OrderHistory{
			PatrolOrderID:  order.ID,
			Action:         "sync",
			PreviousStatus: "审核通过",
			CurrentStatus:  "已同步",
			OperatorID:     "bo_01",
			OperatorName:   "业务负责人-陈",
			OperatorRole:   "business_owner",
			Remark:         "出单确认证据核验完成，系统同步成功",
			CreatedAt:      now.AddDate(0, 0, -6),
		})
	}

	for _, h := range histories {
		DB.Create(&h)
	}
}

func seedAttachments(order models.PatrolOrder) {
	baseList := []struct {
		name     string
		cat      string
		evidence bool
	}{
		{"投保单.pdf", "application_form", true},
		{"身份证正反面.jpg", "id_card", true},
	}

	if order.Status != "待补正" && order.Status != "审核退回" {
		baseList = append(baseList, struct {
			name     string
			cat      string
			evidence bool
		}{{"收入证明.pdf", "income", true})
	}

	if order.EvidenceUploaded {
		baseList = append(baseList, struct {
			name     string
			cat      string
			evidence bool
		}{{"出单确认单.pdf", "policy_confirm", true})
	}

	for idx, a := range baseList {
		DB.Create(&models.Attachment{
			PatrolOrderID: order.ID,
			FileName:      a.name,
			FileType:      getFileType(a.name),
			FileSize:      int64(100000 + idx*50000),
			Category:      a.cat,
			IsEvidence:    a.evidence,
			UploaderID:    order.CreatorID,
			UploaderName:  order.CreatorName,
			CreatedAt:     order.CreatedAt.AddDate(0, 0, idx),
		})
	}
}

func seedAuditNotes(order models.PatrolOrder) {
	if order.AbnormalReason != "" {
		DB.Create(&models.AuditNote{
			PatrolOrderID: order.ID,
			NoteType:      "abnormal",
			Content:       order.AbnormalReason,
			OperatorID:    "system",
			OperatorName:  "系统",
			CreatedAt:     time.Now(),
		})
	}
}

func timePtr(t time.Time) *time.Time { return &t }

func getFileType(name string) string {
	if len(name) < 4 {
		return "application/octet-stream"
	}
	ext := name[len(name)-4:]
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".jpg", "jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	default:
		return "application/octet-stream"
	}
}
