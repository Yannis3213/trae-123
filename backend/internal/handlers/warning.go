package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"aviation-ground-service/internal/models"
	"aviation-ground-service/internal/services"

	"github.com/labstack/echo/v4"
)

type WarningHandler struct {
	DB *sql.DB
}

func (h *WarningHandler) List(c echo.Context) error {
	warningType := c.QueryParam("warning_type")
	page := 1
	pageSize := 10

	if p := c.QueryParam("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if ps := c.QueryParam("page_size"); ps != "" {
		if v, err := strconv.Atoi(ps); err == nil && v > 0 {
			pageSize = v
		}
	}

	now := time.Now()
	nowStr := now.Format("2006-01-02 15:04:05")
	approachingStr := now.Add(72 * time.Hour).Format("2006-01-02 15:04:05")

	var conditions []string
	var args []interface{}

	conditions = append(conditions, "cr.status != ?")
	args = append(args, string(models.StatusSynced))

	switch warningType {
	case "normal":
		conditions = append(conditions, "datetime(cr.deadline) > datetime(?)")
		args = append(args, approachingStr)
	case "approaching":
		conditions = append(conditions, "datetime(cr.deadline) <= datetime(?) AND datetime(cr.deadline) > datetime(?, '+24 hours')")
		args = append(args, approachingStr, nowStr)
	case "overdue":
		conditions = append(conditions, "datetime(cr.deadline) <= datetime(?, '+24 hours')")
		args = append(args, nowStr)
	}

	whereClause := "WHERE " + strings.Join(conditions, " AND ")

	countQuery := "SELECT COUNT(*) FROM checkin_records cr " + whereClause
	var total int
	h.DB.QueryRow(countQuery, args...).Scan(&total)

	offset := (page - 1) * pageSize
	listQuery := `SELECT cr.id, cr.flight_no, cr.passenger_name, cr.passenger_id, cr.seat_no, cr.checkin_time, cr.status, cr.version, cr.deadline, cr.created_by, cr.current_handler_role, cr.return_reason, cr.scenario, cr.created_at, cr.updated_at,
	(SELECT pr.action FROM processing_records pr WHERE pr.record_id = cr.id ORDER BY pr.id DESC LIMIT 1),
	(SELECT pr.success FROM processing_records pr WHERE pr.record_id = cr.id ORDER BY pr.id DESC LIMIT 1),
	(SELECT pr.block_reason FROM processing_records pr WHERE pr.record_id = cr.id ORDER BY pr.id DESC LIMIT 1),
	(SELECT pr.block_type FROM processing_records pr WHERE pr.record_id = cr.id ORDER BY pr.id DESC LIMIT 1)
	FROM checkin_records cr ` + whereClause + " ORDER BY cr.deadline ASC LIMIT ? OFFSET ?"
	args = append(args, pageSize, offset)

	rows, err := h.DB.Query(listQuery, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "查询失败"})
	}
	defer rows.Close()

	type WarningRecord struct {
		models.CheckinRecord
		WarningType       string `json:"warning_type"`
		LatestAction      string `json:"latest_action"`
		LatestSuccess     bool   `json:"latest_success"`
		LatestBlockReason string `json:"latest_block_reason"`
		LatestBlockType   string `json:"latest_block_type"`
	}

	var records []WarningRecord
	for rows.Next() {
		var r WarningRecord
		var latestAction sql.NullString
		var latestSuccessInt sql.NullInt64
		var latestBlockReason sql.NullString
		var latestBlockType sql.NullString
		if err := rows.Scan(
			&r.ID, &r.FlightNo, &r.PassengerName, &r.PassengerID, &r.SeatNo,
			&r.CheckinTime, &r.Status, &r.Version, &r.Deadline, &r.CreatedBy,
			&r.CurrentHandlerRole, &r.ReturnReason, &r.Scenario, &r.CreatedAt, &r.UpdatedAt,
			&latestAction, &latestSuccessInt, &latestBlockReason, &latestBlockType,
		); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "数据解析失败"})
		}

		wt := services.CheckDeadline(r.Deadline)
		r.WarningType = wt
		if latestAction.Valid {
			r.LatestAction = latestAction.String
		}
		if latestSuccessInt.Valid {
			r.LatestSuccess = latestSuccessInt.Int64 != 0
		}
		if latestBlockReason.Valid {
			r.LatestBlockReason = latestBlockReason.String
		}
		if latestBlockType.Valid {
			r.LatestBlockType = latestBlockType.String
		}
		records = append(records, r)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data":      records,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}
