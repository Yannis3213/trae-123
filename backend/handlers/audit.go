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
		action, before_status, after_status, detail, failure_reason, version, created_at
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
			&log.Action, &log.BeforeStatus, &log.AfterStatus, &log.Detail, &log.FailureReason, &log.Version, &log.CreatedAt)
		logs = append(logs, log)
	}

	c.JSON(http.StatusOK, response{Code: 0, Data: logs})
}

func GetProcessingRecords(c *gin.Context) {
	id := c.Param("id")

	var exists bool
	database.DB.QueryRow("SELECT 1 FROM lease_applications WHERE id = ?", id).Scan(&exists)
	if !exists {
		c.JSON(http.StatusNotFound, response{Code: 404, Message: "申请不存在"})
		return
	}

	rows, err := database.DB.Query(`SELECT id, application_id, handler_id, handler_name, handler_role,
		action, from_status, to_status, remark, exception_reason, version,
		next_handler_role, next_handler_id, next_handler_name, created_at
		FROM processing_records WHERE application_id = ? ORDER BY created_at DESC`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "查询处理记录失败"})
		return
	}
	defer rows.Close()

	records := []models.ProcessingRecord{}
	for rows.Next() {
		var r models.ProcessingRecord
		rows.Scan(&r.ID, &r.ApplicationID, &r.HandlerID, &r.HandlerName, &r.HandlerRole,
			&r.Action, &r.FromStatus, &r.ToStatus, &r.Remark, &r.ExceptionReason, &r.Version,
			&r.NextHandlerRole, &r.NextHandlerID, &r.NextHandlerName, &r.CreatedAt)
		records = append(records, r)
	}

	c.JSON(http.StatusOK, response{Code: 0, Data: records})
}

func GetBatchFailures(c *gin.Context) {
	batchID := c.Param("batch_id")

	rows, err := database.DB.Query(`SELECT id, batch_id, application_id, application_no, reason,
		handler_role, handler_id, handler_name, action, created_at
		FROM batch_failure_records WHERE batch_id = ? ORDER BY created_at DESC`, batchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "查询批量失败明细失败"})
		return
	}
	defer rows.Close()

	failures := []models.BatchFailureRecord{}
	for rows.Next() {
		var f models.BatchFailureRecord
		rows.Scan(&f.ID, &f.BatchID, &f.ApplicationID, &f.ApplicationNo, &f.Reason,
			&f.HandlerRole, &f.HandlerID, &f.HandlerName, &f.Action, &f.CreatedAt)
		failures = append(failures, f)
	}

	c.JSON(http.StatusOK, response{Code: 0, Data: gin.H{"list": failures, "total": len(failures)}})
}
