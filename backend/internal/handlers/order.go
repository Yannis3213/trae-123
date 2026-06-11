package handlers

import (
	"encoding/json"
	"net/http"

	"hr-onboarding/internal/database"
	"hr-onboarding/internal/middleware"
	"hr-onboarding/internal/models"
	"hr-onboarding/internal/service"
)

type orderHandler struct{}

func NewOrderHandler() *orderHandler {
	return &orderHandler{}
}

func (h *orderHandler) List(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetCurrentUser(r)

	query := r.URL.Query()
	status := query.Get("status")
	node := query.Get("node")
	search := query.Get("search")
	roleFilter := query.Get("role")

	filterRole := user.Role
	if roleFilter != "" && (roleFilter == user.Role || user.Role == models.RoleReviewer) {
		filterRole = roleFilter
	}

	orders, err := database.ListOrders(filterRole, status, node, search)
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
	id := getURLParam(r, "id")
	order, err := database.GetOrderByID(id)
	if err != nil {
		writeError(w, 404, "单据不存在", "入职办理单 "+id+" 不存在")
		return
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

	writeJSON(w, 200, map[string]interface{}{
		"message": "添加成功",
		"note":    note,
	})
}
