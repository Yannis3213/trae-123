package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"hr-onboarding/internal/database"
	"hr-onboarding/internal/middleware"
	"hr-onboarding/internal/models"
	"hr-onboarding/internal/service"
)

type orderHandler struct{}

func NewOrderHandler() *orderHandler {
	return &orderHandler{}
}

func (h *orderHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetCurrentUser(r)

	if user.Role != models.RoleRegistrar {
		writeError(w, 403, "权限不足", "只有入职办理登记员可以发起入职办理单")
		return
	}

	var req models.CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "请求参数错误", err.Error())
		return
	}

	if req.CandidateName == "" || req.Position == "" || req.Department == "" {
		writeError(w, 400, "请求参数错误", "候选人姓名、岗位、部门不能为空")
		return
	}

	dueDate := time.Now().AddDate(0, 0, 15)
	if req.DueDate != "" {
		parsed, err := time.Parse("2006-01-02", req.DueDate)
		if err == nil {
			dueDate = parsed
		}
	}

	order := &models.OnboardingOrder{
		Title:         fmt.Sprintf("%s-%s-入职办理", req.CandidateName, req.Department),
		CandidateName: req.CandidateName,
		Position:      req.Position,
		Department:    req.Department,
		Status:        models.StatusPending,
		CurrentNode:   models.NodeDocs,
		CurrentRole:   models.RoleRegistrar,
		HandlerID:     "",
		HandlerName:   "",
		RegistrarID:   user.ID,
		RegistrarName: user.Name,
		DueDate:       dueDate,
		WarningLevel:  models.WarningNormal,
		Version:       1,
		IsException:   false,
	}

	if err := database.CreateOrder(order); err != nil {
		writeError(w, 500, "创建失败", err.Error())
		return
	}

	record := &models.ProcessRecord{
		OrderID:       order.ID,
		Node:          models.NodeDocs,
		Action:        "create",
		OperatorID:    user.ID,
		OperatorName:  user.Name,
		OperatorRole:  user.Role,
		FromStatus:    "",
		ToStatus:      models.StatusPending,
		FromNode:      "",
		ToNode:        models.NodeDocs,
		Remark:        "登记员发起入职办理单",
		ExceptionType: "",
	}
	if err := database.CreateProcessRecord(record); err != nil {
		writeError(w, 500, "创建处理记录失败", err.Error())
		return
	}

	note := &models.AuditNote{
		OrderID:       order.ID,
		StatusLabel:   "待派发",
		Content:       fmt.Sprintf("%s发起入职办理单登记", user.Name),
		CreatedBy:     user.ID,
		CreatedByName: user.Name,
	}
	if err := database.CreateAuditNote(note); err != nil {
		writeError(w, 500, "创建审计备注失败", err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"message":  "创建成功",
		"order_id": order.ID,
		"order":    order,
	})
}

