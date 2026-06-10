package handlers

import (
	"fmt"
	"net/http"
	"time"

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
	now := time.Now().Format("2006-01-02 15:04:05")

	roleName := roleDisplay(role.(string))

	var results []models.BatchResultItem

	for _, id := range req.IDs {
		var result models.BatchResultItem
		result.ID = id

		var orderNo, status string
		var creatorID, handlerID, currentVersion int64
		var version int
		var productName, expectedDate, temperatureZone, correctionNote string
		err := DB.QueryRow(
			`SELECT order_no, status, creator_id, handler_id, version, product_name, expected_date,
			 COALESCE(temperature_zone, ''), COALESCE(correction_note, '')
			 FROM applications WHERE id = ?`, id,
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
		currentVersion = int64(version)

		expectedHandler := expectedHandlerName(status, creatorID, handlerID)

		if expectedDate == "" || calculateExpiryGroup(expectedDate) != "overdue" {
			recordInterception(id, userID.(int64), "not_overdue",
				fmt.Sprintf("该单据未逾期（%s），无法从逾期推进通道处理", expectedDate), now)
			result.Success = false
			result.ErrorCode = "NOT_OVERDUE"
			result.Reason = "该单据未逾期，无法从逾期推进通道处理"
			results = append(results, result)
			continue
		}

		var expectedRole string
		switch status {
		case "draft", "pending_correction":
			expectedRole = "warehouse_clerk"
		case "pending_temp":
			expectedRole = "temp_supervisor"
		case "under_review":
			expectedRole = "warehouse_manager"
		case "completed":
			expectedRole = "-"
		default:
			expectedRole = "-"
		}

		if status == "completed" {
			recordInterception(id, userID.(int64), "duplicate_submit",
				"单据已办结，无需推进", now)
			result.Success = false
			result.ErrorCode = "DUPLICATE_SUBMIT"
			result.Reason = "单据已办结，无需推进"
			results = append(results, result)
			continue
		}

		if status != "draft" && status != "pending_temp" && status != "under_review" && status != "pending_correction" {
			recordInterception(id, userID.(int64), "status_conflict",
				"未知状态: "+status+"，无法推进", now)
			result.Success = false
			result.ErrorCode = "STATUS_CONFLICT"
			result.Reason = "未知状态: " + status + "，无法推进"
			results = append(results, result)
			continue
		}

		if role.(string) != expectedRole {
			recordInterception(id, userID.(int64), "role_forbidden",
				fmt.Sprintf("逾期单据为[%s]状态，需要[%s]角色，当前角色为[%s]",
					statusLabel(status), roleDisplay(expectedRole), roleName), now)
			result.Success = false
			result.ErrorCode = "ROLE_FORBIDDEN"
			result.Reason = fmt.Sprintf("逾期单据为[%s]状态，需要[%s]角色推进，当前角色为[%s]",
				statusLabel(status), roleDisplay(expectedRole), roleName)
			results = append(results, result)
			continue
		}

		var isOwner bool
		switch status {
		case "draft", "pending_correction":
			isOwner = creatorID == userID.(int64)
		case "pending_temp":
			isOwner = handlerID == 0 || handlerID == userID.(int64)
		case "under_review":
			isOwner = true
		}
		if !isOwner {
			recordInterception(id, userID.(int64), "cross_role",
				fmt.Sprintf("该逾期单据的当前处理人是[%s]，您无权推进", expectedHandler), now)
			result.Success = false
			result.ErrorCode = "CROSS_ROLE"
			result.Reason = fmt.Sprintf("该逾期单据的当前处理人是[%s]（%s），您无权推进",
				expectedHandler, roleDisplay(expectedRole))
			results = append(results, result)
			continue
		}

		missingFields := []string{}
		if productName == "" {
			missingFields = append(missingFields, "品名")
		}
		if expectedDate == "" {
			missingFields = append(missingFields, "预计到期日")
		}
		if len(missingFields) > 0 {
			recordInterception(id, userID.(int64), "evidence_missing",
				fmt.Sprintf("逾期单据缺少必填证据：%s，请先到详情页补正后再推进",
					joinStrings(missingFields, "/")), now)
			result.Success = false
			result.ErrorCode = "EVIDENCE_MISSING"
			result.Reason = fmt.Sprintf("逾期单据缺少必填证据：%s，请先到详情页补正后再推进",
				joinStrings(missingFields, "/"))
			results = append(results, result)
			continue
		}

		var dbVersion int
		DB.QueryRow("SELECT version FROM applications WHERE id = ?", id).Scan(&dbVersion)
		if dbVersion != currentVersion {
			recordInterception(id, userID.(int64), "version_conflict",
				fmt.Sprintf("单据已被他人修改，当前版本为v%d，请刷新后重试（您提交的是v%d）",
					dbVersion, currentVersion), now)
			result.Success = false
			result.ErrorCode = "VERSION_CONFLICT"
			result.Reason = fmt.Sprintf("单据已被他人修改，当前版本为v%d，请刷新后重试（您提交的是v%d）",
				dbVersion, currentVersion)
			results = append(results, result)
			continue
		}

		tx, err := DB.Begin()
		if err != nil {
			result.Success = false
			result.ErrorCode = "DB_ERROR"
			result.Reason = "数据库事务启动失败"
			results = append(results, result)
			continue
		}

		_, err = tx.Exec(
			`INSERT INTO exception_reasons (application_id, operator_id, reason_type, description, created_at)
			 VALUES (?, ?, ?, ?, ?)`,
			id, userID.(int64), "overdue_checked",
			fmt.Sprintf("逾期检查通过：状态[%s]、角色[%s]、责任人[%s]、版本v%d、证据齐全，可在详情页手动推进",
				statusLabel(status), roleName, expectedHandler, currentVersion), now,
		)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.ErrorCode = "DB_ERROR"
			result.Reason = "写入异常原因失败"
			results = append(results, result)
			continue
		}

		err = insertAuditNote(tx, id, userID.(int64),
			fmt.Sprintf("逾期批量推进检查通过（未自动推进状态）：状态[%s]，请前往详情页手动推进", statusLabel(status)), now)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.ErrorCode = "DB_ERROR"
			result.Reason = "写入审计备注失败"
			results = append(results, result)
			continue
		}

		_, err = tx.Exec(
			`INSERT INTO processing_records (application_id, operator_id, action, from_status, to_status, remark, created_at)
			 VALUES (?, ?, 'overdue_check', ?, ?, '逾期批量推进检查通过，未自动推进状态', ?)`,
			id, userID.(int64), status, status, now,
		)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.ErrorCode = "DB_ERROR"
			result.Reason = "写入处理记录失败"
			results = append(results, result)
			continue
		}

		if err := tx.Commit(); err != nil {
			result.Success = false
			result.ErrorCode = "DB_ERROR"
			result.Reason = "事务提交失败"
			results = append(results, result)
			continue
		}

		result.Success = true
		result.ErrorCode = "OVERDUE_CHECK_PASS"
		result.Reason = fmt.Sprintf("逾期检查通过（可推进）：当前处理人[%s]，请前往详情页手动推进", expectedHandler)
		results = append(results, result)
	}

	c.JSON(http.StatusOK, models.BatchResponse{Results: results})
}

