package handlers

import (
	"fmt"
	"time"

	"cross-border-order-system/internal/database"
	"cross-border-order-system/internal/middleware"
	"cross-border-order-system/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type OrderHandler struct{}

func NewOrderHandler() *OrderHandler {
	return &OrderHandler{}
}

type SubmitOrderRequest struct {
	Stage       models.OrderStage  `json:"stage"`
	Data        string             `json:"data"`
	AuditNote   string             `json:"audit_note,omitempty"`
	Version     int                `json:"version"`
	AttachmentIDs []string         `json:"attachment_ids,omitempty"`
}

type BatchProcessRequest struct {
	Action      string               `json:"action"`
	Stage       models.OrderStage    `json:"stage"`
	OrderIDs    []string             `json:"order_ids"`
	Data        map[string]string    `json:"data,omitempty"`
	AuditNotes  map[string]string    `json:"audit_notes,omitempty"`
	Versions    map[string]int       `json:"versions"`
}

type BatchResultItem struct {
	OrderID   string `json:"order_id"`
	OrderNo   string `json:"order_no"`
	Success   bool   `json:"success"`
	Message   string `json:"message"`
}

func getStageDueAt(order *models.CrossBorderOrder, stage models.OrderStage) *time.Time {
	switch stage {
	case models.StageListing:
		return order.ListingDueAt
	case models.StageInventory:
		return order.InventoryDueAt
	case models.StageFulfillment:
		return order.FulfillmentDueAt
	}
	return nil
}

func getWarningLevel(order *models.CrossBorderOrder) models.WarningLevel {
	dueAt := getStageDueAt(order, order.CurrentStage)
	if dueAt == nil {
		return models.WarningNormal
	}
	now := time.Now()
	if now.After(*dueAt) {
		return models.WarningOverdue
	}
	if dueAt.Sub(now) < 48*time.Hour {
		return models.WarningNearDue
	}
	return models.WarningNormal
}

func (h *OrderHandler) ListOrders(c *fiber.Ctx) error {
	userID, role, _ := middleware.GetCurrentUser(c)
	group := c.Query("group", "")
	stage := c.Query("stage", "")
	status := c.Query("status", "")
	warning := c.Query("warning", "")
	search := c.Query("search", "")

	var orders []models.CrossBorderOrder
	query := database.DB.Preload("CurrentHandler").Preload("CreatedBy")

	if search != "" {
		query = query.Where("order_no LIKE ? OR product_name LIKE ? OR shop_name LIKE ? OR sku LIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}
	if stage != "" {
		query = query.Where("current_stage = ?", stage)
	}
	if status != "" {
		query = query.Where("current_status = ?", status)
	}

	switch group {
	case "pending":
		query = query.Where("current_status = ?", models.StatusPending)
	case "returned":
		query = query.Where("current_status = ? AND is_resubmitted = ?", models.StatusReturned, false)
	case "resubmitted":
		query = query.Where("(current_status = ? AND is_resubmitted = ?) OR resubmit_count > 0", models.StatusReturned, true)
	}

	if role == models.RoleOpsSpecialist {
		query = query.Where("current_handler_id = ? OR created_by_id = ?", userID, userID)
	} else if role == models.RoleWarehouseMgr || role == models.RoleShopOwner {
		query = query.Where("current_handler_id = ? OR current_status IN ?", userID, []models.OrderStatus{models.StatusSubmitted})
	}

	if err := query.Order("created_at DESC").Find(&orders).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "获取订单列表失败"})
	}

	type OrderWithWarning struct {
		*models.CrossBorderOrder
		WarningLevel   models.WarningLevel `json:"warning_level"`
		WarningText    string              `json:"warning_text"`
	}

	result := make([]OrderWithWarning, len(orders))
	for i, o := range orders {
		wl := getWarningLevel(&o)
		warningText := ""
		switch wl {
		case models.WarningOverdue:
			warningText = "已逾期"
		case models.WarningNearDue:
			warningText = "即将到期"
		default:
			warningText = "正常"
		}
		if warning != "" && string(wl) != warning {
			continue
		}
		result[i] = OrderWithWarning{
			CrossBorderOrder: &orders[i],
			WarningLevel:     wl,
			WarningText:      warningText,
		}
	}

	finalResult := make([]OrderWithWarning, 0)
	for _, r := range result {
		if r.CrossBorderOrder != nil {
			finalResult = append(finalResult, r)
		}
	}

	var totalPending, totalReturned, totalResubmitted int64
	database.DB.Model(&models.CrossBorderOrder{}).Where("current_status = ?", models.StatusPending).Count(&totalPending)
	database.DB.Model(&models.CrossBorderOrder{}).Where("current_status = ? AND is_resubmitted = ?", models.StatusReturned, false).Count(&totalReturned)
	database.DB.Model(&models.CrossBorderOrder{}).Where("(current_status = ? AND is_resubmitted = ?) OR resubmit_count > 0", models.StatusReturned, true).Count(&totalResubmitted)

	return c.JSON(fiber.Map{
		"orders": finalResult,
		"stats": fiber.Map{
			"pending":     totalPending,
			"returned":    totalReturned,
			"resubmitted": totalResubmitted,
		},
	})
}

