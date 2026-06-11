package handlers

import (
	"errors"
	"fmt"
	"insurance-system/config"
	"insurance-system/database"
	"insurance-system/middleware"
	"insurance-system/models"
	"math/rand"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

func NewAPIError(code int, msg string, detail ...string) APIError {
	e := APIError{Code: code, Message: msg}
	if len(detail) > 0 {
		e.Detail = detail[0]
	}
	return e
}

func respondErr(c *gin.Context, status int, err APIError) {
	c.JSON(status, gin.H{"error": err})
}

func respondOK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"data": data})
}

const (
	WarningNormal      = "normal"
	WarningApproaching = "approaching"
	WarningOverdue     = "overdue"
)

func HealthCheck(c *gin.Context) {
	respondOK(c, gin.H{"status": "ok", "timestamp": time.Now()})
}

func GetDashboardStats(c *gin.Context) {
	var total, pending, supplement, approved, synced, completed, rejected int64
	db := database.DB.Model(&models.PatrolOrder{})
	db.Count(&total)
	db.Where("status = ?", "待审核").Count(&pending)
	db.Where("status = ?", "待补正").Count(&supplement)
	db.Where("status = ?", "审核通过").Count(&approved)
	db.Where("status = ?", "已同步").Count(&synced)
	db.Where("status = ?", "已归档").Count(&completed)
	db.Where("status = ?", "审核退回").Count(&rejected)

	now := time.Now()
	overdueCnt := int64(0)
	approachingCnt := int64(0)
	normalCnt := int64(0)
	var orders []models.PatrolOrder
	database.DB.Where("status NOT IN ?", []string{"已归档", "审核退回"}).Find(&orders)
	for _, o := range orders {
		if o.Deadline == nil {
			normalCnt++
			continue
		}
		d := o.Deadline.Sub(now)
		if d < 0 {
			overdueCnt++
		} else if d <= time.Duration(config.ApproachingDays)*24*time.Hour {
			approachingCnt++
		} else {
			normalCnt++
		}
	}

	respondOK(c, gin.H{
		"total":       total,
		"pending":     pending,
		"supplement":  supplement,
		"approved":    approved,
		"synced":      synced,
		"completed":   completed,
		"rejected":    rejected,
		"overdue":     overdueCnt,
		"approaching": approachingCnt,
		"normal":      normalCnt,
	})
}

func GetWarnings(c *gin.Context) {
	user := middleware.GetUserContext(c)
	now := time.Now()

	var orders []models.PatrolOrder
	q := database.DB.Model(&models.PatrolOrder{}).Preload("Attachments")

	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	if roleOnly := c.Query("role_only"); roleOnly == "1" {
		switch user.Role {
		case config.RoleCustomerManager:
			q = q.Where("creator_id = ? OR status IN ?", user.UserID, []string{"待补正"})
		case config.RoleUnderwriter:
			q = q.Where("status = ?", "待审核")
		case config.RoleBusinessOwner:
			q = q.Where("status IN ?", []string{"审核通过", "已同步"})
		}
	}

	q.Where("status NOT IN ?", []string{"已归档", "审核退回"})
	q.Find(&orders)

	normalList := []models.PatrolOrder{}
	approachingList := []models.PatrolOrder{}
	overdueList := []models.PatrolOrder{}

	for _, o := range orders {
		w := WarningNormal
		if o.Deadline != nil {
			d := o.Deadline.Sub(now)
			if d < 0 {
				w = WarningOverdue
			} else if d <= time.Duration(config.ApproachingDays)*24*time.Hour {
				w = WarningApproaching
			}
		}
		switch w {
		case WarningOverdue:
			overdueList = append(overdueList, o)
		case WarningApproaching:
			approachingList = append(approachingList, o)
		default:
			normalList = append(normalList, o)
		}
	}

	respondOK(c, gin.H{
		WarningOverdue:     overdueList,
		WarningApproaching: approachingList,
		WarningNormal:      normalList,
	})
}

