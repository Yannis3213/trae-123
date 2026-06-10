package database

import (
	"log"
	"time"

	"cross-border-order-system/internal/config"
	"cross-border-order-system/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(cfg *config.Config) {
	var err error
	DB, err = gorm.Open(sqlite.Open(cfg.SQLitePath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	err = DB.AutoMigrate(
		&models.User{},
		&models.CrossBorderOrder{},
		&models.OrderAttachment{},
		&models.ProcessingRecord{},
		&models.AuditNote{},
		&models.ExceptionLog{},
	)
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	seedData()
}

func hashPassword(password string) string {
	hashed, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hashed)
}

func seedData() {
	var userCount int64
	DB.Model(&models.User{}).Count(&userCount)
	if userCount > 0 {
		return
	}

	users := []models.User{
		{Username: "ops01", Password: hashPassword("ops123"), Name: "张运营", Role: models.RoleOpsSpecialist},
		{Username: "warehouse01", Password: hashPassword("wh123"), Name: "李仓管", Role: models.RoleWarehouseMgr},
		{Username: "shop01", Password: hashPassword("shop123"), Name: "王店长", Role: models.RoleShopOwner},
	}
	for i := range users {
		DB.Create(&users[i])
	}

	now := time.Now()
	past := now.AddDate(0, 0, -3)
	soon := now.AddDate(0, 0, 2)
	later := now.AddDate(0, 0, 7)
	overdue := now.AddDate(0, 0, -1)

	orders := []models.CrossBorderOrder{
		{
			OrderNo:          "CB20240601001",
			ShopName:         "全球优选旗舰店",
			ProductName:      "智能手表 Pro Max",
			SKU:              "SM-WATCH-PRO-001",
			Quantity:         150,
			Amount:           45000.00,
			Country:          "美国",
			CurrentStage:     models.StageListing,
			CurrentStatus:    models.StatusPending,
			CurrentHandlerID: users[0].ID,
			CreatedByID:      users[0].ID,
			ListingDueAt:     &soon,
			InventoryDueAt:   &later,
			FulfillmentDueAt: &later,
			Version:          1,
		},
		{
			OrderNo:          "CB20240601002",
			ShopName:         "海淘精品店",
			ProductName:      "无线蓝牙耳机",
			SKU:              "EL-BT-EAR-002",
			Quantity:         500,
			Amount:           85000.00,
			Country:          "日本",
			CurrentStage:     models.StageListing,
			CurrentStatus:    models.StatusSubmitted,
			CurrentHandlerID: users[1].ID,
			CreatedByID:      users[0].ID,
			ListingData:      `{"title":"无线蓝牙耳机 降噪版","description":"高品质主动降噪...","images":["img1.jpg","img2.jpg"]}`,
			ListingDueAt:     &soon,
			InventoryDueAt:   &later,
			FulfillmentDueAt: &later,
			Version:          1,
		},
		{
			OrderNo:          "CB20240601003",
			ShopName:         "环球购官方店",
			ProductName:      "便携咖啡机",
			SKU:              "HW-COFFEE-003",
			Quantity:         80,
			Amount:           24000.00,
			Country:          "德国",
			CurrentStage:     models.StageListing,
			CurrentStatus:    models.StatusReturned,
			IsResubmitted:    false,
			CurrentHandlerID: users[0].ID,
			CreatedByID:      users[0].ID,
			ListingData:      `{"title":"便携咖啡机","description":"缺少详细参数..."}`,
			ListingDueAt:     &overdue,
			InventoryDueAt:   &soon,
			FulfillmentDueAt: &later,
			Version:          2,
		},
		{
			OrderNo:          "CB20240601004",
			ShopName:         "全球优选旗舰店",
			ProductName:      "高端护肤套装",
			SKU:              "BT-SKIN-SET-004",
			Quantity:         200,
			Amount:           120000.00,
			Country:          "法国",
			CurrentStage:     models.StageInventory,
			CurrentStatus:    models.StatusPending,
			CurrentHandlerID: users[0].ID,
			CreatedByID:      users[0].ID,
			ListingData:      `{"title":"高端护肤套装礼盒","description":"法国进口..."}`,
			ListingDueAt:     &past,
			InventoryDueAt:   &soon,
			FulfillmentDueAt: &later,
			Version:          1,
		},
		{
			OrderNo:          "CB20240601005",
			ShopName:         "海淘精品店",
			ProductName:      "儿童益智玩具套装",
			SKU:              "TY-TOY-SET-005",
			Quantity:         300,
			Amount:           54000.00,
			Country:          "澳大利亚",
			CurrentStage:     models.StageInventory,
			CurrentStatus:    models.StatusSubmitted,
			CurrentHandlerID: users[1].ID,
			CreatedByID:      users[0].ID,
			ListingData:      `{"title":"儿童益智玩具套装","description":"3-6岁早教..."}`,
			InventoryData:    `{"warehouse":"深圳保税仓A区","stockQty":300,"location":"A-12-03"}`,
			ListingDueAt:     &past,
			InventoryDueAt:   &soon,
			FulfillmentDueAt: &later,
			Version:          1,
		},
		{
			OrderNo:          "CB20240601006",
			ShopName:         "环球购官方店",
			ProductName:      "运动智能手环",
			SKU:              "SP-BAND-006",
			Quantity:         1000,
			Amount:           180000.00,
			Country:          "加拿大",
			CurrentStage:     models.StageInventory,
			CurrentStatus:    models.StatusReturned,
			IsResubmitted:    true,
			ResubmitCount:    1,
			CurrentHandlerID: users[0].ID,
			CreatedByID:      users[0].ID,
			ListingData:      `{"title":"运动智能手环","description":"心率监测..."}`,
			InventoryData:    `{"warehouse":"广州仓","stockQty":"待确认","location":""}`,
			ListingDueAt:     &past,
			InventoryDueAt:   &overdue,
			FulfillmentDueAt: &soon,
			Version:          3,
		},
		{
			OrderNo:          "CB20240601007",
			ShopName:         "全球优选旗舰店",
			ProductName:      "进口保健品礼盒",
			SKU:              "HP-SUPP-007",
			Quantity:         250,
			Amount:           75000.00,
			Country:          "新西兰",
			CurrentStage:     models.StageFulfillment,
			CurrentStatus:    models.StatusPending,
			CurrentHandlerID: users[0].ID,
			CreatedByID:      users[0].ID,
			ListingData:      `{"title":"进口保健品礼盒","description":"新西兰直邮..."}`,
			InventoryData:    `{"warehouse":"香港仓","stockQty":250,"location":"B-05-01"}`,
			ListingDueAt:     &past,
			InventoryDueAt:   &past,
			FulfillmentDueAt: &soon,
			Version:          1,
		},
		{
			OrderNo:          "CB20240601008",
			ShopName:         "海淘精品店",
			ProductName:      "轻奢女包经典款",
			SKU:              "LU-BAG-008",
			Quantity:         50,
			Amount:           150000.00,
			Country:          "意大利",
			CurrentStage:     models.StageFulfillment,
			CurrentStatus:    models.StatusSubmitted,
			CurrentHandlerID: users[2].ID,
			CreatedByID:      users[0].ID,
			ListingData:      `{"title":"轻奢女包经典款","description":"意大利真皮..."}`,
			InventoryData:    `{"warehouse":"上海保税仓","stockQty":50,"location":"C-01-08"}`,
			FulfillmentData:  `{"logistics":"DHL国际快递","tracking":"已生成运单号","customs":"报关资料齐全"}`,
			ListingDueAt:     &past,
			InventoryDueAt:   &past,
			FulfillmentDueAt: &soon,
			Version:          1,
		},
		{
			OrderNo:          "CB20240601009",
			ShopName:         "环球购官方店",
			ProductName:      "进口婴幼儿奶粉",
			SKU:              "BB-MILK-009",
			Quantity:         600,
			Amount:           90000.00,
			Country:          "荷兰",
			CurrentStage:     models.StageFulfillment,
			CurrentStatus:    models.StatusReturned,
			CurrentHandlerID: users[0].ID,
			CreatedByID:      users[0].ID,
			ListingData:      `{"title":"进口婴幼儿奶粉","description":"荷兰原装..."}`,
			InventoryData:    `{"warehouse":"杭州保税仓","stockQty":600,"location":"D-02-05"}`,
			FulfillmentData:  `{"logistics":"","tracking":"","customs":"缺少质检报告"}`,
			ListingDueAt:     &past,
			InventoryDueAt:   &past,
			FulfillmentDueAt: &overdue,
			Version:          2,
		},
		{
			OrderNo:          "CB20240601010",
			ShopName:         "全球优选旗舰店",
			ProductName:      "数码配件大礼包",
			SKU:              "DG-ACC-010",
			Quantity:         400,
			Amount:           36000.00,
			Country:          "韩国",
			CurrentStage:     models.StageFulfillment,
			CurrentStatus:    models.StatusCompleted,
			IsResubmitted:    true,
			ResubmitCount:    2,
			CurrentHandlerID: "",
			CreatedByID:      users[0].ID,
			ListingData:      `{"title":"数码配件大礼包","description":"充电器+数据线+贴膜..."}`,
			InventoryData:    `{"warehouse":"宁波保税仓","stockQty":400,"location":"E-03-02"}`,
			FulfillmentData:  `{"logistics":"顺丰国际","tracking":"SF1234567890","customs":"已完成清关"}`,
			ListingDueAt:     &past,
			InventoryDueAt:   &past,
			FulfillmentDueAt: &past,
			Version:          4,
		},
	}

	for i := range orders {
		DB.Create(&orders[i])
	}

	records := []models.ProcessingRecord{
		{
			OrderID:    orders[1].ID,
			Stage:      models.StageListing,
			Action:     "submit",
			FromStatus: models.StatusPending,
			ToStatus:   models.StatusSubmitted,
			OperatorID: users[0].ID,
			Note:       "运营专员提交商品刊登信息",
			CreatedAt:  now.Add(-2 * time.Hour),
		},
		{
			OrderID:         orders[2].ID,
			Stage:           models.StageListing,
			Action:          "submit",
			FromStatus:      models.StatusPending,
			ToStatus:        models.StatusSubmitted,
			OperatorID:      users[0].ID,
			Note:            "运营专员首次提交商品刊登",
			CreatedAt:       now.Add(-48 * time.Hour),
		},
		{
			OrderID:         orders[2].ID,
			Stage:           models.StageListing,
			Action:          "return",
			FromStatus:      models.StatusSubmitted,
			ToStatus:        models.StatusReturned,
			OperatorID:      users[1].ID,
			Note:            "仓配主管退回：缺少商品详细参数和高清图片",
			IsException:     true,
			ExceptionReason: "材料不完整：缺少商品规格参数表、缺少3张以上高清白底图",
			CreatedAt:       now.Add(-24 * time.Hour),
		},
		{
			OrderID:         orders[2].ID,
			Stage:           models.StageListing,
			Action:          "resubmit",
			FromStatus:      models.StatusReturned,
			ToStatus:        models.StatusReturned,
			OperatorID:      users[0].ID,
			Note:            "运营专员正在补正材料",
			CreatedAt:       now.Add(-2 * time.Hour),
		},
		{
			OrderID:    orders[3].ID,
			Stage:      models.StageListing,
			Action:     "submit",
			FromStatus: models.StatusPending,
			ToStatus:   models.StatusSubmitted,
			OperatorID: users[0].ID,
			CreatedAt:  now.Add(-72 * time.Hour),
		},
		{
			OrderID:    orders[3].ID,
			Stage:      models.StageListing,
			Action:     "approve",
			FromStatus: models.StatusSubmitted,
			ToStatus:   models.StatusApproved,
			OperatorID: users[1].ID,
			Note:       "仓配主管审核通过，进入库存同步环节",
			CreatedAt:  now.Add(-60 * time.Hour),
		},
		{
			OrderID:    orders[4].ID,
			Stage:      models.StageListing,
			Action:     "approve",
			FromStatus: models.StatusSubmitted,
			ToStatus:   models.StatusApproved,
			OperatorID: users[1].ID,
			CreatedAt:  now.Add(-96 * time.Hour),
		},
		{
			OrderID:    orders[4].ID,
			Stage:      models.StageInventory,
			Action:     "submit",
			FromStatus: models.StatusPending,
			ToStatus:   models.StatusSubmitted,
			OperatorID: users[0].ID,
			Note:       "运营专员提交库存同步信息",
			CreatedAt:  now.Add(-3 * time.Hour),
		},
		{
			OrderID:         orders[5].ID,
			Stage:           models.StageInventory,
			Action:          "return",
			FromStatus:      models.StatusSubmitted,
			ToStatus:        models.StatusReturned,
			OperatorID:      users[1].ID,
			Note:            "仓配主管退回：库存数量待确认，库位信息为空",
			IsException:     true,
			ExceptionReason: "数据冲突：库存数量格式错误，缺少货架库位编码",
			CreatedAt:       now.Add(-6 * time.Hour),
		},
		{
			OrderID:    orders[9].ID,
			Stage:      models.StageFulfillment,
			Action:     "approve",
			FromStatus: models.StatusSubmitted,
			ToStatus:   models.StatusCompleted,
			OperatorID: users[2].ID,
			Note:       "店铺负责人确认履约完成",
			CreatedAt:  now.Add(-24 * time.Hour),
		},
	}
	for i := range records {
		DB.Create(&records[i])
	}

	auditNotes := []models.AuditNote{
		{
			OrderID:  orders[2].ID,
			Stage:    models.StageListing,
			Content:  "请补充：1. 商品规格参数表（PDF）2. 高清白底图至少5张 3. 欧盟CE认证文件",
			AuthorID: users[1].ID,
		},
		{
			OrderID:  orders[5].ID,
			Stage:    models.StageInventory,
			Content:  "请确认实际库存数量并填写具体库位编码（如 A-01-03）",
			AuthorID: users[1].ID,
		},
		{
			OrderID:  orders[8].ID,
			Stage:    models.StageFulfillment,
			Content:  "缺少质检报告和原产地证明，请补充上传后再提交",
			AuthorID: users[2].ID,
		},
	}
	for i := range auditNotes {
		DB.Create(&auditNotes[i])
	}

	exceptions := []models.ExceptionLog{
		{
			OrderID:       orders[2].ID,
			Stage:         models.StageListing,
			ExceptionType: "missing_evidence",
			Reason:        "商品刊登材料不完整，缺少规格参数表和高清产品图",
			OperatorID:    users[1].ID,
			IsResolved:    false,
		},
		{
			OrderID:       orders[5].ID,
			Stage:         models.StageInventory,
			ExceptionType: "data_conflict",
			Reason:        "库存数据与实际不符，库位信息缺失",
			OperatorID:    users[1].ID,
			IsResolved:    false,
		},
		{
			OrderID:       orders[8].ID,
			Stage:         models.StageFulfillment,
			ExceptionType: "missing_evidence",
			Reason:        "履约材料缺少质检报告和原产地证明",
			OperatorID:    users[2].ID,
			IsResolved:    false,
		},
		{
			OrderID:       orders[5].ID,
			Stage:         models.StageInventory,
			ExceptionType: "timeout",
			Reason:        "库存同步环节已逾期1天未处理",
			OperatorID:    users[0].ID,
			IsResolved:    false,
		},
	}
	for i := range exceptions {
		DB.Create(&exceptions[i])
	}

	attachments := []models.OrderAttachment{
		{
			OrderID:      orders[1].ID,
			Stage:        models.StageListing,
			FileName:     "无线蓝牙耳机-规格参数表.pdf",
			FileType:     "application/pdf",
			FileURL:      "/attachments/earphone-spec.pdf",
			UploadedByID: users[0].ID,
			CreatedAt:    now.Add(-3 * time.Hour),
		},
		{
			OrderID:      orders[1].ID,
			Stage:        models.StageListing,
			FileName:     "产品高清白底图-5张.zip",
			FileType:     "application/zip",
			FileURL:      "/attachments/earphone-images.zip",
			UploadedByID: users[0].ID,
			CreatedAt:    now.Add(-3 * time.Hour),
		},
		{
			OrderID:      orders[2].ID,
			Stage:        models.StageListing,
			FileName:     "便携咖啡机-初稿说明.docx",
			FileType:     "application/docx",
			FileURL:      "/attachments/coffee-draft.docx",
			UploadedByID: users[0].ID,
			CreatedAt:    now.Add(-50 * time.Hour),
		},
		{
			OrderID:      orders[2].ID,
			Stage:        models.StageListing,
			FileName:     "便携咖啡机-3C认证证书.pdf",
			FileType:     "application/pdf",
			FileURL:      "/attachments/coffee-3c.pdf",
			UploadedByID: users[0].ID,
			CreatedAt:    now.Add(-3 * time.Hour),
		},
		{
			OrderID:      orders[4].ID,
			Stage:        models.StageInventory,
			FileName:     "深圳保税仓-入库单.pdf",
			FileType:     "application/pdf",
			FileURL:      "/attachments/toy-stockin.pdf",
			UploadedByID: users[0].ID,
			CreatedAt:    now.Add(-4 * time.Hour),
		},
		{
			OrderID:      orders[5].ID,
			Stage:        models.StageInventory,
			FileName:     "运动手环-库存盘点表.xlsx",
			FileType:     "application/xlsx",
			FileURL:      "/attachments/band-stock.xlsx",
			UploadedByID: users[0].ID,
			CreatedAt:    now.Add(-5 * time.Hour),
		},
		{
			OrderID:      orders[7].ID,
			Stage:        models.StageFulfillment,
			FileName:     "轻奢女包-报关单.pdf",
			FileType:     "application/pdf",
			FileURL:      "/attachments/bag-customs.pdf",
			UploadedByID: users[0].ID,
			CreatedAt:    now.Add(-2 * time.Hour),
		},
		{
			OrderID:      orders[7].ID,
			Stage:        models.StageFulfillment,
			FileName:     "DHL运单回执.pdf",
			FileType:     "application/pdf",
			FileURL:      "/attachments/bag-dhl.pdf",
			UploadedByID: users[0].ID,
			CreatedAt:    now.Add(-2 * time.Hour),
		},
		{
			OrderID:      orders[9].ID,
			Stage:        models.StageFulfillment,
			FileName:     "数码配件-质检报告.pdf",
			FileType:     "application/pdf",
			FileURL:      "/attachments/acc-qc.pdf",
			UploadedByID: users[0].ID,
			CreatedAt:    now.Add(-30 * time.Hour),
		},
	}
	for i := range attachments {
		DB.Create(&attachments[i])
	}

	supplementExceptions := []models.ExceptionLog{
		{
			OrderID:         orders[2].ID,
			Stage:           models.StageListing,
			ExceptionType:   "attachment_supplement",
			Reason:          "运营专员张运营补充上传了材料：便携咖啡机-3C认证证书.pdf",
			OperatorID:      users[0].ID,
			CorrectedAction: "",
			IsResolved:      false,
			CreatedAt:       now.Add(-3 * time.Hour),
		},
	}
	for i := range supplementExceptions {
		DB.Create(&supplementExceptions[i])
	}

	supplementNotes := []models.AuditNote{
		{
			OrderID:  orders[2].ID,
			Stage:    models.StageListing,
			Content:  "运营专员张运营补充上传了材料：便携咖啡机-3C认证证书.pdf，请仓配主管核对",
			AuthorID: users[0].ID,
			CreatedAt: now.Add(-3 * time.Hour),
		},
		{
			OrderID:   orders[0].ID,
			Stage:     models.StageListing,
			Content:   "提交被拦截：【缺材料】商品刊登环节未上传任何材料附件（如商品规格参数表、高清图片、品牌授权书等），请先在详情页点击「上传材料」补充后再提交",
			AuthorID:  users[0].ID,
			CreatedAt: now.Add(-2 * time.Hour),
		},
	}
	for i := range supplementNotes {
		DB.Create(&supplementNotes[i])
	}

	missingEvidenceRecords := []models.ProcessingRecord{
		{
			OrderID:         orders[0].ID,
			Stage:           models.StageListing,
			Action:          "submit",
			FromStatus:      models.StatusPending,
			ToStatus:        models.StatusPending,
			OperatorID:      users[0].ID,
			Note:            "提交被拦截：【缺材料】商品刊登环节未上传任何材料附件（如商品规格参数表、高清图片、品牌授权书等），请先在详情页点击「上传材料」补充后再提交",
			AttachmentIDs:   "",
			IsException:     true,
			ExceptionReason: "【缺材料】商品刊登环节未上传任何材料附件（如商品规格参数表、高清图片、品牌授权书等），请先在详情页点击「上传材料」补充后再提交",
			CreatedAt:       now.Add(-2 * time.Hour),
		},
	}
	for i := range missingEvidenceRecords {
		DB.Create(&missingEvidenceRecords[i])
	}

	missingEvidenceExceptions := []models.ExceptionLog{
		{
			OrderID:       orders[0].ID,
			Stage:         models.StageListing,
			ExceptionType: "missing_evidence",
			Reason:        "【缺材料】商品刊登环节未上传任何材料附件（如商品规格参数表、高清图片、品牌授权书等），请先在详情页点击「上传材料」补充后再提交",
			OperatorID:    users[0].ID,
			IsResolved:    false,
			CreatedAt:     now.Add(-2 * time.Hour),
		},
	}
	for i := range missingEvidenceExceptions {
		DB.Create(&missingEvidenceExceptions[i])
	}

	log.Println("Database seeded with demo data")
}