func (h *OrderHandler) GetOrder(c *fiber.Ctx) error {
	id := c.Params("id")
	var order models.CrossBorderOrder
	if err := database.DB.Preload("CurrentHandler").Preload("CreatedBy").First(&order, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "订单不存在"})
	}

	var attachments []models.OrderAttachment
	database.DB.Where("order_id = ?", id).Preload("UploadedBy").Find(&attachments)

	var records []models.ProcessingRecord
	database.DB.Where("order_id = ?", id).Preload("Operator").Order("created_at DESC").Find(&records)

	var auditNotes []models.AuditNote
	database.DB.Where("order_id = ?", id).Preload("Author").Order("created_at DESC").Find(&auditNotes)

	var exceptions []models.ExceptionLog
	database.DB.Where("order_id = ?", id).Preload("Operator").Order("created_at DESC").Find(&exceptions)

	wl := getWarningLevel(&order)
	warningText := ""
	switch wl {
	case models.WarningOverdue:
		warningText = "已逾期"
	case models.WarningNearDue:
		warningText = "即将到期"
	default:
		warningText = "正常"
	}

	return c.JSON(fiber.Map{
		"order":         order,
		"warning_level": wl,
		"warning_text":  warningText,
		"attachments":   attachments,
		"records":       records,
		"audit_notes":   auditNotes,
		"exceptions":    exceptions,
	})
}

func validateRoleForAction(role models.Role, action string, stage models.OrderStage) error {
	switch action {
	case "submit", "resubmit":
		if role != models.RoleOpsSpecialist {
			return fmt.Errorf("只有运营专员可以提交订单")
		}
	case "approve":
		if stage == models.StageFulfillment {
			if role != models.RoleShopOwner {
				return fmt.Errorf("订单履约环节只能由店铺负责人审核确认")
			}
		} else {
			if role != models.RoleWarehouseMgr {
				return fmt.Errorf("商品刊登和库存同步环节只能由仓配主管审核")
			}
		}
	case "return":
		if stage == models.StageFulfillment {
			if role != models.RoleShopOwner {
				return fmt.Errorf("订单履约环节只能由店铺负责人退回")
			}
		} else {
			if role != models.RoleWarehouseMgr {
				return fmt.Errorf("商品刊登和库存同步环节只能由仓配主管退回")
			}
		}
	}
	return nil
}

func validateStatusTransition(currentStatus models.OrderStatus, action string) (models.OrderStatus, error) {
	switch action {
	case "submit":
		if currentStatus != models.StatusPending && currentStatus != models.StatusReturned {
			return "", fmt.Errorf("当前状态 %s 不允许提交操作", currentStatus)
		}
		return models.StatusSubmitted, nil
	case "resubmit":
		if currentStatus != models.StatusReturned {
			return "", fmt.Errorf("只有退回状态的订单可以重新提交")
		}
		return models.StatusSubmitted, nil
	case "approve":
		if currentStatus != models.StatusSubmitted {
			return "", fmt.Errorf("当前状态 %s 不允许审核通过操作", currentStatus)
		}
		return models.StatusApproved, nil
	case "return":
		if currentStatus != models.StatusSubmitted {
			return "", fmt.Errorf("当前状态 %s 不允许退回操作", currentStatus)
		}
		return models.StatusReturned, nil
	}
	return "", fmt.Errorf("未知操作: %s", action)
}