func buildListQuery(c *gin.Context, user middleware.UserContext) *gorm.DB {
	q := database.DB.Model(&models.PatrolOrder{}).Preload("Attachments")

	if kw := c.Query("keyword"); kw != "" {
		q = q.Where("order_no LIKE ? OR customer_name LIKE ? OR id_number LIKE ? OR phone LIKE ?",
			"%"+kw+"%", "%"+kw+"%", "%"+kw+"%", "%"+kw+"%")
	}
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	if insuranceType := c.Query("insurance_type"); insuranceType != "" {
		q = q.Where("insurance_type = ?", insuranceType)
	}
	if warning := c.Query("warning"); warning != "" {
		now := time.Now()
		switch warning {
		case WarningOverdue:
			q = q.Where("deadline IS NOT NULL AND deadline < ?", now)
		case WarningApproaching:
			end := now.Add(time.Duration(config.ApproachingDays) * 24 * time.Hour)
			q = q.Where("deadline IS NOT NULL AND deadline >= ? AND deadline <= ?", now, end)
		case WarningNormal:
			end := now.Add(time.Duration(config.ApproachingDays) * 24 * time.Hour)
			q = q.Where("deadline IS NULL OR deadline > ?", end)
		}
	}
	if my := c.Query("only_mine"); my == "1" {
		switch user.Role {
		case config.RoleCustomerManager:
			q = q.Where("creator_id = ? OR current_handler_id = ?", user.UserID, user.UserID)
		case config.RoleUnderwriter, config.RoleBusinessOwner:
			q = q.Where("current_handler_id = ? OR current_handler IS NULL", user.UserID)
		}
	}
	if sortBy := c.Query("sort_by"); sortBy != "" {
		order := sortBy
		if desc := c.Query("sort_desc"); desc == "1" {
			order += " DESC"
		}
		q = q.Order(order)
	} else {
		q = q.Order("created_at DESC")
	}
	return q
}

func ListPatrolOrders(c *gin.Context) {
	user := middleware.GetUserContext(c)
	q := buildListQuery(c, user)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var total int64
	q.Count(&total)

	var list []models.PatrolOrder
	offset := (page - 1) * pageSize
	q.Offset(offset).Limit(pageSize).Find(&list)

	respondOK(c, gin.H{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"list":      decorateWithWarning(list),
	})
}

func decorateWithWarning(list []models.PatrolOrder) []map[string]interface{} {
	now := time.Now()
	result := make([]map[string]interface{}, len(list))
	for i, o := range list {
		w := WarningNormal
		daysLeft := -1
		if o.Deadline != nil {
			d := o.Deadline.Sub(now)
			daysLeft = int(d / (24 * time.Hour))
			if d < 0 {
				w = WarningOverdue
			} else if d <= time.Duration(config.ApproachingDays)*24*time.Hour {
				w = WarningApproaching
			}
		}
		result[i] = gin.H{
			"id":                 o.ID,
			"order_no":           o.OrderNo,
			"customer_name":      o.CustomerName,
			"id_number":          o.IDNumber,
			"phone":              o.Phone,
			"insurance_type":     o.InsuranceType,
			"insurance_amount":   o.InsuranceAmount,
			"premium":            o.Premium,
			"insurance_period":   o.InsurancePeriod,
			"status":             o.Status,
			"current_handler":    o.CurrentHandler,
			"current_handler_id": o.CurrentHandlerID,
			"creator_name":       o.CreatorName,
			"creator_id":         o.CreatorID,
			"deadline":           o.Deadline,
			"warning":            w,
			"days_left":          daysLeft,
			"version":            o.Version,
			"remark":             o.Remark,
			"reject_reason":      o.RejectReason,
			"supplement_reason":  o.SupplementReason,
			"abnormal_reason":    o.AbnormalReason,
			"evidence_uploaded":  o.EvidenceUploaded,
			"confirm_evidence":   o.ConfirmEvidence,
			"attachments_count":  len(o.Attachments),
			"created_at":         o.CreatedAt,
			"updated_at":         o.UpdatedAt,
		}
	}
	return result
}

