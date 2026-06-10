package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"workshop-system/internal/models"
	"workshop-system/internal/services"
	"workshop-system/internal/utils"
)

type Handler struct {
	authService      *services.AuthService
	workOrderService *services.WorkOrderService
}

func NewHandler() *Handler {
	return &Handler{
		authService:      services.NewAuthService(),
		workOrderService: services.NewWorkOrderService(),
	}
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.ErrorResponse(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	result, err := h.authService.Login(&req)
	if err != nil {
		utils.ErrorResponse(w, http.StatusInternalServerError, "登录失败")
		return
	}
	if result == nil {
		utils.ErrorResponse(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}

	utils.JSONResponse(w, http.StatusOK, result)
}

func (h *Handler) GetStatistics(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r)
	stats, err := h.workOrderService.GetStatistics(user)
	if err != nil {
		utils.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	utils.JSONResponse(w, http.StatusOK, stats)
}

func (h *Handler) GetWorkOrderList(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r)

	req := &models.WorkOrderListRequest{
		Page:            1,
		PageSize:        20,
		Status:          models.WorkOrderStatus(r.URL.Query().Get("status")),
		AppointmentClue: r.URL.Query().Get("appointment_clue"),
		WarningLevel:    models.WarningLevel(r.URL.Query().Get("warning_level")),
		LicensePlate:    r.URL.Query().Get("license_plate"),
	}

	if page, _ := strconv.Atoi(r.URL.Query().Get("page")); page > 0 {
		req.Page = page
	}
	if pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size")); pageSize > 0 {
		req.PageSize = pageSize
	}

	list, total, err := h.workOrderService.GetList(req, user)
	if err != nil {
		utils.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.JSONResponse(w, http.StatusOK, map[string]interface{}{
		"list":  list,
		"total": total,
		"page":  req.Page,
		"size":  req.PageSize,
	})
}

func (h *Handler) GetWorkOrderDetail(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r)
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)

	detail, err := h.workOrderService.GetDetail(id, user)
	if err != nil {
		if err == services.ErrWorkOrderNotFound {
			utils.ErrorResponse(w, http.StatusNotFound, err.Error())
		} else if err == services.ErrPermissionDenied {
			utils.ErrorResponse(w, http.StatusForbidden, err.Error())
		} else {
			utils.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	utils.JSONResponse(w, http.StatusOK, detail)
}

func (h *Handler) CreateWorkOrder(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r)

	var req models.WorkOrderCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.ErrorResponse(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	order, err := h.workOrderService.Create(&req, user)
	if err != nil {
		if err == services.ErrPermissionDenied {
			utils.ErrorResponse(w, http.StatusForbidden, err.Error())
		} else {
			utils.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	utils.JSONResponse(w, http.StatusCreated, order)
}

func (h *Handler) ProcessWorkOrder(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r)
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)

	var req models.WorkOrderProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.ErrorResponse(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	detail, err := h.workOrderService.Process(id, &req, user)
	if err != nil {
		switch err {
		case services.ErrWorkOrderNotFound:
			utils.ErrorResponse(w, http.StatusNotFound, err.Error())
		case services.ErrPermissionDenied, services.ErrInvalidHandler:
			utils.ErrorResponse(w, http.StatusForbidden, err.Error())
		case services.ErrVersionMismatch, services.ErrStatusConflict:
			utils.ErrorResponse(w, http.StatusConflict, err.Error())
		case services.ErrMissingEvidence, services.ErrInvalidStatus:
			utils.ErrorResponse(w, http.StatusBadRequest, err.Error())
		default:
			utils.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	utils.JSONResponse(w, http.StatusOK, detail)
}

func (h *Handler) BatchProcessWorkOrders(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r)

	var req models.BatchOperationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.ErrorResponse(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	if len(req.IDs) == 0 {
		utils.ErrorResponse(w, http.StatusBadRequest, "请选择要处理的工单")
		return
	}

	result, err := h.workOrderService.BatchProcess(&req, user)
	if err != nil {
		utils.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.JSONResponse(w, http.StatusOK, result)
}

func (h *Handler) AddAuditNote(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r)
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)

	var body struct {
		Note string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		utils.ErrorResponse(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	if body.Note == "" {
		utils.ErrorResponse(w, http.StatusBadRequest, "备注不能为空")
		return
	}

	err := h.workOrderService.AddAuditNote(id, body.Note, user)
	if err != nil {
		utils.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.JSONResponse(w, http.StatusOK, map[string]string{"message": "备注添加成功"})
}

func (h *Handler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r)
	utils.JSONResponse(w, http.StatusOK, user)
}
