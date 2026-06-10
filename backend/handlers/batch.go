package handlers

import (
	"fmt"
	"net/http"
	"time"

	"trae-123-4/backend/database"
	"trae-123-4/backend/middleware"
	"trae-123-4/backend/models"

	"github.com/gin-gonic/gin"
)

func BatchProcess(c *gin.Context) {
	var req models.BatchProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response{Code: 400, Message: "请求参数错误"})
		return
	}

	role := middleware.GetRole(c)
	userID := middleware.GetUserID(c)
	userName := middleware.GetUserName(c)

	results := []models.BatchResultItem{}

	for _, appID := range req.ApplicationIDs {
		result := models.BatchResultItem{ApplicationID: appID}

		var app models.LeaseApplication
		var confirmed int
		err := database.DB.QueryRow(`SELECT id, application_no, status, current_handler_id, current_handler_name, current_handler_role, version, confirmed
			FROM lease_applications WHERE id = ?`, appID).
			Scan(&app.ID, &app.ApplicationNo, &app.Status, &app.CurrentHandlerID, &app.CurrentHandlerName, &app.CurrentHandlerRole, &app.Version, &confirmed)
		if err != nil {
			result.ApplicationNo = ""
			result.Success = false
			result.Reason = "申请不存在"
			results = append(results, result)
			continue
		}
		result.ApplicationNo = app.ApplicationNo
		app.Confirmed = confirmed == 1

		validActions := map[string][]string{
			"lease_clerk":            {"correct"},
			"maintenance_coordinator": {"verify_pass", "verify_fail"},
			"store_manager":          {"confirm"},
		}
		allowed, exists := validActions[role]
		if !exists {
			result.Success = false
			result.Reason = "当前角色无权执行此操作"
			results = append(results, result)
			continue
		}
		actionAllowed := false
		for _, a := range allowed {
			if a == req.Action {
				actionAllowed = true
				break
			}
		}
		if !actionAllowed {
			result.Success = false
			result.Reason = "当前角色无权执行此操作"
			results = append(results, result)
			continue
		}

		expectedRole := map[string]string{
			"correct":     "lease_clerk",
			"verify_pass": "maintenance_coordinator",
			"verify_fail": "maintenance_coordinator",
			"confirm":     "store_manager",
		}
		if expectedRole[req.Action] != app.CurrentHandlerRole && app.CurrentHandlerRole != "" {
			roleNames := map[string]string{
				"lease_clerk":            "租务专员",
				"maintenance_coordinator": "维修协调员",
				"store_manager":          "门店经理",
			}
			result.Success = false
			result.Reason = fmt.Sprintf("当前申请应由%s处理", roleNames[app.CurrentHandlerRole])
			results = append(results, result)
			continue
		}

		if app.CurrentHandlerID != "" && app.CurrentHandlerID != userID {
			result.Success = false
			result.Reason = fmt.Sprintf("当前申请由%s处理，您无权操作", app.CurrentHandlerName)
			results = append(results, result)
			continue
		}

		if req.Action == "confirm" && app.Confirmed {
			result.Success = false
			result.Reason = "该申请已确认，请勿重复确认"
			results = append(results, result)
			continue
		}

		validTransitions := map[string]map[string]string{
			"pending_verification":  {"verify_pass": "verification_complete", "verify_fail": "verification_failed"},
			"verification_failed":   {"correct": "pending_verification"},
			"verification_complete": {"confirm": "verification_complete"},
		}
		transitions, exists := validTransitions[app.Status]
		if !exists {
			result.Success = false
			result.Reason = fmt.Sprintf("当前状态%s不允许执行此操作", app.Status)
			results = append(results, result)
			continue
		}
		newStatus, exists := transitions[req.Action]
		if !exists {
			result.Success = false
			result.Reason = fmt.Sprintf("当前状态%s不允许执行此操作", app.Status)
			results = append(results, result)
			continue
		}

		if req.Action == "verify_pass" {
			var attCount int
			database.DB.QueryRow("SELECT COUNT(*) FROM attachments WHERE application_id = ?", appID).Scan(&attCount)
			if attCount == 0 {
				result.Success = false
				result.Reason = "缺少必要附件，无法完成核验"
				results = append(results, result)
				continue
			}
		}

		now := time.Now().Format(time.RFC3339)

		tx, err := database.DB.Begin()
		if err != nil {
			result.Success = false
			result.Reason = "开启事务失败"
			results = append(results, result)
			continue
		}

		res, err := tx.Exec(`UPDATE lease_applications SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
			newStatus, now, appID, app.Version)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Reason = "更新失败"
			results = append(results, result)
			continue
		}
		rowsAffected, _ := res.RowsAffected()
		if rowsAffected == 0 {
			tx.Rollback()
			result.Success = false
			result.Reason = "版本冲突或已被处理，请刷新后重试"
			results = append(results, result)
			continue
		}

		nextHandlerRole := ""
		nextHandlerID := ""
		nextHandlerName := ""
		switch newStatus {
		case "pending_verification":
			nextHandlerRole = "maintenance_coordinator"
		case "verification_failed":
			nextHandlerRole = "lease_clerk"
		case "verification_complete":
			if req.Action == "confirm" {
				nextHandlerRole = ""
				nextHandlerID = ""
				nextHandlerName = ""
			} else {
				nextHandlerRole = "store_manager"
			}
		}
		_, err = tx.Exec(`UPDATE lease_applications SET current_handler_role = ?, current_handler_id = ?, current_handler_name = ? WHERE id = ?`,
			nextHandlerRole, nextHandlerID, nextHandlerName, appID)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Reason = "更新处理人失败"
			results = append(results, result)
			continue
		}

		if req.Action == "confirm" {
			_, err = tx.Exec(`UPDATE lease_applications SET confirmed = 1 WHERE id = ?`, appID)
			if err != nil {
				tx.Rollback()
				result.Success = false
				result.Reason = "设置确认标记失败"
				results = append(results, result)
				continue
			}
		}

		if req.Action == "correct" {
			_, err = tx.Exec("UPDATE lease_applications SET exception_reason = '' WHERE id = ?", appID)
			if err != nil {
				tx.Rollback()
				result.Success = false
				result.Reason = "清除异常原因失败"
				results = append(results, result)
				continue
			}
		}

		_, err = tx.Exec(`INSERT INTO processing_records
			(id, application_id, handler_id, handler_name, handler_role, action, from_status, to_status, remark, exception_reason, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			models.GenerateID(), appID, userID, userName, role, req.Action, app.Status, newStatus, "批量处理", "", now)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Reason = "写入处理记录失败"
			results = append(results, result)
			continue
		}

		_, err = tx.Exec(`INSERT INTO audit_logs
			(id, application_id, operator_id, operator_name, operator_role, action, before_status, after_status, detail, failure_reason, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			models.GenerateID(), appID, userID, userName, role, req.Action, app.Status, newStatus,
			fmt.Sprintf("批量操作: %s", req.Action), "", now)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Reason = "写入审计日志失败"
			results = append(results, result)
			continue
		}

		if err = tx.Commit(); err != nil {
			result.Success = false
			result.Reason = "提交事务失败"
			results = append(results, result)
			continue
		}

		result.Success = true
		result.Reason = "处理成功"
		results = append(results, result)
	}

	c.JSON(http.StatusOK, response{Code: 0, Data: gin.H{"results": results}})
}