func validateEvidence(order *models.CrossBorderOrder, stage models.OrderStage, data string, attachmentIDs []string) error {
	if data == "" || data == "{}" || len(data) < 10 {
		return fmt.Errorf("%s环节数据不完整，请填写完整信息", stageName(stage))
	}

	// For listing stage, check key fields
	if stage == models.StageListing {
		if len(data) < 20 {
			return fmt.Errorf("商品刊登信息过于简略，需要包含标题、描述、图片等完整信息")
		}
	}
	if stage == models.StageInventory {
		if len(data) < 15 {
			return fmt.Errorf("库存同步信息需要包含仓库、数量、库位等信息")
		}
	}
	if stage == models.StageFulfillment {
		if len(data) < 20 {
			return fmt.Errorf("订单履约信息需要包含物流、报关等完整材料")
		}
	}
	return nil
}

func stageName(stage models.OrderStage) string {
	switch stage {
	case models.StageListing:
		return "商品刊登"
	case models.StageInventory:
		return "库存同步"
	case models.StageFulfillment:
		return "订单履约"
	}
	return string(stage)
}

func getNextStage(current models.OrderStage) models.OrderStage {
	switch current {
	case models.StageListing:
		return models.StageInventory
	case models.StageInventory:
		return models.StageFulfillment
	}
	return current
}

func getHandlerForStage(stage models.OrderStage, status models.OrderStatus, db *gorm.DB) (handlerID string, err error) {
	var role models.Role
	if status == models.StatusPending || status == models.StatusReturned {
		role = models.RoleOpsSpecialist
	} else if status == models.StatusSubmitted {
		if stage == models.StageFulfillment {
			role = models.RoleShopOwner
		} else {
			role = models.RoleWarehouseMgr
		}
	}
	var user models.User
	err = db.Where("role = ?", role).First(&user).Error
	if err != nil {
		return "", err
	}
	return user.ID, nil
}

func (h *OrderHandler) processOrderAction(tx *gorm.DB, order *models.CrossBorderOrder, action string, stage models.OrderStage, data string, auditNote string, version int, userID string, role models.Role, username string, clientIP string) error {
	if order.CurrentStage != stage {
		return fmt.Errorf("订单当前环节为 %s，不能在 %s 环节操作", stageName(order.CurrentStage), stageName(stage))
	}

	if order.Version != version {
		return fmt.Errorf("版本冲突：当前版本为 %d，您提交的版本为 %d，请刷新后重试", order.Version, version)
	}

	if order.CurrentHandlerID != "" && order.CurrentHandlerID != userID {
		return fmt.Errorf("该订单当前处理人为其他用户，您无权操作")
	}

	if err := validateRoleForAction(role, action, stage); err != nil {
		return err
	}

	fromStatus := order.CurrentStatus
	toStatus, err := validateStatusTransition(fromStatus, action)
	if err != nil {
		return err
	}

	if (action == "submit" || action == "resubmit") && data != "" {
		if err := validateEvidence(order, stage, data, nil); err != nil {
			return err
		}
	}

	isResubmit := action == "resubmit" || (fromStatus == models.StatusReturned && action == "submit")

	record := &models.ProcessingRecord{
		OrderID:    order.ID,
		Stage:      stage,
		Action:     action,
		FromStatus: fromStatus,
		ToStatus:   toStatus,
		OperatorID: userID,
		ClientIP:   clientIP,
	}

	if auditNote != "" {
		record.Note = auditNote
	}

	order.Version++

	switch stage {
	case models.StageListing:
		if data != "" {
			order.ListingData = data
		}
	case models.StageInventory:
		if data != "" {
			order.InventoryData = data
		}
	case models.StageFulfillment:
		if data != "" {
			order.FulfillmentData = data
		}
	}

	if toStatus == models.StatusReturned {
		record.IsException = true
		if auditNote != "" {
			record.ExceptionReason = auditNote
		} else {
			record.ExceptionReason = fmt.Sprintf("%s环节审核未通过", stageName(stage))
		}

		order.CurrentStatus = toStatus
		if isResubmit {
			order.IsResubmitted = true
		}

		ex := &models.ExceptionLog{
			OrderID:       order.ID,
			Stage:         stage,
			ExceptionType: "audit_return",
			Reason:        record.ExceptionReason,
			OperatorID:    userID,
			IsResolved:    false,
		}
		if err := tx.Create(ex).Error; err != nil {
			return fmt.Errorf("创建异常记录失败: %v", err)
		}

		if auditNote != "" {
			an := &models.AuditNote{
				OrderID:  order.ID,
				Stage:    stage,
				Content:  auditNote,
				AuthorID: userID,
			}
			if err := tx.Create(an).Error; err != nil {
				return fmt.Errorf("创建审计备注失败: %v", err)
			}
		}

		handlerID, err := getHandlerForStage(stage, toStatus, tx)
		if err == nil {
			order.CurrentHandlerID = handlerID
		}
	} else if toStatus == models.StatusSubmitted {
		order.CurrentStatus = toStatus
		if isResubmit {
			order.IsResubmitted = true
			order.ResubmitCount++
			record.Note = "重新提交：" + record.Note

			var unresolvedEx []models.ExceptionLog
			tx.Where("order_id = ? AND stage = ? AND is_resolved = ?", order.ID, stage, false).Find(&unresolvedEx)
			now := time.Now()
			for _, ex := range unresolvedEx {
				ex.IsResolved = true
				ex.ResolvedAt = &now
				ex.CorrectedAction = fmt.Sprintf("运营专员%s重新提交了材料", username)
				tx.Save(&ex)
			}
		}

		handlerID, err := getHandlerForStage(stage, toStatus, tx)
		if err == nil {
			order.CurrentHandlerID = handlerID
		}
	} else if toStatus == models.StatusApproved {
		if stage == models.StageFulfillment {
			order.CurrentStatus = models.StatusCompleted
			order.CurrentHandlerID = ""
			record.ToStatus = models.StatusCompleted
		} else {
			nextStage := getNextStage(stage)
			order.CurrentStage = nextStage
			order.CurrentStatus = models.StatusPending
			handlerID, err := getHandlerForStage(nextStage, models.StatusPending, tx)
			if err == nil {
				order.CurrentHandlerID = handlerID
			}
			record.ToStatus = models.StatusApproved
			record.Note = fmt.Sprintf("%s审核通过，进入%s环节", stageName(stage), stageName(nextStage))
		}
	}

	if err := tx.Save(order).Error; err != nil {
		return fmt.Errorf("保存订单失败: %v", err)
	}

	if err := tx.Create(record).Error; err != nil {
		return fmt.Errorf("创建处理记录失败: %v", err)
	}

	return nil
}

