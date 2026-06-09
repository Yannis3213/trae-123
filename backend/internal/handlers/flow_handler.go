package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"prescription-flow/internal/middleware"
	"prescription-flow/internal/models"
	"prescription-flow/internal/services"
)

type FlowHandler struct {
	service *services.FlowService
}

func NewFlowHandler() *FlowHandler {
	return &FlowHandler{
		service: services.NewFlowService(),
	}
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, models.ApiError{Code: status, Message: message})
}

func (h *FlowHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "prescription-flow-api"})
}

func (h *FlowHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.service.GetUsers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *FlowHandler) GetStatistics(w http.ResponseWriter, r *http.Request) {
	stats, err := h.service.GetStatistics()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *FlowHandler) ListFlows(w http.ResponseWriter, r *http.Request) {
	statusFilter := r.URL.Query().Get("status")
	urgencyFilter := r.URL.Query().Get("urgency")
	roleFilter := r.URL.Query().Get("role")
	operator := r.URL.Query().Get("operator")

	flows, err := h.service.ListFlows(statusFilter, urgencyFilter, roleFilter, operator)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, flows)
}

func (h *FlowHandler) GetFlow(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "无效的处方流转单ID")
		return
	}

	flow, err := h.service.GetFlowByID(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	records, _ := h.service.GetProcessRecords(id)
	abnormalReasons, _ := h.service.GetAbnormalReasons(id)
	auditNotes, _ := h.service.GetAuditNotes(id)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"flow":             flow,
		"process_records":  records,
		"abnormal_reasons": abnormalReasons,
		"audit_notes":      auditNotes,
	})
}

func (h *FlowHandler) CreateFlow(w http.ResponseWriter, r *http.Request) {
	var req models.CreateFlowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数错误: "+err.Error())
		return
	}

	user := middleware.GetCurrentUser(r)
	if user != nil {
		req.Operator = user.Username
		req.OperatorRole = user.Role
	}

	if req.PatientName == "" {
		writeError(w, http.StatusBadRequest, "患者姓名不能为空")
		return
	}

	flow, err := h.service.CreateFlow(&req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, flow)
}

func (h *FlowHandler) ProcessFlow(w http.ResponseWriter, r *http.Request) {
	var req models.ProcessFlowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数错误: "+err.Error())
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "无效的处方流转单ID")
		return
	}
	req.FlowID = id

	user := middleware.GetCurrentUser(r)
	if user != nil {
		req.Operator = user.Username
		req.OperatorRole = user.Role
	}

	flow, err := h.service.ProcessFlow(&req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, flow)
}

func (h *FlowHandler) BatchProcess(w http.ResponseWriter, r *http.Request) {
	var req models.BatchProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数错误: "+err.Error())
		return
	}

	if len(req.FlowIDs) == 0 {
		writeError(w, http.StatusBadRequest, "请选择要批量处理的处方流转单")
		return
	}

	user := middleware.GetCurrentUser(r)
	if user != nil {
		req.Operator = user.Username
		req.OperatorRole = user.Role
	}

	results, err := h.service.BatchProcess(&req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"results": results,
		"total":   len(results),
	})
}

func (h *FlowHandler) GetProcessRecords(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "无效的处方流转单ID")
		return
	}

	records, err := h.service.GetProcessRecords(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, records)
}

func (h *FlowHandler) GetAbnormalReasons(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "无效的处方流转单ID")
		return
	}

	reasons, err := h.service.GetAbnormalReasons(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, reasons)
}

func (h *FlowHandler) GetAuditNotes(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "无效的处方流转单ID")
		return
	}

	notes, err := h.service.GetAuditNotes(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, notes)
}
