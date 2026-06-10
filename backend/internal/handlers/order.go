package handlers

import (
	"fmt"
	"strings"
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
	Stage         models.OrderStage `json:"stage"`
	Data          string            `json:"data"`
	AuditNote     string            `json:"audit_note,omitempty"`
	Version       int               `json:"version"`
	AttachmentIDs []string          `json:"attachment_ids,omitempty"`
}

type BatchProcessRequest struct {
	Action        string                     `json:"action"`
	Stage         models.OrderStage          `json:"stage"`
	OrderIDs      []string                   `json:"order_ids"`
	Data          map[string]string          `json:"data,omitempty"`
	AuditNotes    map[string]string          `json:"audit_notes,omitempty"`
	Versions      map[string]int             `json:"versions"`
	AttachmentIDs map[string][]string        `json:"attachment_ids,omitempty"`
}

type BatchResultItem struct {
	OrderID string `json:"order_id"`
	OrderNo string `json:"order_no"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type ValidationContext struct {
	Order         *models.CrossBorderOrder
	Action        string
	Stage         models.OrderStage
	Data          string
	AuditNote     string
	Version       int
	AttachmentIDs []string
	UserID        string
	Role          models.Role
	Username      string
	Now           time.Time
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

func validateStageMatch(ctx *ValidationContext) error {
	if ctx.Order.CurrentStage != ctx.Stage {
		return fmt.Errorf("订单当前环节为 %s，不能在 %s 环节操作",
			stageName(ctx.Order.CurrentStage), stageName(ctx.Stage))
	}
	return nil
}

func validateVersion(ctx *ValidationContext) error {
	if ctx.Order.Version != ctx.Version {
		return fmt.Errorf("版本冲突：当前版本为 %d，您提交的版本为 %d，请刷新后重试",
			ctx.Order.Version, ctx.Version)
	}
	return nil
}

func validateCurrentHandler(ctx *ValidationContext) error {
	if ctx.Order.CurrentHandlerID != "" && ctx.Order.CurrentHandlerID != ctx.UserID {
		return fmt.Errorf("该订单当前处理人为其他用户，您无权操作")
	}
	return nil
}

func validateRole(ctx *ValidationContext) error {
	switch ctx.Action {
	case "submit", "resubmit":
		if ctx.Role != models.RoleOpsSpecialist {
			return fmt.Errorf("只有运营专员可以提交订单")
		}
	case "approve":
		if ctx.Stage == models.StageFulfillment {
			if ctx.Role != models.RoleShopOwner {
				return fmt.Errorf("订单履约环节只能由店铺负责人审核确认")
			}
		} else {
			if ctx.Role != models.RoleWarehouseMgr {
				return fmt.Errorf("商品刊登和库存同步环节只能由仓配主管审核")
			}
		}
	case "return":
		if ctx.Stage == models.StageFulfillment {
			if ctx.Role != models.RoleShopOwner {
				return fmt.Errorf("订单履约环节只能由店铺负责人退回")
			}
		} else {
			if ctx.Role != models.RoleWarehouseMgr {
				return fmt.Errorf("商品刊登和库存同步环节只能由仓配主管退回")
			}
		}
	}
	return nil
}

func validateStatusTransition(ctx *ValidationContext) (models.OrderStatus, error) {
	switch ctx.Action {
	case "submit":
		if ctx.Order.CurrentStatus != models.StatusPending && ctx.Order.CurrentStatus != models.StatusReturned {
			return "", fmt.Errorf("当前状态 %s 不允许提交操作", ctx.Order.CurrentStatus)
		}
		return models.StatusSubmitted, nil
	case "resubmit":
		if ctx.Order.CurrentStatus != models.StatusReturned {
			return "", fmt.Errorf("只有退回状态的订单可以重新提交")
		}
		return models.StatusSubmitted, nil
	case "approve":
		if ctx.Order.CurrentStatus != models.StatusSubmitted {
			return "", fmt.Errorf("当前状态 %s 不允许审核通过操作", ctx.Order.CurrentStatus)
		}
		return models.StatusApproved, nil
	case "return":
		if ctx.Order.CurrentStatus != models.StatusSubmitted {
			return "", fmt.Errorf("当前状态 %s 不允许退回操作", ctx.Order.CurrentStatus)
		}
		return models.StatusReturned, nil
	}
	return "", fmt.Errorf("未知操作: %s", ctx.Action)
}

func validateEvidence(ctx *ValidationContext, tx *gorm.DB) error {
	if ctx.Action == "approve" || ctx.Action == "return" {
		if ctx.Action == "return" && ctx.AuditNote == "" {
			return fmt.Errorf("退回操作必须填写退回原因")
		}
		return nil
	}

	if ctx.Data == "" || ctx.Data == "{}" || len(ctx.Data) < 10 {
		return fmt.Errorf("%s环节数据不完整，请填写完整信息", stageName(ctx.Stage))
	}

	switch ctx.Stage {
	case models.StageListing:
		if len(ctx.Data) < 20 {
			return fmt.Errorf("商品刊登信息过于简略，需要包含标题、描述、图片等完整信息")
		}
	case models.StageInventory:
		if len(ctx.Data) < 15 {
			return fmt.Errorf("库存同步信息需要包含仓库、数量、库位等信息")
		}
	case models.StageFulfillment:
		if len(ctx.Data) < 20 {
			return fmt.Errorf("订单履约信息需要包含物流、报关等完整材料")
		}
	}

	if len(ctx.AttachmentIDs) > 0 {
		var validAttachments []models.OrderAttachment
		tx.Where("id IN ? AND order_id = ? AND stage = ?",
			ctx.AttachmentIDs, ctx.Order.ID, ctx.Stage).
			Find(&validAttachments)

		validIDSet := make(map[string]bool)
		for _, a := range validAttachments {
			validIDSet[a.ID] = true
		}

		var invalidIDs, wrongOrderIDs, wrongStageIDs []string
		for _, aid := range ctx.AttachmentIDs {
			if !validIDSet[aid] {
				var att models.OrderAttachment
				err := tx.Where("id = ?", aid).First(&att).Error
				if err != nil {
					invalidIDs = append(invalidIDs, aid)
				} else if att.OrderID != ctx.Order.ID {
					wrongOrderIDs = append(wrongOrderIDs, att.FileName)
				} else if att.Stage != ctx.Stage {
					wrongStageIDs = append(wrongStageIDs, att.FileName)
				}
			}
		}

		var errParts []string
		if len(invalidIDs) > 0 {
			errParts = append(errParts, fmt.Sprintf("%d个附件不存在", len(invalidIDs)))
		}
		if len(wrongOrderIDs) > 0 {
			errParts = append(errParts, fmt.Sprintf("附件[%s]不属于当前订单", strings.Join(wrongOrderIDs, "、")))
		}
		if len(wrongStageIDs) > 0 {
			errParts = append(errParts, fmt.Sprintf("附件[%s]不属于%s环节", strings.Join(wrongStageIDs, "、"), stageName(ctx.Stage)))
		}
		if len(errParts) > 0 {
			return fmt.Errorf("附件校验失败：%s", strings.Join(errParts, "；"))
		}
	}

	return nil
}

func validateOverdueRules(ctx *ValidationContext) (needsOverdueLog bool, err error) {
	dueAt := getStageDueAt(ctx.Order, ctx.Stage)
	if dueAt == nil {
		return false, nil
	}

	isOverdue := ctx.Now.After(*dueAt)
	hoursOverdue := ctx.Now.Sub(*dueAt).Hours()

	if ctx.Action == "submit" || ctx.Action == "resubmit" {
		if isOverdue && hoursOverdue > 72 {
			return false, fmt.Errorf(
				"%s环节已逾期 %.0f 小时（超过3天），请先联系主管特批后再提交",
				stageName(ctx.Stage), hoursOverdue)
		}
		return isOverdue, nil
	}

	if ctx.Action == "approve" {
		if isOverdue && hoursOverdue > 168 {
			return false, fmt.Errorf(
				"%s环节已逾期超过7天，系统不允许直接审核通过，请先处理逾期异常",
				stageName(ctx.Stage))
		}
		return isOverdue, nil
	}

	if ctx.Action == "return" {
		return isOverdue, nil
	}

	return false, nil
}

func validateBusinessRules(ctx *ValidationContext, tx *gorm.DB) (toStatus models.OrderStatus, needsOverdueLog bool, err error) {
	rules := []func() error{
		func() error { return validateStageMatch(ctx) },
		func() error { return validateVersion(ctx) },
		func() error { return validateCurrentHandler(ctx) },
		func() error { return validateRole(ctx) },
	}

	for _, rule := range rules {
		if err := rule(); err != nil {
			return "", false, err
		}
	}

	toStatus, err = validateStatusTransition(ctx)
	if err != nil {
		return "", false, err
	}

	if err := validateEvidence(ctx, tx); err != nil {
		return "", false, err
	}

	needsOverdueLog, err = validateOverdueRules(ctx)
	if err != nil {
		return "", false, err
	}

	return toStatus, needsOverdueLog, nil
}

func createExceptionLog(tx *gorm.DB, orderID string, stage models.OrderStage,
	exType string, reason string, operatorID string, corrected string) (*models.ExceptionLog, error) {
	ex := &models.ExceptionLog{
		OrderID:         orderID,
		Stage:           stage,
		ExceptionType:   exType,
		Reason:          reason,
		OperatorID:      operatorID,
		CorrectedAction: corrected,
		IsResolved:      corrected != "",
	}
	if corrected != "" {
		now := time.Now()
		ex.ResolvedAt = &now
	}
	if err := tx.Create(ex).Error; err != nil {
		return nil, fmt.Errorf("创建异常记录失败: %v", err)
	}
	return ex, nil
}

func createAuditNote(tx *gorm.DB, orderID string, stage models.OrderStage,
	content string, authorID string) (*models.AuditNote, error) {
	note := &models.AuditNote{
		OrderID:  orderID,
		Stage:    stage,
		Content:  content,
		AuthorID: authorID,
	}
	if err := tx.Create(note).Error; err != nil {
		return nil, fmt.Errorf("创建审计备注失败: %v", err)
	}
	return note, nil
}

func createProcessingRecord(tx *gorm.DB, order *models.CrossBorderOrder, ctx *ValidationContext,
	fromStatus models.OrderStatus, toStatus models.OrderStatus,
	isException bool, exceptionReason string, note string, clientIP string, attachmentIDs []string) (*models.ProcessingRecord, error) {
	record := &models.ProcessingRecord{
		OrderID:         order.ID,
		Stage:           ctx.Stage,
		Action:          ctx.Action,
		FromStatus:      fromStatus,
		ToStatus:        toStatus,
		OperatorID:      ctx.UserID,
		Note:            note,
		IsException:     isException,
		ExceptionReason: exceptionReason,
		ClientIP:        clientIP,
	}
	if len(attachmentIDs) > 0 {
		record.AttachmentIDs = strings.Join(attachmentIDs, ",")
	}
	if err := tx.Create(record).Error; err != nil {
		return nil, fmt.Errorf("创建处理记录失败: %v", err)
	}
	return record, nil
}

func persistStageData(order *models.CrossBorderOrder, stage models.OrderStage, data string) {
	if data == "" {
		return
	}
	switch stage {
	case models.StageListing:
		order.ListingData = data
	case models.StageInventory:
		order.InventoryData = data
	case models.StageFulfillment:
		order.FulfillmentData = data
	}
}

func (h *OrderHandler) applyStatusChange(tx *gorm.DB, order *models.CrossBorderOrder, ctx *ValidationContext,
	toStatus models.OrderStatus, needsOverdueLog bool, fromStatus models.OrderStatus, clientIP string) error {
	isResubmit := ctx.Action == "resubmit" || (fromStatus == models.StatusReturned && ctx.Action == "submit")
	exceptionReason := ""
	note := ctx.AuditNote
	isException := false

	var attachmentNames []string
	if len(ctx.AttachmentIDs) > 0 {
		var atts []models.OrderAttachment
		tx.Where("id IN ?", ctx.AttachmentIDs).Find(&atts)
		for _, a := range atts {
			attachmentNames = append(attachmentNames, a.FileName)
		}
	}
	attachmentDesc := ""
	if len(attachmentNames) > 0 {
		attachmentDesc = fmt.Sprintf("（附带材料：%s）", strings.Join(attachmentNames, "、"))
	}

	persistStageData(order, ctx.Stage, ctx.Data)
	order.Version++

	switch toStatus {
	case models.StatusReturned:
		isException = true
		if ctx.AuditNote != "" {
			exceptionReason = ctx.AuditNote
		} else {
			exceptionReason = fmt.Sprintf("%s环节审核未通过", stageName(ctx.Stage))
		}
		order.CurrentStatus = toStatus
		if isResubmit {
			order.IsResubmitted = true
		}
		if _, err := createExceptionLog(tx, order.ID, ctx.Stage,
			"audit_return", exceptionReason, ctx.UserID, ""); err != nil {
			return err
		}
		if needsOverdueLog {
			dueAt := getStageDueAt(order, ctx.Stage)
			overdueHours := ctx.Now.Sub(*dueAt).Hours()
			if _, err := createExceptionLog(tx, order.ID, ctx.Stage,
				"timeout",
				fmt.Sprintf("%s环节已逾期 %.0f 小时后被退回", stageName(ctx.Stage), overdueHours),
				ctx.UserID, ""); err != nil {
				return err
			}
		}
		if ctx.AuditNote != "" {
			if _, err := createAuditNote(tx, order.ID, ctx.Stage, ctx.AuditNote, ctx.UserID); err != nil {
				return err
			}
		}
		handlerID, err := getHandlerForStage(ctx.Stage, toStatus, tx)
		if err == nil {
			order.CurrentHandlerID = handlerID
		}

	case models.StatusSubmitted:
		order.CurrentStatus = toStatus
		if isResubmit {
			order.IsResubmitted = true
			order.ResubmitCount++
			correctedAction := fmt.Sprintf("运营专员%s重新提交了材料%s", ctx.Username, attachmentDesc)
			if ctx.AuditNote != "" {
				correctedAction = correctedAction + "，说明：" + ctx.AuditNote
			}
			if note != "" {
				note = "重新提交：" + note + attachmentDesc
			} else {
				note = correctedAction
			}

			var unresolvedEx []models.ExceptionLog
			tx.Where("order_id = ? AND stage = ? AND is_resolved = ?",
				order.ID, ctx.Stage, false).Find(&unresolvedEx)
			for _, ex := range unresolvedEx {
				ex.IsResolved = true
				ex.ResolvedAt = &ctx.Now
				ex.CorrectedAction = correctedAction
				tx.Save(&ex)
			}
		} else if attachmentDesc != "" {
			if note != "" {
				note = note + attachmentDesc
			} else {
				note = "提交材料" + attachmentDesc
			}
		}
		if needsOverdueLog {
			dueAt := getStageDueAt(order, ctx.Stage)
			overdueHours := ctx.Now.Sub(*dueAt).Hours()
			if _, err := createExceptionLog(tx, order.ID, ctx.Stage,
				"timeout",
				fmt.Sprintf("%s环节已逾期 %.0f 小时后提交", stageName(ctx.Stage), overdueHours),
				ctx.UserID, note); err != nil {
				return err
			}
		}
		handlerID, err := getHandlerForStage(ctx.Stage, toStatus, tx)
		if err == nil {
			order.CurrentHandlerID = handlerID
		}

	case models.StatusApproved:
		if ctx.Stage == models.StageFulfillment {
			order.CurrentStatus = models.StatusCompleted
			order.CurrentHandlerID = ""
			toStatus = models.StatusCompleted
			note = "店铺负责人确认履约完成"
			if ctx.AuditNote != "" {
				note = note + "：" + ctx.AuditNote
			}
		} else {
			nextStage := getNextStage(ctx.Stage)
			order.CurrentStage = nextStage
			order.CurrentStatus = models.StatusPending
			handlerID, err := getHandlerForStage(nextStage, models.StatusPending, tx)
			if err == nil {
				order.CurrentHandlerID = handlerID
			}
			note = fmt.Sprintf("%s审核通过，进入%s环节", stageName(ctx.Stage), stageName(nextStage))
			if ctx.AuditNote != "" {
				note = note + "（" + ctx.AuditNote + "）"
			}
		}
		if needsOverdueLog {
			dueAt := getStageDueAt(order, ctx.Stage)
			overdueHours := ctx.Now.Sub(*dueAt).Hours()
			if _, err := createExceptionLog(tx, order.ID, ctx.Stage,
				"timeout_approved",
				fmt.Sprintf("%s环节已逾期 %.0f 小时后审核通过", stageName(ctx.Stage), overdueHours),
				ctx.UserID, note); err != nil {
				return err
			}
		}
	}

	if err := tx.Save(order).Error; err != nil {
		return fmt.Errorf("保存订单失败: %v", err)
	}

	if _, err := createProcessingRecord(tx, order, ctx, fromStatus, toStatus,
		isException, exceptionReason, note, clientIP, ctx.AttachmentIDs); err != nil {
		return err
	}

	return nil
}

func (h *OrderHandler) processOrderAction(tx *gorm.DB, order *models.CrossBorderOrder,
	action string, stage models.OrderStage, data string, auditNote string, version int,
	attachmentIDs []string, userID string, role models.Role, username string, clientIP string) error {

	ctx := &ValidationContext{
		Order:         order,
		Action:        action,
		Stage:         stage,
		Data:          data,
		AuditNote:     auditNote,
		Version:       version,
		AttachmentIDs: attachmentIDs,
		UserID:        userID,
		Role:          role,
		Username:      username,
		Now:           time.Now(),
	}

	toStatus, needsOverdueLog, err := validateBusinessRules(ctx, tx)
	if err != nil {
		return err
	}

	fromStatus := order.CurrentStatus

	return h.applyStatusChange(tx, order, ctx, toStatus, needsOverdueLog, fromStatus, clientIP)
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
		WarningLevel     models.WarningLevel `json:"warning_level"`
		WarningText      string              `json:"warning_text"`
		AttachmentCount  int64               `json:"attachment_count"`
		StageAttachCount int64               `json:"stage_attach_count"`
	}

	result := make([]OrderWithWarning, 0, len(orders))
	for _, o := range orders {
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
		var totalAttach, stageAttach int64
		database.DB.Model(&models.OrderAttachment{}).Where("order_id = ?", o.ID).Count(&totalAttach)
		database.DB.Model(&models.OrderAttachment{}).Where("order_id = ? AND stage = ?", o.ID, o.CurrentStage).Count(&stageAttach)
		oCopy := o
		result = append(result, OrderWithWarning{
			CrossBorderOrder: &oCopy,
			WarningLevel:     wl,
			WarningText:      warningText,
			AttachmentCount:  totalAttach,
			StageAttachCount: stageAttach,
		})
	}

	var totalPending, totalReturned, totalResubmitted int64
	database.DB.Model(&models.CrossBorderOrder{}).Where("current_status = ?", models.StatusPending).Count(&totalPending)
	database.DB.Model(&models.CrossBorderOrder{}).Where("current_status = ? AND is_resubmitted = ?", models.StatusReturned, false).Count(&totalReturned)
	database.DB.Model(&models.CrossBorderOrder{}).Where("(current_status = ? AND is_resubmitted = ?) OR resubmit_count > 0", models.StatusReturned, true).Count(&totalResubmitted)

	return c.JSON(fiber.Map{
		"orders": result,
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
	database.DB.Where("order_id = ?", id).Preload("UploadedBy").Order("created_at DESC").Find(&attachments)

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

	err := h.processOrderAction(tx, &order, action, req.Stage, req.Data, req.AuditNote,
		req.Version, req.AttachmentIDs, userID, role, username, clientIP)
	if err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	tx.Commit()
	return c.JSON(fiber.Map{
		"success":       true,
		"message":       fmt.Sprintf("%s操作成功", action),
		"order_id":      order.ID,
		"new_status":    order.CurrentStatus,
		"new_stage":     order.CurrentStage,
		"version":       order.Version,
		"attachment_ids": req.AttachmentIDs,
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
		var attachmentIDs []string
		if req.AttachmentIDs != nil {
			attachmentIDs = req.AttachmentIDs[orderID]
		}

		tx := database.DB.Begin()
		err := h.processOrderAction(tx, &order, req.Action, req.Stage, data, auditNote,
			version, attachmentIDs, userID, role, username, clientIP)
		if err != nil {
			tx.Rollback()
			item.Success = false
			item.Message = err.Error()
			results = append(results, item)
			continue
		}
		if err := tx.Commit().Error; err != nil {
			item.Success = false
			item.Message = fmt.Sprintf("事务提交失败: %v", err)
			results = append(results, item)
			continue
		}

		item.Success = true
		if len(attachmentIDs) > 0 {
			item.Message = fmt.Sprintf("%s操作成功（附带%d份材料），状态已更新", req.Action, len(attachmentIDs))
		} else {
			item.Message = fmt.Sprintf("%s操作成功，状态已更新", req.Action)
		}
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

	note, err := createAuditNote(database.DB, id, body.Stage, body.Content, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	database.DB.Preload("Author").First(note)
	return c.JSON(note)
}

func (h *OrderHandler) UploadAttachment(c *fiber.Ctx) error {
	id := c.Params("id")
	userID, role, username := middleware.GetCurrentUser(c)

	stage := models.OrderStage(c.FormValue("stage"))
	fileName := c.FormValue("file_name")
	fileType := c.FormValue("file_type")
	fileURL := c.FormValue("file_url")

	if fileName == "" || fileURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "文件名和文件URL不能为空"})
	}
	if stage == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请指定所属环节"})
	}
	if stage != models.StageListing && stage != models.StageInventory && stage != models.StageFulfillment {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "环节参数无效"})
	}

	var order models.CrossBorderOrder
	if err := database.DB.First(&order, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "订单不存在"})
	}

	if role != models.RoleOpsSpecialist {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "只有运营专员可以上传材料附件"})
	}
	if order.CurrentStage != stage {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fmt.Sprintf("订单当前环节为%s，不能在%s环节上传材料",
				stageName(order.CurrentStage), stageName(stage)),
		})
	}
	if order.CurrentStatus != models.StatusPending && order.CurrentStatus != models.StatusReturned {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fmt.Sprintf("当前状态为%s，仅待提交或已退回状态可上传材料", order.CurrentStatus),
		})
	}
	if order.CurrentHandlerID != "" && order.CurrentHandlerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "该订单当前不由您处理，无权上传材料"})
	}

	dueAt := getStageDueAt(&order, stage)
	if dueAt != nil {
		now := time.Now()
		if now.After(*dueAt) {
			hoursOverdue := now.Sub(*dueAt).Hours()
			if hoursOverdue > 72 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": fmt.Sprintf("%s环节已逾期%.0f小时（超过3天），请先联系主管特批后再上传材料",
						stageName(stage), hoursOverdue),
				})
			}
		}
	}

	tx := database.DB.Begin()

	att := &models.OrderAttachment{
		OrderID:      id,
		Stage:        stage,
		FileName:     fileName,
		FileType:     fileType,
		FileURL:      fileURL,
		UploadedByID: userID,
	}
	if err := tx.Create(att).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "保存附件失败"})
	}

	if order.CurrentStatus == models.StatusReturned {
		reason := fmt.Sprintf("运营专员%s补充上传了材料：%s", username, fileName)
		if _, err := createExceptionLog(tx, id, stage, "attachment_supplement", reason, userID, ""); err != nil {
			tx.Rollback()
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		if _, err := createAuditNote(tx, id, stage, reason, userID); err != nil {
			tx.Rollback()
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "事务提交失败"})
	}

	database.DB.Preload("UploadedBy").First(att)
	return c.JSON(att)
}

func (h *OrderHandler) GetStatistics(c *fiber.Ctx) error {
	var stats struct {
		Total          int64 `json:"total"`
		Pending        int64 `json:"pending"`
		Submitted      int64 `json:"submitted"`
		Returned       int64 `json:"returned"`
		Resubmitted    int64 `json:"resubmitted"`
		Completed      int64 `json:"completed"`
		ListingCnt     int64 `json:"listing_count"`
		InventoryCnt   int64 `json:"inventory_count"`
		FulfillmentCnt int64 `json:"fulfillment_count"`
		OverdueCnt     int64 `json:"overdue_count"`
		NearDueCnt     int64 `json:"near_due_count"`
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