func (h *OrderHandler) SubmitOrder(c *fiber.Ctx) error {
	id := c.Params("id")
	action := c.Params("action")
	userID, role, username := middleware.GetCurrentUser(c)
	clientIP := c.IP()

	var req SubmitOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数格式错误"})
	}

	var order models.CrossBorderOrder
	if err := database.DB.First(&order, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "订单不存在"})
	}

	tx := database.DB.Begin()

	err := h.processOrderAction(tx, &order, action, req.Stage, req.Data, req.AuditNote, req.Version, userID, role, username, clientIP)
	if err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	tx.Commit()
	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("%s操作成功", action),
		"order_id": order.ID,
		"new_status": order.CurrentStatus,
		"new_stage": order.CurrentStage,
	})
}

func (h *OrderHandler) BatchProcess(c *fiber.Ctx) error {
	userID, role, username := middleware.GetCurrentUser(c)
	clientIP := c.IP()

	var req BatchProcessRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数格式错误"})
	}

	if len(req.OrderIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请选择至少一个订单"})
	}

	results := make([]BatchResultItem, 0, len(req.OrderIDs))

	for _, orderID := range req.OrderIDs {
		var order models.CrossBorderOrder
		item := BatchResultItem{OrderID: orderID}

		if err := database.DB.First(&order, "id = ?", orderID).Error; err != nil {
			item.Success = false
			item.Message = "订单不存在"
			results = append(results, item)
			continue
		}

		item.OrderNo = order.OrderNo

		data := ""
		if req.Data != nil {
			data = req.Data[orderID]
		}
		auditNote := ""
		if req.AuditNotes != nil {
			auditNote = req.AuditNotes[orderID]
		}
		version := 0
		if req.Versions != nil {
			version = req.Versions[orderID]
		}

		tx := database.DB.Begin()
		err := h.processOrderAction(tx, &order, req.Action, req.Stage, data, auditNote, version, userID, role, username, clientIP)
		if err != nil {
			tx.Rollback()
			item.Success = false
			item.Message = err.Error()
			results = append(results, item)
			continue
		}
		tx.Commit()

		item.Success = true
		item.Message = fmt.Sprintf("%s操作成功", req.Action)
		results = append(results, item)
	}

	successCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		}
	}

	return c.JSON(fiber.Map{
		"success":       true,
		"total":         len(results),
		"success_count": successCount,
		"failed_count":  len(results) - successCount,
		"results":       results,
	})
}

