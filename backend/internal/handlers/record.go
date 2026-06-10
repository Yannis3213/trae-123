package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"aviation-ground-service/internal/middleware"
	"aviation-ground-service/internal/models"
	"aviation-ground-service/internal/services"

	"github.com/labstack/echo/v4"
)

type RecordHandler struct {
	DB *sql.DB
}

func (h *RecordHandler) List(c echo.Context) error {
	var q models.RecordListQuery
	if err := c.Bind(&q); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求参数错误"})
	}

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 {
		q.PageSize = 10
	}

	var conditions []string
	var args []interface{}

	if q.Status != "" {
		conditions = append(conditions, "cr.status = ?")
		args = append(args, q.Status)
	}
	if q.CurrentHandlerRole != "" {
		conditions = append(conditions, "cr.current_handler_role = ?")
		args = append(args, q.CurrentHandlerRole)
	}
	if q.FlightNo != "" {
		conditions = append(conditions, "cr.flight_no LIKE ?")
		args = append(args, "%"+q.FlightNo+"%")
	}
	if q.PassengerName != "" {
		conditions = append(conditions, "cr.passenger_name LIKE ?")
		args = append(args, "%"+q.PassengerName+"%")
	}

	if q.WarningType != "" {
		now := time.Now()
		switch q.WarningType {
		case "normal":
			conditions = append(conditions, "datetime(cr.deadline) > datetime(?, '+72 hours')")
			args = append(args, now.Format("2006-01-02 15:04:05"))
		case "approaching":
			conditions = append(conditions, "datetime(cr.deadline) <= datetime(?, '+72 hours') AND datetime(cr.deadline) > datetime(?, '+24 hours')")
			args = append(args, now.Format("2006-01-02 15:04:05"), now.Format("2006-01-02 15:04:05"))
		case "overdue":
			conditions = append(conditions, "datetime(cr.deadline) <= datetime(?, '+24 hours')")
			args = append(args, now.Format("2006-01-02 15:04:05"))
		}
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM checkin_records cr %s", whereClause)
	var total int
	if err := h.DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "查询失败"})
	}

	offset := (q.Page - 1) * q.PageSize
	listQuery := fmt.Sprintf(
		"SELECT cr.id, cr.flight_no, cr.passenger_name, cr.passenger_id, cr.seat_no, cr.checkin_time, cr.status, cr.version, cr.deadline, cr.created_by, cr.current_handler_role, cr.return_reason, cr.created_at, cr.updated_at FROM checkin_records cr %s ORDER BY cr.updated_at DESC LIMIT ? OFFSET ?",
		whereClause,
	)
	args = append(args, q.PageSize, offset)

	rows, err := h.DB.Query(listQuery, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "查询失败"})
	}
	defer rows.Close()

	var records []models.CheckinRecord
	for rows.Next() {
		var r models.CheckinRecord
		if err := rows.Scan(
			&r.ID, &r.FlightNo, &r.PassengerName, &r.PassengerID, &r.SeatNo,
			&r.CheckinTime, &r.Status, &r.Version, &r.Deadline, &r.CreatedBy,
			&r.CurrentHandlerRole, &r.ReturnReason, &r.CreatedAt, &r.UpdatedAt,
		); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "数据解析失败"})
		}
		records = append(records, r)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data":      records,
		"total":     total,
		"page":      q.Page,
		"page_size": q.PageSize,
	})
}