func GetPatrolOrder(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "无效的ID"))
		return
	}

	var order models.PatrolOrder
	if err := database.DB.Preload("Attachments").Preload("Histories").Preload("AuditNotes").
		First(&order, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			respondErr(c, http.StatusNotFound, NewAPIError(404, "投保申请不存在"))
			return
		}
		respondErr(c, http.StatusInternalServerError, NewAPIError(500, "数据库错误", err.Error()))
		return
	}

	sort.Slice(order.Histories, func(i, j int) bool {
		return order.Histories[i].CreatedAt.Before(order.Histories[j].CreatedAt)
	})
	sort.Slice(order.AuditNotes, func(i, j int) bool {
		return order.AuditNotes[i].CreatedAt.Before(order.AuditNotes[j].CreatedAt)
	})

	now := time.Now()
	w := WarningNormal
	var daysLeft *int
	if order.Deadline != nil {
		d := order.Deadline.Sub(now)
		dl := int(d / (24 * time.Hour))
		daysLeft = &dl
		if d < 0 {
			w = WarningOverdue
		} else if d <= time.Duration(config.ApproachingDays)*24*time.Hour {
			w = WarningApproaching
		}
	}

	respondOK(c, gin.H{
		"order":     order,
		"warning":   w,
		"days_left": daysLeft,
	})
}

type CreateOrderRequest struct {
	CustomerName    string    `json:"customer_name" binding:"required"`
	IDNumber        string    `json:"id_number" binding:"required"`
	Phone           string    `json:"phone"`
	InsuranceType   string    `json:"insurance_type" binding:"required"`
	InsuranceAmount float64   `json:"insurance_amount" binding:"required,gte=0"`
	Premium         float64   `json:"premium" binding:"required,gte=0"`
	InsurancePeriod string    `json:"insurance_period"`
	StartDate       time.Time `json:"start_date"`
	EndDate         time.Time `json:"end_date"`
	Deadline        time.Time `json:"deadline"`
	Remark          string    `json:"remark"`
	Attachments     []struct {
		FileName   string `json:"file_name"`
		FileType   string `json:"file_type"`
		FileSize   int64  `json:"file_size"`
		FileURL    string `json:"file_url"`
		Category   string `json:"category"`
		IsEvidence bool   `json:"is_evidence"`
	} `json:"attachments"`
}

func CreatePatrolOrder(c *gin.Context) {
	user := middleware.GetUserContext(c)
	if user.Role != config.RoleCustomerManager {
		respondErr(c, http.StatusForbidden, NewAPIError(403, "无权操作", "仅客户经理可创建投保申请"))
		return
	}

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "参数错误", err.Error()))
		return
	}

	if req.InsuranceAmount <= 0 {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "参数错误", "投保金额必须大于0"))
		return
	}
	if req.Premium < 0 {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "参数错误", "保费不能为负数"))
		return
	}

	now := time.Now()
	orderNo := fmt.Sprintf("BX%d%s", now.Year(), randomDigits(6))

	order := models.PatrolOrder{
		OrderNo:          orderNo,
		CustomerName:     req.CustomerName,
		IDNumber:         req.IDNumber,
		Phone:            req.Phone,
		InsuranceType:    req.InsuranceType,
		InsuranceAmount:  req.InsuranceAmount,
		Premium:          req.Premium,
		InsurancePeriod:  req.InsurancePeriod,
		StartDate:        &req.StartDate,
		EndDate:          &req.EndDate,
		Status:           config.StatusPending,
		CurrentHandlerID: "underwriter_01",
		CurrentHandler:   "核保专员-李",
		CreatorID:        user.UserID,
		CreatorName:      user.UserName,
		Deadline:         &req.Deadline,
		Version:          1,
		Remark:           req.Remark,
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		for _, a := range req.Attachments {
			att := models.Attachment{
				PatrolOrderID: order.ID,
				FileName:      a.FileName,
				FileType:      a.FileType,
				FileSize:      a.FileSize,
				FileURL:       a.FileURL,
				Category:      a.Category,
				IsEvidence:    a.IsEvidence,
				UploaderID:    user.UserID,
				UploaderName:  user.UserName,
			}
			if err := tx.Create(&att).Error; err != nil {
				return err
			}
		}
		if len(req.Attachments) > 0 {
			order.EvidenceUploaded = true
			tx.Save(&order)
		}
		h := models.OrderHistory{
			PatrolOrderID:  order.ID,
			Action:         config.ActionSubmit,
			PreviousStatus: "",
			CurrentStatus:  config.StatusPending,
			OperatorID:     user.UserID,
			OperatorName:   user.UserName,
			OperatorRole:   user.Role,
			Remark:         "创建并提交投保申请",
			CreatedAt:      now,
		}
		if err := tx.Create(&h).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		respondErr(c, http.StatusInternalServerError, NewAPIError(500, "创建失败", err.Error()))
		return
	}

	respondOK(c, gin.H{"id": order.ID, "order_no": order.OrderNo})
}

