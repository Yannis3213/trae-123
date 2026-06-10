package handlers

import (
	"net/http"

	"coldchain/models"

	"github.com/gin-gonic/gin"
)

func BatchProcess(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	action, _ := body["action"].(string)
	remark, _ := body["remark"].(string)
	temperatureZone, _ := body["temperature_zone"].(string)

	idsRaw, ok := body["ids"].([]interface{})
	if !ok {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "ids字段无效"})
		return
	}

	var ids []int64
	for _, v := range idsRaw {
		switch val := v.(type) {
		case float64:
			ids = append(ids, int64(val))
		case int64:
			ids = append(ids, val)
		}
	}

	userID, _ := c.Get("userID")
	role, _ := c.Get("role")

	var results []models.BatchResultItem

	for _, id := range ids {
		var result models.BatchResultItem
		result.ID = id

		var orderNo string
		DB.QueryRow("SELECT order_no FROM applications WHERE id = ?", id).Scan(&orderNo)
		result.OrderNo = orderNo

		var actionResp ActionResponse

		switch action {
		case "submit":
			actionResp = doSubmit(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: getVersion(id),
			})
		case "allocate":
			actionResp = doAllocate(ActionContext{
				AppID:           id,
				UserID:          userID.(int64),
				Role:            role.(string),
				Version:         getVersion(id),
				TemperatureZone: temperatureZone,
			})
		case "confirm":
			actionResp = doConfirm(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: getVersion(id),
			})
		case "return":
			actionResp = doReturn(ActionContext{
				AppID:          id,
				UserID:         userID.(int64),
				Role:           role.(string),
				Version:        getVersion(id),
				CorrectionNote: remark,
			})
		case "correct":
			actionResp = doCorrect(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: getVersion(id),
			})
		default:
			result.Success = false
			result.Reason = "不支持的操作: " + action
			results = append(results, result)
			continue
		}

		result.Success = actionResp.Success
		result.OrderNo = actionResp.OrderNo
		if !actionResp.Success {
			result.Reason = actionResp.Message
		}

		results = append(results, result)
	}

	c.JSON(http.StatusOK, models.BatchResponse{Results: results})
}

func BatchAdvanceOverdue(c *gin.Context) {
	var req struct {
		IDs []int64 `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	userID, _ := c.Get("userID")
	role, _ := c.Get("role")

	var results []models.BatchResultItem

	for _, id := range req.IDs {
		var result models.BatchResultItem
		result.ID = id

		var orderNo, status string
		DB.QueryRow("SELECT order_no, status FROM applications WHERE id = ?", id).Scan(&orderNo, &status)
		result.OrderNo = orderNo

		var actionResp ActionResponse

		switch status {
		case "draft":
			actionResp = doSubmit(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: getVersion(id),
			})
		case "pending_temp":
			actionResp = doAllocate(ActionContext{
				AppID:           id,
				UserID:          userID.(int64),
				Role:            role.(string),
				Version:         getVersion(id),
				TemperatureZone: "frozen",
			})
		case "under_review":
			actionResp = doConfirm(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: getVersion(id),
			})
		case "pending_correction":
			actionResp = doCorrect(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: getVersion(id),
			})
		case "completed":
			result.Success = false
			result.Reason = "单据已完成，无需推进"
			results = append(results, result)
			continue
		default:
			result.Success = false
			result.Reason = "未知状态: " + status
			results = append(results, result)
			continue
		}

		result.Success = actionResp.Success
		result.OrderNo = actionResp.OrderNo
		if !actionResp.Success {
			result.Reason = actionResp.Message
		}

		results = append(results, result)
	}

	c.JSON(http.StatusOK, models.BatchResponse{Results: results})
}

func getVersion(appID int64) int {
	var version int
	DB.QueryRow("SELECT version FROM applications WHERE id = ?", appID).Scan(&version)
	return version
}