func (h *RecordHandler) GetDetail(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的记录ID"})
	}

	userRole := middleware.GetUserRole(c)

	var detail models.RecordDetail
	query := "SELECT id, flight_no, passenger_name, passenger_id, seat_no, checkin_time, status, version, deadline, created_by, current_handler_role, return_reason, created_at, updated_at FROM checkin_records WHERE id = ?"
	err = h.DB.QueryRow(query, id).Scan(
		&detail.ID, &detail.FlightNo, &detail.PassengerName, &detail.PassengerID,
		&detail.SeatNo, &detail.CheckinTime, &detail.Status, &detail.Version,
		&detail.Deadline, &detail.CreatedBy, &detail.CurrentHandlerRole,
		&detail.ReturnReason, &detail.CreatedAt, &detail.UpdatedAt,
	)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "记录不存在"})
	}

	err = h.DB.QueryRow("SELECT name FROM users WHERE id = ?", detail.CreatedBy).Scan(&detail.CreatorName)
	if err != nil {
		detail.CreatorName = "未知"
	}

	detail.Attachments, _ = h.getAttachments(id)
	detail.ProcessingRecords, _ = h.getProcessingRecords(id)
	detail.AuditNotes, _ = h.getAuditNotes(id)
	detail.ExceptionReasons, _ = h.getExceptionReasons(id)

	warningType, deadlineLabel, hoursLeft := services.GetDeadlineInfo(detail.Deadline)
	detail.DeadlineInfo = models.DeadlineInfo{
		WarningType: warningType,
		Label:       deadlineLabel,
		HoursLeft:   hoursLeft,
	}

	actions := services.GetAvailableActions(userRole, detail.CurrentHandlerRole, detail.Status, detail.Deadline, detail.Attachments)
	for _, a := range actions {
		detail.AvailableActions = append(detail.AvailableActions, models.AvailableAction{
			Action:  a.Action,
			Label:   a.Label,
			Enabled: a.Enabled,
			Reason:  a.Reason,
		})
	}

	return c.JSON(http.StatusOK, detail)
}