type UpdateOrderRequest struct {
	CustomerName    string    `json:"customer_name"`
	IDNumber        string    `json:"id_number"`
	Phone           string    `json:"phone"`
	InsuranceType   string    `json:"insurance_type"`
	InsuranceAmount *float64  `json:"insurance_amount"`
	Premium         *float64  `json:"premium"`
	InsurancePeriod string    `json:"insurance_period"`
	StartDate       time.Time `json:"start_date"`
	EndDate         time.Time `json:"end_date"`
	Deadline        time.Time `json:"deadline"`
	Remark          string    `json:"remark"`
}

func UpdatePatrolOrder(c *gin.Context) {
	user := middleware.GetUserContext(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "无效的ID"))
		return
	}

	var order models.PatrolOrder
	if err := database.DB.First(&order, id).Error; err != nil {
		respondErr(c, http.StatusNotFound, NewAPIError(404, "投保申请不存在"))
		return
	}

	if user.Role == config.RoleCustomerManager && order.CreatorID != user.UserID {
		respondErr(c, http.StatusForbidden, NewAPIError(403, "无权修改", "只能修改自己创建的投保申请"))
		return
	}
	if user.Role == config.RoleUnderwriter && order.Status != config.StatusPending {
		respondErr(c, http.StatusForbidden, NewAPIError(403, "无权修改", "核保专员仅可修改待审核状态"))
		return
	}

	var req UpdateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "参数错误", err.Error()))
		return
	}

	if req.CustomerName != "" {
		order.CustomerName = req.CustomerName
	}
	if req.IDNumber != "" {
		order.IDNumber = req.IDNumber
	}
	if req.Phone != "" {
		order.Phone = req.Phone
	}
	if req.InsuranceType != "" {
		order.InsuranceType = req.InsuranceType
	}
	if req.InsuranceAmount != nil {
		order.InsuranceAmount = *req.InsuranceAmount
	}
	if req.Premium != nil {
		order.Premium = *req.Premium
	}
	if req.InsurancePeriod != "" {
		order.InsurancePeriod = req.InsurancePeriod
	}
	if !req.StartDate.IsZero() {
		order.StartDate = &req.StartDate
	}
	if !req.EndDate.IsZero() {
		order.EndDate = &req.EndDate
	}
	if !req.Deadline.IsZero() {
		order.Deadline = &req.Deadline
	}
	if req.Remark != "" {
		order.Remark = req.Remark
	}
	order.Version++

	if err := database.DB.Save(&order).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, NewAPIError(500, "保存失败", err.Error()))
		return
	}
	respondOK(c, order)
}

type ActionOrderRequest struct {
	Action          string   `json:"action" binding:"required"`
	Version         int      `json:"version"`
	Remark          string   `json:"remark"`
	Reason          string   `json:"reason"`
	RequiredEvidence []string `json:"required_evidence"`
	Attachments     []struct {
		FileName   string `json:"file_name"`
		FileType   string `json:"file_type"`
		FileSize   int64  `json:"file_size"`
		FileURL    string `json:"file_url"`
		Category   string `json:"category"`
		IsEvidence bool   `json:"is_evidence"`
	} `json:"attachments"`
}

