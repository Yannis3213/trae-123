package handler

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"live-selection-backend/internal/middleware"
	"live-selection-backend/internal/model"
	"live-selection-backend/internal/service"
)

func Login(c echo.Context) error {
	var req model.LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "请求参数错误",
			Data:    nil,
		})
	}

	user, token, err := service.Login(req.Username, req.Password)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    401,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "登录成功",
		Data: model.LoginResponse{
			Token: token,
			User:  user,
		},
	})
}

func GetCurrentUser(c echo.Context) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, model.Response{
			Code:    401,
			Message: "未登录",
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "success",
		Data:    user,
	})
}

func GetOrderList(c echo.Context) error {
	user := middleware.GetCurrentUser(c)

	var req model.OrderListRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "请求参数错误",
			Data:    nil,
		})
	}

	result, err := service.GetOrderList(&req, user)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "success",
		Data:    result,
	})
}

func GetOrderDetail(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "无效的订单ID",
			Data:    nil,
		})
	}

	result, err := service.GetOrderDetail(id)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "success",
		Data:    result,
	})
}

func CreateOrder(c echo.Context) error {
	user := middleware.GetCurrentUser(c)

	var req model.CreateOrderRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "请求参数错误",
			Data:    nil,
		})
	}

	order, err := service.CreateOrder(&req, user)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "创建成功",
		Data:    order,
	})
}

func SubmitOrder(c echo.Context) error {
	user := middleware.GetCurrentUser(c)

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "无效的订单ID",
			Data:    nil,
		})
	}

	var req model.SubmitOrderRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "请求参数错误",
			Data:    nil,
		})
	}

	err = service.SubmitOrder(id, &req, user)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "提交审核成功",
		Data:    nil,
	})
}

func AuditOrder(c echo.Context) error {
	user := middleware.GetCurrentUser(c)

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "无效的订单ID",
			Data:    nil,
		})
	}

	var req model.AuditOrderRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "请求参数错误",
			Data:    nil,
		})
	}

	err = service.AuditOrder(id, &req, user)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	if req.Pass {
		return c.JSON(http.StatusOK, model.Response{
			Code:    0,
			Message: "审核通过成功",
			Data:    nil,
		})
	}
	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "退回补正成功",
		Data:    nil,
	})
}

func ReviewOrder(c echo.Context) error {
	user := middleware.GetCurrentUser(c)

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "无效的订单ID",
			Data:    nil,
		})
	}

	var req model.ReviewOrderRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "请求参数错误",
			Data:    nil,
		})
	}

	err = service.ReviewOrder(id, &req, user)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "复核归档成功",
		Data:    nil,
	})
}

func SupplementOrder(c echo.Context) error {
	user := middleware.GetCurrentUser(c)

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "无效的订单ID",
			Data:    nil,
		})
	}

	var req model.SupplementOrderRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "请求参数错误",
			Data:    nil,
		})
	}

	err = service.SupplementOrder(id, &req, user)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "补正成功",
		Data:    nil,
	})
}

func BatchProcess(c echo.Context) error {
	user := middleware.GetCurrentUser(c)

	var req model.BatchProcessRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "请求参数错误",
			Data:    nil,
		})
	}

	result, err := service.BatchProcess(&req, user)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "批量处理完成",
		Data:    result,
	})
}

func GetAuditTrail(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "无效的订单ID",
			Data:    nil,
		})
	}

	remarks, err := service.GetAuditTrail(id)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "success",
		Data:    remarks,
	})
}

func GetOverdueQueue(c echo.Context) error {
	result, err := service.GetOverdueQueue()
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "success",
		Data:    result,
	})
}

func BatchOverduePush(c echo.Context) error {
	user := middleware.GetCurrentUser(c)

	var req model.BatchOverduePushRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "请求参数错误",
			Data:    nil,
		})
	}

	batchReq := &model.BatchProcessRequest{
		Action:   "overdue_push",
		OrderIDs: req.OrderIDs,
		Opinion:  req.Reason,
	}

	result, err := service.BatchProcess(batchReq, user)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "逾期批量推进完成",
		Data:    result,
	})
}

func UploadAttachment(c echo.Context) error {
	user := middleware.GetCurrentUser(c)

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "无效的订单ID",
			Data:    nil,
		})
	}

	var req model.UploadAttachmentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "请求参数错误",
			Data:    nil,
		})
	}

	attachment, err := service.UploadAttachment(id, &req, user)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "上传成功",
		Data:    attachment,
	})
}

func ProcessModule(c echo.Context) error {
	user := middleware.GetCurrentUser(c)

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "无效的订单ID",
			Data:    nil,
		})
	}

	var req model.ProcessModuleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.Response{
			Code:    400,
			Message: "请求参数错误",
			Data:    nil,
		})
	}

	if req.ModuleType == "" {
		return c.JSON(http.StatusOK, model.Response{
			Code:    400,
			Message: "模块类型不能为空",
			Data:    nil,
		})
	}

	err = service.ProcessModule(id, &req, user)
	if err != nil {
		return c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: err.Error(),
			Data:    nil,
		})
	}

	if req.SubmitNext {
		return c.JSON(http.StatusOK, model.Response{
			Code:    0,
			Message: "办理成功，已进入下一阶段",
			Data:    nil,
		})
	}
	return c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "模块办理成功",
		Data:    nil,
	})
}