func (h *RecordHandler) getAttachments(recordID int64) ([]models.Attachment, error) {
	rows, err := h.DB.Query("SELECT id, record_id, type, file_name, file_path, uploaded_by, created_at FROM attachments WHERE record_id = ?", recordID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Attachment
	for rows.Next() {
		var a models.Attachment
		if err := rows.Scan(&a.ID, &a.RecordID, &a.Type, &a.FileName, &a.FilePath, &a.UploadedBy, &a.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	return items, nil
}

func (h *RecordHandler) getProcessingRecords(recordID int64) ([]models.ProcessingRecord, error) {
	rows, err := h.DB.Query("SELECT id, record_id, handler_id, handler_role, action, comment, created_at FROM processing_records WHERE record_id = ? ORDER BY created_at ASC", recordID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.ProcessingRecord
	for rows.Next() {
		var p models.ProcessingRecord
		if err := rows.Scan(&p.ID, &p.RecordID, &p.HandlerID, &p.HandlerRole, &p.Action, &p.Comment, &p.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}

func (h *RecordHandler) getAuditNotes(recordID int64) ([]models.AuditNote, error) {
	rows, err := h.DB.Query("SELECT id, record_id, handler_id, note, created_at FROM audit_notes WHERE record_id = ? ORDER BY created_at ASC", recordID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.AuditNote
	for rows.Next() {
		var a models.AuditNote
		if err := rows.Scan(&a.ID, &a.RecordID, &a.HandlerID, &a.Note, &a.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	return items, nil
}

func (h *RecordHandler) getExceptionReasons(recordID int64) ([]models.ExceptionReason, error) {
	rows, err := h.DB.Query("SELECT id, record_id, reason_type, description, created_by, created_at FROM exception_reasons WHERE record_id = ? ORDER BY created_at ASC", recordID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.ExceptionReason
	for rows.Next() {
		var e models.ExceptionReason
		if err := rows.Scan(&e.ID, &e.RecordID, &e.ReasonType, &e.Description, &e.CreatedBy, &e.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	return items, nil
}

func (h *RecordHandler) Create(c echo.Context) error {
	userRole := middleware.GetUserRole(c)
	if userRole != models.RoleCheckinAgent {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "只有值机员可以创建记录"})
	}

	var req models.CreateRecordRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求参数错误"})
	}

	if req.FlightNo == "" || req.PassengerName == "" || req.PassengerID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "航班号、旅客姓名、证件号不能为空"})
	}

	userID := middleware.GetUserID(c)
	now := time.Now().Format("2006-01-02 15:04:05")

	if req.CheckinTime == "" {
		req.CheckinTime = now
	}
	if req.Deadline == "" {
		deadline := time.Now().Add(5 * 24 * time.Hour)
		req.Deadline = deadline.Format("2006-01-02 15:04:05")
	}

	result, err := h.DB.Exec(
		"INSERT INTO checkin_records (flight_no, passenger_name, passenger_id, seat_no, checkin_time, status, version, deadline, created_by, current_handler_role, return_reason, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		req.FlightNo, req.PassengerName, req.PassengerID, req.SeatNo, req.CheckinTime,
		models.StatusDraft, 1, req.Deadline, userID, models.RoleCheckinAgent, "", now, now,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "创建记录失败"})
	}

	id, _ := result.LastInsertId()
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "message": "记录创建成功"})
}

func (h *RecordHandler) Process(c echo.Context) error {
	recordID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error":      "无效的记录ID",
			"error_type": "invalid_input",
		})
	}

	var req models.ProcessRecordRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error":      "请求参数错误",
			"error_type": "invalid_input",
		})
	}

	userID := middleware.GetUserID(c)
	userRole := middleware.GetUserRole(c)

	var record models.CheckinRecord
	query := "SELECT id, flight_no, passenger_name, passenger_id, seat_no, checkin_time, status, version, deadline, created_by, current_handler_role, return_reason, created_at, updated_at FROM checkin_records WHERE id = ?"
	err = h.DB.QueryRow(query, recordID).Scan(
		&record.ID, &record.FlightNo, &record.PassengerName, &record.PassengerID,
		&record.SeatNo, &record.CheckinTime, &record.Status, &record.Version,
		&record.Deadline, &record.CreatedBy, &record.CurrentHandlerRole,
		&record.ReturnReason, &record.CreatedAt, &record.UpdatedAt,
	)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"error":      "记录不存在",
			"error_type": "not_found",
		})
	}

	attachments, _ := h.getAttachments(recordID)

	ctx := &services.ValidationContext{
		UserRole:           userRole,
		CurrentHandlerRole: record.CurrentHandlerRole,
		CurrentStatus:      record.Status,
		Action:             req.Action,
		RequestVersion:     req.Version,
		RecordVersion:      record.Version,
		Deadline:           record.Deadline,
		Attachments:        attachments,
		Comment:            req.Comment,
	}

	if verr := services.ValidateAll(ctx); verr != nil {
		statusCode := http.StatusBadRequest
		if verr.Type == services.ErrTypeVersion {
			statusCode = http.StatusConflict
		}
		return c.JSON(statusCode, map[string]interface{}{
			"error":      verr.Message,
			"error_type": string(verr.Type),
		})
	}

	newStatus, newHandlerRole := services.GetNextState(req.Action)
	now := time.Now().Format("2006-01-02 15:04:05")
	returnReason := record.ReturnReason
	if req.Action == models.ActionReturn {
		returnReason = req.Comment
	} else if req.Action == models.ActionCorrect {
		returnReason = ""
	}

	updateQuery := "UPDATE checkin_records SET status = ?, version = version + 1, current_handler_role = ?, return_reason = ?, updated_at = ? WHERE id = ? AND version = ?"
	result, err := h.DB.Exec(updateQuery, newStatus, newHandlerRole, returnReason, now, recordID, record.Version)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":      "更新记录失败",
			"error_type": "internal",
		})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.JSON(http.StatusConflict, map[string]interface{}{
			"error":      "版本冲突，记录已被修改，请刷新后重试",
			"error_type": "version",
		})
	}

	_, err = h.DB.Exec(
		"INSERT INTO processing_records (record_id, handler_id, handler_role, action, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		recordID, userID, userRole, req.Action, req.Comment, now,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":      "记录处理日志失败",
			"error_type": "internal",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":    "处理成功",
		"new_status": newStatus,
	})
}