func ActionPatrolOrder(c *gin.Context) {
	user := middleware.GetUserContext(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "无效的ID"))
		return
	}

	var req ActionOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "参数错误", err.Error()))
		return
	}

	var order models.PatrolOrder
	if err := database.DB.Preload("Attachments").First(&order, id).Error; err != nil {
		respondErr(c, http.StatusNotFound, NewAPIError(404, "投保申请不存在"))
		return
	}

	if req.Version > 0 && req.Version != order.Version {
		respondErr(c, http.StatusConflict, NewAPIError(409, "版本冲突",
			fmt.Sprintf("当前版本为%d，您的操作基于旧版本%d，请刷新后重试", order.Version, req.Version)))
		return
	}

	if err := validateActionPermission(user.Role, req.Action); err != nil {
		respondErr(c, http.StatusForbidden, NewAPIError(403, err.Error()))
		return
	}

	handlerMatch := true
	if order.CurrentHandlerID != "" && order.CurrentHandlerID != user.UserID {
		handlerMatch = false
	}
	if !handlerMatch {
		if !((user.Role == config.RoleUnderwriter && order.Status == config.StatusPending) ||
			(user.Role == config.RoleBusinessOwner && (order.Status == config.StatusApproved || order.Status == config.StatusSynced))) {
			if req.Action != config.ActionSupplement && req.Action != config.ActionResubmit {
				respondErr(c, http.StatusForbidden, NewAPIError(403, "当前处理人不匹配",
					fmt.Sprintf("当前处理人为%s，您是%s", order.CurrentHandler, user.UserName)))
				return
			}
		}
	}

	nextStatus, err := validateStatusFlow(order.Status, req.Action)
	if err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, err.Error()))
		return
	}

	if req.Action == config.ActionApprove || req.Action == config.ActionSync {
		hasEvidence := len(order.Attachments) > 0
		if !hasEvidence && len(req.Attachments) == 0 {
			respondErr(c, http.StatusBadRequest, NewAPIError(400, "缺少必填证据",
				"出单确认前必须上传投保单、身份证明等必需附件"))
			return
		}
		if len(req.RequiredEvidence) > 0 {
			existingCats := map[string]bool{}
			for _, a := range order.Attachments {
				if a.IsEvidence {
					existingCats[a.Category] = true
				}
			}
			for _, cat := range req.RequiredEvidence {
				if !existingCats[cat] {
					respondErr(c, http.StatusBadRequest, NewAPIError(400, "缺少必填证据",
						fmt.Sprintf("缺少必需的证据类别：%s", cat)))
					return
				}
			}
		}
	}

	now := time.Now()
	prevStatus := order.Status

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		for _, a := range req.Attachments {
			att := models.Attachment{
				PatrolOrderID: order.ID,
				FileName:      a.FileName,
				FileType:      a.FileType,
				FileSize:      a.FileSize,
				FileURL:       a.FileURL,
				Category:      a.Category,
				IsEvidence:    a.IsEvidence,
				UploaderID:    user.UserID,
				UploaderName:  user.UserName,
			}
			if err := tx.Create(&att).Error; err != nil {
				return err
			}
			if a.IsEvidence {
				order.EvidenceUploaded = true
			}
		}

		switch req.Action {
		case config.ActionSubmit:
		case config.ActionApprove:
			order.CurrentHandlerID = "bo_01"
			order.CurrentHandler = "业务负责人-陈"
		case config.ActionReject:
			if order.Status == config.StatusPending || order.Status == config.StatusSupplement {
				nextStatus = config.StatusSupplement
				order.SupplementReason = req.Reason
			} else {
				order.RejectReason = req.Reason
			}
			order.CurrentHandlerID = order.CreatorID
			order.CurrentHandler = order.CreatorName
		case config.ActionSupplement:
			if user.Role != config.RoleCustomerManager {
				return errors.New("仅客户经理可补正资料")
			}
			if order.Status != config.StatusSupplement && order.Status != config.StatusPending {
				return fmt.Errorf("状态为%s时无法执行补正操作", order.Status)
			}
		case config.ActionResubmit:
			if user.Role != config.RoleCustomerManager {
				return errors.New("仅客户经理可重新提交")
			}
			if order.Status != config.StatusSupplement && order.Status != config.StatusRejected {
				return fmt.Errorf("状态为%s时无法重新提交", order.Status)
			}
			nextStatus = config.StatusPending
			order.CurrentHandlerID = "underwriter_01"
			order.CurrentHandler = "核保专员-李"
			order.AbnormalReason = ""
		case config.ActionSync:
			if user.Role != config.RoleBusinessOwner {
				return errors.New("仅业务负责人可执行同步操作")
			}
			order.ConfirmEvidence = true
			order.CurrentHandler = user.UserName
			order.CurrentHandlerID = user.UserID
		case config.ActionArchive:
			if user.Role != config.RoleBusinessOwner {
				return errors.New("仅业务负责人可归档")
			}
		}

		order.Status = nextStatus
		order.Version++
		order.UpdatedAt = now

		if order.Deadline != nil && now.After(*order.Deadline) &&
			(nextStatus == config.StatusPending || nextStatus == config.StatusApproved) {
			if order.AbnormalReason == "" {
				order.AbnormalReason = "办理超时"
			}
		}

		if err := tx.Save(&order).Error; err != nil {
			return err
		}

		h := models.OrderHistory{
			PatrolOrderID:  order.ID,
			Action:         req.Action,
			PreviousStatus: prevStatus,
			CurrentStatus:  nextStatus,
			OperatorID:     user.UserID,
			OperatorName:   user.UserName,
			OperatorRole:   user.Role,
			Remark:         req.Remark,
			AbnormalReason: req.Reason,
			CreatedAt:      now,
		}
		if err := tx.Create(&h).Error; err != nil {
			return err
		}

		if req.Reason != "" {
			noteType := "remark"
			if req.Action == config.ActionReject {
				noteType = "reject"
			} else if req.Action == config.ActionSupplement || req.Action == config.ActionResubmit {
				noteType = "supplement"
			}
			an := models.AuditNote{
				PatrolOrderID: order.ID,
				NoteType:      noteType,
				Content:       req.Reason,
				OperatorID:    user.UserID,
				OperatorName:  user.UserName,
				CreatedAt:     now,
			}
			if err := tx.Create(&an).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "操作失败", err.Error()))
		return
	}

	respondOK(c, gin.H{
		"id":          order.ID,
		"status":      order.Status,
		"version":    order.Version,
		"prev_status": prevStatus,
		"next_status": nextStatus,
		"action":     req.Action,
	})
}