func (h *OrderHandler) AddAuditNote(c *fiber.Ctx) error {
	id := c.Params("id")
	userID, _, _ := middleware.GetCurrentUser(c)

	var body struct {
		Stage   models.OrderStage `json:"stage"`
		Content string            `json:"content"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数格式错误"})
	}
	if body.Content == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "备注内容不能为空"})
	}

	note := &models.AuditNote{
		OrderID:  id,
		Stage:    body.Stage,
		Content:  body.Content,
		AuthorID: userID,
	}
	if err := database.DB.Create(note).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "保存备注失败"})
	}
	database.DB.Preload("Author").First(note)
	return c.JSON(note)
}

func (h *OrderHandler) UploadAttachment(c *fiber.Ctx) error {
	id := c.Params("id")
	userID, _, _ := middleware.GetCurrentUser(c)

	stage := models.OrderStage(c.FormValue("stage"))
	fileName := c.FormValue("file_name")
	fileType := c.FormValue("file_type")
	fileURL := c.FormValue("file_url")

	if fileName == "" || fileURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "文件名和文件URL不能为空"})
	}

	att := &models.OrderAttachment{
		OrderID:      id,
		Stage:        stage,
		FileName:     fileName,
		FileType:     fileType,
		FileURL:      fileURL,
		UploadedByID: userID,
	}
	if err := database.DB.Create(att).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "保存附件失败"})
	}
	database.DB.Preload("UploadedBy").First(att)
	return c.JSON(att)
}

func (h *OrderHandler) GetStatistics(c *fiber.Ctx) error {
	var stats struct {
		Total       int64 `json:"total"`
		Pending     int64 `json:"pending"`
		Submitted   int64 `json:"submitted"`
		Returned    int64 `json:"returned"`
		Resubmitted int64 `json:"resubmitted"`
		Completed   int64 `json:"completed"`
		ListingCnt  int64 `json:"listing_count"`
		InventoryCnt int64 `json:"inventory_count"`
		FulfillmentCnt int64 `json:"fulfillment_count"`
		OverdueCnt  int64 `json:"overdue_count"`
		NearDueCnt  int64 `json:"near_due_count"`
	}

	database.DB.Model(&models.CrossBorderOrder{}).Count(&stats.Total)
	database.DB.Model(&models.CrossBorderOrder{}).Where("current_status = ?", models.StatusPending).Count(&stats.Pending)
	database.DB.Model(&models.CrossBorderOrder{}).Where("current_status = ?", models.StatusSubmitted).Count(&stats.Submitted)
	database.DB.Model(&models.CrossBorderOrder{}).Where("current_status = ? AND is_resubmitted = ?", models.StatusReturned, false).Count(&stats.Returned)
	database.DB.Model(&models.CrossBorderOrder{}).Where("(current_status = ? AND is_resubmitted = ?) OR resubmit_count > 0", models.StatusReturned, true).Count(&stats.Resubmitted)
	database.DB.Model(&models.CrossBorderOrder{}).Where("current_status = ?", models.StatusCompleted).Count(&stats.Completed)
	database.DB.Model(&models.CrossBorderOrder{}).Where("current_stage = ?", models.StageListing).Count(&stats.ListingCnt)
	database.DB.Model(&models.CrossBorderOrder{}).Where("current_stage = ?", models.StageInventory).Count(&stats.InventoryCnt)
	database.DB.Model(&models.CrossBorderOrder{}).Where("current_stage = ?", models.StageFulfillment).Count(&stats.FulfillmentCnt)

	now := time.Now()
	nearDueThreshold := now.Add(48 * time.Hour)
	var allOrders []models.CrossBorderOrder
	database.DB.Find(&allOrders)
	for _, o := range allOrders {
		dueAt := getStageDueAt(&o, o.CurrentStage)
		if dueAt == nil {
			continue
		}
		if now.After(*dueAt) {
			stats.OverdueCnt++
		} else if dueAt.Before(nearDueThreshold) {
			stats.NearDueCnt++
		}
	}

	return c.JSON(stats)
}