func (h *orderHandler) AddAttachment(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetCurrentUser(r)
	id := getURLParam(r, "id")

	order, err := database.GetOrderByID(id)
	if err != nil {
		writeError(w, 404, "单据不存在", "入职办理单 "+id+" 不存在")
		return
	}

	if user.Role != models.RoleRegistrar {
		writeError(w, 403, "权限不足", "只有入职办理登记员可以上传/补正附件")
		return
	}

	if order.RegistrarID != user.ID {
		writeError(w, 403, "跨登记员越权", fmt.Sprintf("该单据由 %s 登记，您无权补正附件", order.RegistrarName))
		return
	}

	if order.Status != models.StatusPending && order.Status != models.StatusReturned {
		writeError(w, 409, "状态冲突", fmt.Sprintf("当前状态为 %s，无法补正附件，仅待派发或退回补正状态可上传", service.StatusName(order.Status)))
		return
	}

	var req models.CreateAttachmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "请求参数错误", err.Error())
		return
	}

	if req.Node == "" || req.Type == "" || req.Name == "" {
		writeError(w, 400, "请求参数错误", "节点、附件类型、附件名称不能为空")
		return
	}

	validNodes := map[string]bool{
		models.NodeDocs:     true,
		models.NodeContract: true,
		models.NodeAccount:  true,
	}
	if !validNodes[req.Node] {
		writeError(w, 400, "请求参数错误", "无效的节点类型")
		return
	}

	if req.Node != order.CurrentNode {
		writeError(w, 409, "跨节点越权", fmt.Sprintf("当前办理节点为 %s，仅可补正当前节点附件", service.NodeName(order.CurrentNode)))
		return
	}

	if req.URL == "" {
		req.URL = fmt.Sprintf("/uploads/%s/%s_%s", id, req.Type, req.Name)
	}

	attachment := &models.Attachment{
		OrderID:    id,
		Node:       req.Node,
		Type:       req.Type,
		Name:       req.Name,
		URL:        req.URL,
		UploadedBy: user.ID,
	}

	if err := database.CreateAttachment(attachment); err != nil {
		writeError(w, 500, "上传失败", err.Error())
		return
	}

	if order.ExceptionReason != "" {
		order.ExceptionReason = ""
		if err := database.UpdateOrder(order); err != nil {
			writeError(w, 500, "更新单据异常原因失败", err.Error())
			return
		}
	}

	record := &models.ProcessRecord{
		OrderID:       id,
		Node:          req.Node,
		Action:        "upload_attachment",
		OperatorID:    user.ID,
		OperatorName:  user.Name,
		OperatorRole:  user.Role,
		Remark:        fmt.Sprintf("上传/补正附件：%s（%s）", req.Name, service.NodeName(req.Node)),
		ExceptionType: "",
	}
	_ = database.CreateProcessRecord(record)

	note := &models.AuditNote{
		OrderID:       id,
		StatusLabel:   service.StatusName(order.Status),
		Content:       fmt.Sprintf("登记员%s补正附件：%s（%s节点）", user.Name, req.Name, service.NodeName(req.Node)),
		CreatedBy:     user.ID,
		CreatedByName: user.Name,
	}
	_ = database.CreateAuditNote(note)

	writeJSON(w, 201, map[string]interface{}{
		"message":    "上传成功",
		"attachment": attachment,
	})
}

func (h *orderHandler) List(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetCurrentUser(r)

	query := r.URL.Query()
	status := query.Get("status")
	node := query.Get("node")
	search := query.Get("search")

	var orders []*models.OnboardingOrder
	var err error

	if user.Role == models.RoleReviewer {
		orders, err = database.ListOrders("", status, node, search)
	} else if user.Role == models.RoleRegistrar {
		orders, err = database.ListOrdersByRegistrar(user.ID, status, node, search)
	} else {
		orders, err = database.ListOrders(user.Role, status, node, search)
	}

	if err != nil {
		writeError(w, 500, "查询失败", err.Error())
		return
	}

	for _, o := range orders {
		o.WarningLevel = service.CalcWarningLevel(o.DueDate)
	}

	writeJSON(w, 200, map[string]interface{}{
		"orders": orders,
		"total":  len(orders),
	})
}

func (h *orderHandler) Get(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetCurrentUser(r)
	id := getURLParam(r, "id")

	order, err := database.GetOrderByID(id)
	if err != nil {
		writeError(w, 404, "单据不存在", "入职办理单 "+id+" 不存在")
		return
	}

	if user.Role != models.RoleReviewer {
		if user.Role == models.RoleRegistrar && order.RegistrarID != user.ID {
			writeError(w, 403, "跨登记员越权", fmt.Sprintf("该单据由 %s 登记，您无权访问", order.RegistrarName))
			return
		}
		if user.Role == models.RoleAuditor && order.CurrentRole != models.RoleAuditor {
			writeError(w, 403, "角色越权", fmt.Sprintf("该单据当前由 %s 处理，您作为审核主管仅可查看分配给您的待办", service.RoleName(order.CurrentRole)))
			return
		}
	}

	order.WarningLevel = service.CalcWarningLevel(order.DueDate)

	attachments, err := database.GetAttachmentsByOrder(id)
	if err != nil {
		writeError(w, 500, "查询附件失败", err.Error())
		return
	}

	records, err := database.GetProcessRecords(id)
	if err != nil {
		writeError(w, 500, "查询处理记录失败", err.Error())
		return
	}

	auditNotes, err := database.GetAuditNotes(id)
	if err != nil {
		writeError(w, 500, "查询审计备注失败", err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"order":       order,
		"attachments": attachments,
		"records":     records,
		"audit_notes": auditNotes,
	})
}

func (h *orderHandler) Process(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetCurrentUser(r)
	id := getURLParam(r, "id")

	var req models.ProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "请求参数错误", err.Error())
		return
	}

	order, err := database.GetOrderByID(id)
	if err != nil {
		writeError(w, 404, "单据不存在", "入职办理单 "+id+" 不存在")
		return
	}

	validation := service.ValidateProcess(order, user, &req, req.Action)
	if !validation.Valid {
		writeError(w, validation.Code, "操作失败", validation.Reason)
		return
	}

	if err := service.ProcessOrder(order, user, req.Action, req.Remark); err != nil {
		writeError(w, 500, "处理失败", err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"message":  "操作成功",
		"order_id": order.ID,
		"status":   order.Status,
		"node":     order.CurrentNode,
		"version":  order.Version,
	})
}