func validateActionPermission(role, action string) error {
	perms, ok := config.RoleActionPermissions[role]
	if !ok {
		return fmt.Errorf("未知角色：%s", role)
	}
	if !perms[action] {
		roleName := config.RoleNames[role]
		return fmt.Errorf("%s无权执行操作：%s", roleName, action)
	}
	return nil
}

func validateStatusFlow(currentStatus, action string) (string, error) {
	switch action {
	case config.ActionSubmit, config.ActionResubmit:
		return config.StatusPending, nil
	case config.ActionApprove:
		if currentStatus == config.StatusPending || currentStatus == config.StatusSupplement {
			return config.StatusApproved, nil
		}
		return "", fmt.Errorf("当前状态%s不允许审核通过", currentStatus)
	case config.ActionReject:
		if currentStatus == config.StatusPending || currentStatus == config.StatusSupplement {
			return config.StatusSupplement, nil
		}
		if currentStatus == config.StatusApproved {
			return config.StatusRejected, nil
		}
		return "", fmt.Errorf("当前状态%s不允许退回", currentStatus)
	case config.ActionSupplement:
		return currentStatus, nil
	case config.ActionSync:
		if currentStatus == config.StatusApproved {
			return config.StatusSynced, nil
		}
		return "", fmt.Errorf("当前状态%s不允许同步", currentStatus)
	case config.ActionArchive:
		if currentStatus == config.StatusSynced {
			return config.StatusCompleted, nil
		}
		return "", fmt.Errorf("当前状态%s不允许归档", currentStatus)
	default:
		return "", fmt.Errorf("未知操作：%s", action)
	}
}

type BatchActionRequest struct {
	IDs              []uint            `json:"ids" binding:"required"`
	Action           string             `json:"action" binding:"required"`
	Version          map[uint]int       `json:"versions"`
	Reason           string             `json:"reason"`
	Remark           string             `json:"remark"`
	RequiredEvidence []string            `json:"required_evidence"`
}

type BatchResultItem struct {
	ID      uint   `json:"id"`
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Status  string `json:"status,omitempty"`
}

