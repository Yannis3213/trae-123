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

		version := getVersion(id)
		var actionResp ActionResponse

		switch action {
		case "submit":
			actionResp = doSubmit(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: version,
			})
		case "allocate":
			actionResp = doAllocate(ActionContext{
				AppID:           id,
				UserID:          userID.(int64),
				Role:            role.(string),
				Version:         version,
				TemperatureZone: temperatureZone,
			})
		case "confirm":
			actionResp = doConfirm(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: version,
			})
		case "return":
			actionResp = doReturn(ActionContext{
				AppID:          id,
				UserID:         userID.(int64),
				Role:           role.(string),
				Version:        version,
				CorrectionNote: remark,
			})
		case "correct":
			actionResp = doCorrect(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: version,
			})
		default:
			result.Success = false
			result.Reason = "不支持的操作: " + action
			results = append(results, result)
			continue
		}

		result.Success = actionResp.Success
		result.OrderNo = actionResp.OrderNo
		result.ErrorCode = actionResp.Code
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
		var creatorID, handlerID int64
		var version int
		var productName, expectedDate, temperatureZone, correctionNote string
		err := DB.QueryRow(
			"SELECT order_no, status, creator_id, handler_id, version, product_name, expected_date, temperature_zone, COALESCE(correction_note, '') FROM applications WHERE id = ?", id,
		).Scan(&orderNo, &status, &creatorID, &handlerID, &version, &productName, &expectedDate, &temperatureZone, &correctionNote)
		if err != nil {
			result.OrderNo = orderNo
			result.Success = false
			result.ErrorCode = "NOT_FOUND"
			result.Reason = "单据不存在"
			results = append(results, result)
			continue
		}
		result.OrderNo = orderNo

		if expectedDate == "" || calculateExpiryGroup(expectedDate) != "overdue" {
			result.Success = false
			result.ErrorCode = "NOT_OVERDUE"
			result.Reason = "该单据未逾期，无法从逾期推进通道处理"
			results = append(results, result)
			continue
		}

		var roleName string
		switch role.(string) {
		case "warehouse_clerk":
			roleName = "仓管员"
		case "temp_supervisor":
			roleName = "温控主管"
		case "warehouse_manager":
			roleName = "仓储经理"
		default:
			roleName = role.(string)
		}

		var expectedHandler string
		switch status {
		case "draft", "pending_correction":
			var name string
			DB.QueryRow("SELECT display_name FROM users WHERE id = ?", creatorID).Scan(&name)
			expectedHandler = name
		case "pending_temp":
			var name string
			if handlerID > 0 {
				DB.QueryRow("SELECT display_name FROM users WHERE id = ?", handlerID).Scan(&name)
			} else {
				DB.QueryRow("SELECT display_name FROM users WHERE role = 'temp_supervisor' LIMIT 1").Scan(&name)
			}
			expectedHandler = name
		case "under_review":
			var name string
			DB.QueryRow("SELECT display_name FROM users WHERE role = 'warehouse_manager' LIMIT 1").Scan(&name)
			expectedHandler = name
		case "completed":
			expectedHandler = "-"
		default:
			expectedHandler = "-"
		}

		var actionResp ActionResponse

		switch status {
		case "draft":
			if role.(string) != "warehouse_clerk" {
				result.Success = false
				result.ErrorCode = "ROLE_FORBIDDEN"
				result.Reason = "逾期单据为草稿状态，需要[仓管员]角色提交，当前角色为[" + roleName + "]"
				results = append(results, result)
				continue
			}
			if creatorID != userID.(int64) {
				result.Success = false
				result.ErrorCode = "CROSS_ROLE"
				result.Reason = "逾期草稿单据的当前处理人是[" + expectedHandler + "]，您无权推进"
				results = append(results, result)
				continue
			}
			if productName == "" || expectedDate == "" {
				result.Success = false
				result.ErrorCode = "EVIDENCE_MISSING"
				result.Reason = "逾期草稿缺少必填证据：品名/预计到期日，请先到详情页补正后再推进"
				results = append(results, result)
				continue
			}
			actionResp = doSubmit(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: version,
			})
		case "pending_temp":
			if role.(string) != "temp_supervisor" {
				result.Success = false
				result.ErrorCode = "ROLE_FORBIDDEN"
				result.Reason = "逾期单据为待温控分配状态，需要[温控主管]角色分配，当前角色为[" + roleName + "]"
				results = append(results, result)
				continue
			}
			if handlerID > 0 && handlerID != userID.(int64) {
				result.Success = false
				result.ErrorCode = "CROSS_ROLE"
				result.Reason = "该逾期单据已分配给[" + expectedHandler + "]处理，您无权操作"
				results = append(results, result)
				continue
			}
			actionResp = doAllocate(ActionContext{
				AppID:           id,
				UserID:          userID.(int64),
				Role:            role.(string),
				Version:         version,
				TemperatureZone: "frozen",
			})
		case "under_review":
			if role.(string) != "warehouse_manager" {
				result.Success = false
				result.ErrorCode = "ROLE_FORBIDDEN"
				result.Reason = "逾期单据为复核中状态，需要[仓储经理]角色确认，当前角色为[" + roleName + "]"
				results = append(results, result)
				continue
			}
			actionResp = doConfirm(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: version,
			})
		case "pending_correction":
			if role.(string) != "warehouse_clerk" {
				result.Success = false
				result.ErrorCode = "ROLE_FORBIDDEN"
				result.Reason = "逾期单据为待补正状态，需要[仓管员]角色修正，当前角色为[" + roleName + "]"
				results = append(results, result)
				continue
			}
			if creatorID != userID.(int64) {
				result.Success = false
				result.ErrorCode = "CROSS_ROLE"
				result.Reason = "该待补正逾期单据的当前处理人是[" + expectedHandler + "]，您无权推进"
				results = append(results, result)
				continue
			}
			if productName == "" || expectedDate == "" {
				result.Success = false
				result.ErrorCode = "EVIDENCE_MISSING"
				result.Reason = "逾期待补正单据缺少必填证据：品名/预计到期日，请先到详情页补正"
				results = append(results, result)
				continue
			}
			_ = temperatureZone
			_ = correctionNote
			actionResp = doCorrect(ActionContext{
				AppID:   id,
				UserID:  userID.(int64),
				Role:    role.(string),
				Version: version,
			})
		case "completed":
			result.Success = false
			result.ErrorCode = "DUPLICATE_SUBMIT"
			result.Reason = "单据已办结，无需推进"
			results = append(results, result)
			continue
		default:
			result.Success = false
			result.ErrorCode = "STATUS_CONFLICT"
			result.Reason = "未知状态: " + status + "，无法推进"
			results = append(results, result)
			continue
		}

		result.Success = actionResp.Success
		result.OrderNo = actionResp.OrderNo
		result.ErrorCode = actionResp.Code
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
