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
		c.JSON(http.StatusBadRequest, response{Code: 400, Message: fmt.Sprintf("请求参数错误：%s", err.Error())})
		return
	}

	role := middleware.GetRole(c)
	userID := middleware.GetUserID(c)
	userName := middleware.GetUserName(c)

	itemsToProcess := req.ApplicationItems

	results := []models.BatchResultItem{}
	failures := []models.BatchFailureRecord{}
	batchID := models.GenerateID()
	now := time.Now().Format(time.RFC3339)
	roleNames := map[string]string{
		"lease_clerk":            "租务专员",
		"maintenance_coordinator": "维修协调员",
		"store_manager":          "门店经理",
	}
	actionLabels := map[string]string{
		"correct":     "补正",
		"verify_pass": "核验通过",
		"verify_fail": "核验失败",
		"confirm":     "确认",
	}

	validActions := map[string][]string{
		"lease_clerk":            {"correct"},
		"maintenance_coordinator": {"verify_pass", "verify_fail"},
		"store_manager":          {"confirm"},
	}
	allowed, exists := validActions[role]
	roleActionAllowed := false
	if exists {
		for _, a := range allowed {
			if a == req.Action {
				roleActionAllowed = true
				break
			}
		}
	}

	for _, item := range itemsToProcess {
		appID := item.ID
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
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: "",
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}
		result.ApplicationNo = app.ApplicationNo
		app.Confirmed = confirmed == 1

		if !roleActionAllowed {
			result.Success = false
			result.Reason = "当前角色无权执行此操作"
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}

		if item.Version != app.Version {
			result.Success = false
			result.Reason = fmt.Sprintf("版本冲突，请求版本v%d，当前版本v%d", item.Version, app.Version)
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}

		if app.CurrentHandlerRole != "" && app.CurrentHandlerRole != role {
			result.Success = false
			result.Reason = fmt.Sprintf("当前申请应由%s处理", roleNames[app.CurrentHandlerRole])
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}

		if app.CurrentHandlerID != "" && app.CurrentHandlerID != userID {
			result.Success = false
			result.Reason = fmt.Sprintf("当前申请由%s处理，您无权操作", app.CurrentHandlerName)
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}

		if req.Action == "confirm" && app.Confirmed {
			result.Success = false
			result.Reason = "该申请已确认，请勿重复确认"
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
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
			result.Reason = fmt.Sprintf("当前状态%s不允许执行%s", app.Status, actionLabels[req.Action])
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}
		newStatus, exists := transitions[req.Action]
		if !exists {
			result.Success = false
			result.Reason = fmt.Sprintf("当前状态%s不允许执行%s", app.Status, actionLabels[req.Action])
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}

		if req.Action == "verify_pass" {
			var attCount int
			database.DB.QueryRow("SELECT COUNT(*) FROM attachments WHERE application_id = ?", appID).Scan(&attCount)
			if attCount == 0 {
				result.Success = false
				result.Reason = "缺少必要附件，无法完成核验"
				results = append(results, result)
				failures = append(failures, models.BatchFailureRecord{
					ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
					Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
					Action: req.Action, CreatedAt: now,
				})
				continue
			}
		}

		tx, err := database.DB.Begin()
		if err != nil {
			result.Success = false
			result.Reason = "开启事务失败"
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}

		res, err := tx.Exec(`UPDATE lease_applications SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
			newStatus, now, appID, app.Version)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Reason = "更新失败"
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}
		rowsAffected, _ := res.RowsAffected()
		if rowsAffected == 0 {
			tx.Rollback()
			result.Success = false
			result.Reason = "该申请已被处理，请勿重复提交"
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
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
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}

		if req.Action == "confirm" {
			_, err = tx.Exec(`UPDATE lease_applications SET confirmed = 1 WHERE id = ?`, appID)
			if err != nil {
				tx.Rollback()
				result.Success = false
				result.Reason = "设置确认标记失败"
				results = append(results, result)
				failures = append(failures, models.BatchFailureRecord{
					ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
					Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
					Action: req.Action, CreatedAt: now,
				})
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
				failures = append(failures, models.BatchFailureRecord{
					ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
					Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
					Action: req.Action, CreatedAt: now,
				})
				continue
			}
		} else if req.ExceptionReason != "" {
			_, err = tx.Exec("UPDATE lease_applications SET exception_reason = ? WHERE id = ?", req.ExceptionReason, appID)
			if err != nil {
				tx.Rollback()
				result.Success = false
				result.Reason = "写入异常原因失败"
				results = append(results, result)
				failures = append(failures, models.BatchFailureRecord{
					ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
					Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
					Action: req.Action, CreatedAt: now,
				})
				continue
			}
		}

		batchRemark := "批量处理"
		if req.Remark != "" {
			batchRemark = fmt.Sprintf("批量处理:%s", req.Remark)
		}
		_, err = tx.Exec(`INSERT INTO processing_records
			(id, application_id, handler_id, handler_name, handler_role, action, from_status, to_status, remark, exception_reason, version, next_handler_role, next_handler_id, next_handler_name, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			models.GenerateID(), appID, userID, userName, role, req.Action, app.Status, newStatus, batchRemark, req.ExceptionReason, app.Version, nextHandlerRole, nextHandlerID, nextHandlerName, now)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Reason = "写入处理记录失败"
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}

		auditDetail := fmt.Sprintf("批量操作: %s, 版本: v%d→v%d", req.Action, app.Version, app.Version+1)
		if req.Remark != "" {
			auditDetail += fmt.Sprintf(", 备注: %s", req.Remark)
		}
		if nextHandlerRole != "" {
			auditDetail += fmt.Sprintf(", 下一处理: %s", roleNames[nextHandlerRole])
		}
		_, err = tx.Exec(`INSERT INTO audit_logs
			(id, application_id, operator_id, operator_name, operator_role, action, before_status, after_status, detail, failure_reason, version, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			models.GenerateID(), appID, userID, userName, role, req.Action, app.Status, newStatus, auditDetail, req.ExceptionReason, app.Version, now)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Reason = "写入审计日志失败"
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}

		if err = tx.Commit(); err != nil {
			result.Success = false
			result.Reason = "提交事务失败"
			results = append(results, result)
			failures = append(failures, models.BatchFailureRecord{
				ID: models.GenerateID(), BatchID: batchID, ApplicationID: appID, ApplicationNo: app.ApplicationNo,
				Reason: result.Reason, HandlerRole: role, HandlerID: userID, HandlerName: userName,
				Action: req.Action, CreatedAt: now,
			})
			continue
		}

		result.Success = true
		result.Reason = "处理成功"
		results = append(results, result)
	}

	successCount := 0
	failCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		} else {
			failCount++
		}
	}

	batchAuditDetail := fmt.Sprintf("批量提交%s：共%d条，成功%d，失败%d", actionLabels[req.Action], len(results), successCount, failCount)
	if req.Remark != "" {
		batchAuditDetail += fmt.Sprintf("，备注：%s", req.Remark)
	}
	database.DB.Exec(`INSERT INTO audit_logs
		(id, application_id, operator_id, operator_name, operator_role, action, before_status, after_status, detail, failure_reason, version, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		models.GenerateID(), "", userID, userName, role, "batch_"+req.Action, "", "", batchAuditDetail, "", 0, now)

	for _, f := range failures {
		database.DB.Exec(`INSERT INTO batch_failure_records
			(id, batch_id, application_id, application_no, reason, handler_role, handler_id, handler_name, action, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			f.ID, f.BatchID, f.ApplicationID, f.ApplicationNo, f.Reason, f.HandlerRole, f.HandlerID, f.HandlerName, f.Action, f.CreatedAt)
	}

	c.JSON(http.StatusOK, response{Code: 0, Data: gin.H{
		"batch_id":       batchID,
		"total":          len(results),
		"success_count":  successCount,
		"failure_count":  failCount,
		"results":        results,
		"failures_saved": len(failures) > 0,
	}})
}