func BatchActionPatrolOrders(c *gin.Context) {
	user := middleware.GetUserContext(c)
	var req BatchActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "参数错误", err.Error()))
		return
	}

	if len(req.IDs) == 0 {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "请选择至少一条记录"))
		return
	}

	if len(req.IDs) > 100 {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "批量处理最多100条"))
		return
	}

	if err := validateActionPermission(user.Role, req.Action); err != nil {
		respondErr(c, http.StatusForbidden, NewAPIError(403, err.Error()))
		return
	}

	results := make([]BatchResultItem, 0, len(req.IDs))

	for _, id := range req.IDs {
		item := BatchResultItem{ID: id}

		var order models.PatrolOrder
		if err := database.DB.Preload("Attachments").First(&order, id).Error; err != nil {
			item.Success = false
			item.Message = "记录不存在"
			results = append(results, item)
			continue
		}

		expectVersion, hasVer := req.Version[id]
		if hasVer && expectVersion != order.Version {
			item.Success = false
			item.Message = fmt.Sprintf("版本冲突：当前版本%d，旧版本%d", order.Version, expectVersion)
			results = append(results, item)
			continue
		}

		handlerMatch := true
		if order.CurrentHandlerID != "" && order.CurrentHandlerID != user.UserID {
			handlerMatch = false
		}
		if !handlerMatch {
			if !((user.Role == config.RoleUnderwriter && order.Status == config.StatusPending) ||
				(user.Role == config.RoleBusinessOwner && (order.Status == config.StatusApproved || order.Status == config.StatusSynced))) {
				item.Success = false
				item.Message = fmt.Sprintf("处理人不匹配：当前处理人%s", order.CurrentHandler)
				results = append(results, item)
				continue
			}
		}

		nextStatus, flowErr := validateStatusFlow(order.Status, req.Action)
		if flowErr != nil {
			item.Success = false
			item.Message = flowErr.Error()
			results = append(results, item)
			continue
		}

		if (req.Action == config.ActionApprove || req.Action == config.ActionSync) && len(req.RequiredEvidence) > 0 {
			cats := map[string]bool{}
			for _, a := range order.Attachments {
				if a.IsEvidence {
					cats[a.Category] = true
				}
			}
			missing := []string{}
			for _, cat := range req.RequiredEvidence {
				if !cats[cat] {
					missing = append(missing, cat)
				}
			}
			if len(missing) > 0 {
				item.Success = false
				item.Message = fmt.Sprintf("缺少必需证据：%v", missing)
				results = append(results, item)
				continue
			}
		}

		now := time.Now()
		prevStatus := order.Status
		err := database.DB.Transaction(func(tx *gorm.DB) error {
			switch req.Action {
			case config.ActionApprove:
				order.CurrentHandlerID = "bo_01"
				order.CurrentHandler = "业务负责人-陈"
			case config.ActionReject:
				if order.Status == config.StatusPending || order.Status == config.StatusSupplement {
					nextStatus = config.StatusSupplement
					order.SupplementReason = req.Reason
				} else {
					order.RejectReason = req.Reason
				}
				order.CurrentHandlerID = order.CreatorID
				order.CurrentHandler = order.CreatorName
			case config.ActionResubmit:
				nextStatus = config.StatusPending
				order.CurrentHandlerID = "underwriter_01"
				order.CurrentHandler = "核保专员-李"
				order.AbnormalReason = ""
			case config.ActionSync:
				order.ConfirmEvidence = true
				order.CurrentHandler = user.UserName
				order.CurrentHandlerID = user.UserID
			}

			order.Status = nextStatus
			order.Version++
			order.UpdatedAt = now

			if err := tx.Save(&order).Error; err != nil {
				return err
			}

			h := models.OrderHistory{
				PatrolOrderID:  order.ID,
				Action:         req.Action,
				PreviousStatus: prevStatus,
				CurrentStatus:  nextStatus,
				OperatorID:     user.UserID,
				OperatorName:   user.UserName,
				OperatorRole:   user.Role,
				Remark:         req.Remark,
				AbnormalReason: req.Reason,
				CreatedAt:      now,
			}
			if err := tx.Create(&h).Error; err != nil {
				return err
			}

			if req.Reason != "" {
				noteType := "remark"
				if req.Action == config.ActionReject {
					noteType = "reject"
				} else if req.Action == config.ActionResubmit {
					noteType = "supplement"
				}
				an := models.AuditNote{
					PatrolOrderID: order.ID,
					NoteType:      noteType,
					Content:       req.Reason,
					OperatorID:    user.UserID,
					OperatorName:  user.UserName,
					CreatedAt:     now,
				}
				if err := tx.Create(&an).Error; err != nil {
					return err
				}
			}
			return nil
		})

		if err != nil {
			item.Success = false
			item.Message = err.Error()
		} else {
			item.Success = true
			item.Status = order.Status
			item.Message = "处理成功"
		}
		results = append(results, item)
	}

	successCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		}
	}

	respondOK(c, gin.H{
		"total":         len(results),
		"success_count": successCount,
		"fail_count":    len(results) - successCount,
		"results":       results,
	})
}

