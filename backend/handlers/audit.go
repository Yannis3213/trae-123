package handlers

import (
	"net/http"

	"trae-123-4/backend/database"
	"trae-123-4/backend/models"

	"github.com/gin-gonic/gin"
)

func GetAuditLogs(c *gin.Context) {
	id := c.Param("id")

	var exists bool
	database.DB.QueryRow("SELECT 1 FROM lease_applications WHERE id = ?", id).Scan(&exists)
	if !exists {
		c.JSON(http.StatusNotFound, response{Code: 404, Message: "申请不存在"})
		return
	}

	rows, err := database.DB.Query(`SELECT id, application_id, operator_id, operator_name, operator_role,
		action, before_status, after_status, detail, failure_reason, created_at
		FROM audit_logs WHERE application_id = ? ORDER BY created_at DESC`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "查询审计日志失败"})
		return
	}
	defer rows.Close()

	logs := []models.AuditLog{}
	for rows.Next() {
		var log models.AuditLog
		rows.Scan(&log.ID, &log.ApplicationID, &log.OperatorID, &log.OperatorName, &log.OperatorRole,
			&log.Action, &log.BeforeStatus, &log.AfterStatus, &log.Detail, &log.FailureReason, &log.CreatedAt)
		logs = append(logs, log)
	}

	c.JSON(http.StatusOK, response{Code: 0, Data: logs})
}