func (h *orderHandler) BatchProcess(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetCurrentUser(r)

	var req models.BatchProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "请求参数错误", err.Error())
		return
	}

	if len(req.OrderIDs) == 0 {
		writeError(w, 400, "请求参数错误", "请选择要处理的入职办理单")
		return
	}

	results := make([]models.BatchResultItem, 0, len(req.OrderIDs))
	successCount := 0

	for _, orderID := range req.OrderIDs {
		order, err := database.GetOrderByID(orderID)
		if err != nil {
			results = append(results, models.BatchResultItem{
				OrderID: orderID,
				Success: false,
				Reason:  "单据不存在",
			})
			continue
		}

		procReq := &models.ProcessRequest{
			Action:  req.Action,
			Remark:  req.Remark,
			Version: order.Version,
		}

		validation := service.ValidateProcess(order, user, procReq, req.Action)
		if !validation.Valid {
			results = append(results, models.BatchResultItem{
				OrderID: orderID,
				Success: false,
				Reason:  validation.Reason,
			})
			continue
		}

		if err := service.ProcessOrder(order, user, req.Action, req.Remark); err != nil {
			results = append(results, models.BatchResultItem{
				OrderID: orderID,
				Success: false,
				Reason:  err.Error(),
			})
			continue
		}

		successCount++
		results = append(results, models.BatchResultItem{
			OrderID:   orderID,
			Success:   true,
			Reason:    "处理成功",
			NewStatus: order.Status,
			NewNode:   order.CurrentNode,
		})
	}

	writeJSON(w, 200, map[string]interface{}{
		"total":         len(req.OrderIDs),
		"success_count": successCount,
		"fail_count":    len(req.OrderIDs) - successCount,
		"results":       results,
	})
}

func (h *orderHandler) AddAuditNote(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetCurrentUser(r)
	id := getURLParam(r, "id")

	var body struct {
		StatusLabel string `json:"status_label"`
		Content     string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "请求参数错误", err.Error())
		return
	}

	if body.Content == "" {
		writeError(w, 400, "请求参数错误", "备注内容不能为空")
		return
	}

	order, err := database.GetOrderByID(id)
	if err != nil {
		writeError(w, 404, "单据不存在", "入职办理单 "+id+" 不存在")
		return
	}

	if user.Role != models.RoleReviewer {
		if user.Role == models.RoleRegistrar && order.RegistrarID != user.ID {
			writeError(w, 403, "跨登记员越权", fmt.Sprintf("该单据由 %s 登记，您无权添加审计备注", order.RegistrarName))
			return
		}
		if user.Role == models.RoleAuditor && order.CurrentRole != models.RoleAuditor && order.HandlerID != user.ID {
			writeError(w, 403, "角色越权", "仅当前处理角色或单据处理人可添加审计备注")
			return
		}
	}

	validLabels := map[string]bool{"待派发": true, "处理中": true, "已关闭": true}
	if body.StatusLabel != "" && !validLabels[body.StatusLabel] {
		writeError(w, 400, "请求参数错误", "状态标签仅允许：待派发、处理中、已关闭")
		return
	}

	note := &models.AuditNote{
		OrderID:       order.ID,
		StatusLabel:   body.StatusLabel,
		Content:       body.Content,
		CreatedBy:     user.ID,
		CreatedByName: user.Name,
	}

	if note.StatusLabel == "" {
		note.StatusLabel = service.StatusName(order.Status)
	}

	if err := database.CreateAuditNote(note); err != nil {
		writeError(w, 500, "添加失败", err.Error())
		return
	}

	record := &models.ProcessRecord{
		OrderID:       id,
		Node:          order.CurrentNode,
		Action:        "add_audit_note",
		OperatorID:    user.ID,
		OperatorName:  user.Name,
		OperatorRole:  user.Role,
		Remark:        fmt.Sprintf("添加审计备注[%s]：%s", note.StatusLabel, body.Content),
		ExceptionType: "",
	}
	_ = database.CreateProcessRecord(record)

	writeJSON(w, 200, map[string]interface{}{
		"message": "添加成功",
		"note":    note,
	})
}