func recordInterception(appID, userID int64, reasonType, description, now string) {
	DB.Exec(
		`INSERT INTO exception_reasons (application_id, operator_id, reason_type, description, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		appID, userID, reasonType, description, now,
	)
}

func roleDisplay(role string) string {
	switch role {
	case "warehouse_clerk":
		return "仓管员"
	case "temp_supervisor":
		return "温控主管"
	case "warehouse_manager":
		return "仓储经理"
	default:
		return role
	}
}

func expectedHandlerName(status string, creatorID, handlerID int64) string {
	var name string
	switch status {
	case "draft", "pending_correction":
		DB.QueryRow("SELECT display_name FROM users WHERE id = ?", creatorID).Scan(&name)
	case "pending_temp":
		if handlerID > 0 {
			DB.QueryRow("SELECT display_name FROM users WHERE id = ?", handlerID).Scan(&name)
		} else {
			DB.QueryRow("SELECT display_name FROM users WHERE role = 'temp_supervisor' LIMIT 1").Scan(&name)
		}
	case "under_review":
		DB.QueryRow("SELECT display_name FROM users WHERE role = 'warehouse_manager' LIMIT 1").Scan(&name)
	case "completed":
		name = "-"
	default:
		name = "-"
	}
	if name == "" {
		name = "未分配"
	}
	return name
}

func joinStrings(parts []string, sep string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += sep
		}
		result += p
	}
	return result
}

func getVersion(appID int64) int {
	var version int
	DB.QueryRow("SELECT version FROM applications WHERE id = ?", appID).Scan(&version)
	return version
}