func GetPatrolOrderHistory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "无效的ID"))
		return
	}

	var histories []models.OrderHistory
	database.DB.Where("patrol_order_id = ?", id).Order("created_at ASC").Find(&histories)
	respondOK(c, histories)
}

type ListAttachmentsQuery struct {
	PatrolOrderID uint `form:"patrol_order_id"`
}

func ListAttachments(c *gin.Context) {
	var q ListAttachmentsQuery
	c.ShouldBindQuery(&q)
	query := database.DB.Model(&models.Attachment{})
	if q.PatrolOrderID > 0 {
		query = query.Where("patrol_order_id = ?", q.PatrolOrderID)
	}
	var list []models.Attachment
	query.Order("created_at DESC").Find(&list)
	respondOK(c, list)
}

type CreateAttachmentRequest struct {
	PatrolOrderID uint   `json:"patrol_order_id" binding:"required"`
	FileName      string `json:"file_name" binding:"required"`
	FileType      string `json:"file_type"`
	FileSize      int64  `json:"file_size"`
	FileURL       string `json:"file_url"`
	Category      string `json:"category"`
	IsEvidence    bool   `json:"is_evidence"`
}

func CreateAttachment(c *gin.Context) {
	user := middleware.GetUserContext(c)
	var req CreateAttachmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "参数错误", err.Error()))
		return
	}

	var order models.PatrolOrder
	if err := database.DB.First(&order, req.PatrolOrderID).Error; err != nil {
		respondErr(c, http.StatusNotFound, NewAPIError(404, "投保申请不存在"))
		return
	}

	if user.Role == config.RoleCustomerManager && order.CreatorID != user.UserID {
		respondErr(c, http.StatusForbidden, NewAPIError(403, "无权上传", "只能为自己创建的申请上传附件"))
		return
	}
	if user.Role == config.RoleUnderwriter && order.Status != config.StatusPending {
		respondErr(c, http.StatusForbidden, NewAPIError(403, "无权上传", "当前状态不允许上传附件"))
		return
	}

	att := models.Attachment{
		PatrolOrderID: req.PatrolOrderID,
		FileName:      req.FileName,
		FileType:      req.FileType,
		FileSize:      req.FileSize,
		FileURL:       req.FileURL,
		Category:      req.Category,
		IsEvidence:    req.IsEvidence,
		UploaderID:    user.UserID,
		UploaderName:  user.UserName,
	}

	database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&att).Error; err != nil {
			return err
		}
		if att.IsEvidence {
			tx.Model(&order).Update("evidence_uploaded", true)
		}
		tx.Model(&order).Update("version", gorm.Expr("version + 1"))
		return nil
	})

	respondOK(c, att)
}

func DeleteAttachment(c *gin.Context) {
	user := middleware.GetUserContext(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		respondErr(c, http.StatusBadRequest, NewAPIError(400, "无效的ID"))
		return
	}
	var att models.Attachment
	if err := database.DB.First(&att, id).Error; err != nil {
		respondErr(c, http.StatusNotFound, NewAPIError(404, "附件不存在"))
		return
	}
	if att.UploaderID != user.UserID && user.Role != config.RoleBusinessOwner {
		respondErr(c, http.StatusForbidden, NewAPIError(403, "无权删除"))
		return
	}
	database.DB.Delete(&att)
	respondOK(c, gin.H{"id": id})
}

func randomDigits(n int) string {
	const digits = "0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = digits[rand.Intn(len(digits))]
	}
	return string(b)
}