func (h *RecordHandler) BatchProcess(c echo.Context) error {
	var req models.BatchProcessRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求参数错误"})
	}

	if len(req.RecordIDs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请选择要处理的记录"})
	}

	userID := middleware.GetUserID(c)
	userRole := middleware.GetUserRole(c)

	var results []models.BatchProcessResult

	for _, recordID := range req.RecordIDs {
		result := models.BatchProcessResult{RecordID: recordID}

		var record models.CheckinRecord
		query := "SELECT id, flight_no, passenger_name, status, version, current_handler_role, return_reason, deadline FROM checkin_records WHERE id = ?"
		err := h.DB.QueryRow(query, recordID).Scan(
			&record.ID, &record.FlightNo, &record.PassengerName,
			&record.Status, &record.Version, &record.CurrentHandlerRole,
			&record.ReturnReason, &record.Deadline,
		)
		if err != nil {
			result.Success = false
			result.Message = "记录不存在"
			result.ErrorType = "not_found"
			results = append(results, result)
			continue
		}

		result.FlightNo = record.FlightNo
		result.PassengerName = record.PassengerName

		attachments, _ := h.getAttachments(recordID)

		ctx := &services.ValidationContext{
			UserRole:           userRole,
			CurrentHandlerRole: record.CurrentHandlerRole,
			CurrentStatus:      record.Status,
			Action:             req.Action,
			RequestVersion:     req.Version,
			RecordVersion:      record.Version,
			Deadline:           record.Deadline,
			Attachments:        attachments,
			Comment:            req.Comment,
		}

		if verr := services.ValidateAll(ctx); verr != nil {
			result.Success = false
			result.Message = verr.Message
			result.ErrorType = string(verr.Type)
			results = append(results, result)
			continue
		}

		newStatus, newHandlerRole := services.GetNextState(req.Action)
		now := time.Now().Format("2006-01-02 15:04:05")
		returnReason := record.ReturnReason
		if req.Action == models.ActionReturn {
			returnReason = req.Comment
		} else if req.Action == models.ActionCorrect {
			returnReason = ""
		}

		updateResult, err := h.DB.Exec(
			"UPDATE checkin_records SET status = ?, version = version + 1, current_handler_role = ?, return_reason = ?, updated_at = ? WHERE id = ? AND version = ?",
			newStatus, newHandlerRole, returnReason, now, recordID, record.Version,
		)
		if err != nil {
			result.Success = false
			result.Message = "更新记录失败"
			result.ErrorType = "internal"
			results = append(results, result)
			continue
		}

		rowsAffected, _ := updateResult.RowsAffected()
		if rowsAffected == 0 {
			result.Success = false
			result.Message = "版本冲突，记录已被修改"
			result.ErrorType = "version"
			results = append(results, result)
			continue
		}

		h.DB.Exec(
			"INSERT INTO processing_records (record_id, handler_id, handler_role, action, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			recordID, userID, userRole, req.Action, req.Comment, now,
		)

		result.Success = true
		result.Message = "处理成功"
		results = append(results, result)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"results": results})
}

func (h *RecordHandler) Statistics(c echo.Context) error {
	statusCounts := make(map[string]int)
	rows, err := h.DB.Query("SELECT status, COUNT(*) FROM checkin_records GROUP BY status")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var status string
			var count int
			if rows.Scan(&status, &count) == nil {
				statusCounts[status] = count
			}
		}
	}

	roleCounts := make(map[string]int)
	rows2, err := h.DB.Query("SELECT current_handler_role, COUNT(*) FROM checkin_records GROUP BY current_handler_role")
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var role string
			var count int
			if rows2.Scan(&role, &count) == nil {
				roleCounts[role] = count
			}
		}
	}

	now := time.Now()
	nowStr := now.Format("2006-01-02 15:04:05")
	approachingStr := now.Add(72 * time.Hour).Format("2006-01-02 15:04:05")

	var normalCount, approachingCount, overdueCount int
	h.DB.QueryRow("SELECT COUNT(*) FROM checkin_records WHERE datetime(deadline) > datetime(?)", approachingStr).Scan(&normalCount)
	h.DB.QueryRow("SELECT COUNT(*) FROM checkin_records WHERE datetime(deadline) <= datetime(?) AND datetime(deadline) > datetime(?, '+24 hours')", approachingStr, nowStr).Scan(&approachingCount)
	h.DB.QueryRow("SELECT COUNT(*) FROM checkin_records WHERE datetime(deadline) <= datetime(?, '+24 hours')", nowStr).Scan(&overdueCount)

	warningCounts := map[string]int{
		"normal":      normalCount,
		"approaching": approachingCount,
		"overdue":     overdueCount,
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status_counts":  statusCounts,
		"role_counts":    roleCounts,
		"warning_counts": warningCounts,
	})
}
