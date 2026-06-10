package handlers

import (
	"net/http"
	"time"

	"trae-123-4/backend/database"
	"trae-123-4/backend/models"

	"github.com/gin-gonic/gin"
)

func GetExpiryWarnings(c *gin.Context) {
	expiryStatus := c.Query("expiry_status")

	query := `SELECT id, application_no, tenant_name, tenant_phone, room_number, building_name,
		lease_start_date, lease_end_date, monthly_rent, deposit, status,
		current_handler_id, current_handler_name, current_handler_role, version, confirmed,
		tenant_signing_status, room_confirmation_status, move_in_handover_status,
		exception_reason, created_at, updated_at
		FROM lease_applications WHERE 1=1`

	args := []interface{}{}
	today := time.Now().Format("2006-01-02")
	expiringDate := time.Now().Add(30 * 24 * time.Hour).Format("2006-01-02")

	switch expiryStatus {
	case "normal":
		query += " AND lease_end_date > ?"
		args = append(args, expiringDate)
	case "expiring_soon":
		query += " AND lease_end_date <= ? AND lease_end_date >= ?"
		args = append(args, expiringDate, today)
	case "overdue":
		query += " AND lease_end_date < ?"
		args = append(args, today)
	default:
		query += " AND lease_end_date <= ?"
		args = append(args, expiringDate)
	}

	query += " ORDER BY lease_end_date ASC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "查询失败"})
		return
	}
	defer rows.Close()

	list := []models.LeaseApplication{}
	for rows.Next() {
		var app models.LeaseApplication
		var confirmed int
		rows.Scan(&app.ID, &app.ApplicationNo, &app.TenantName, &app.TenantPhone,
			&app.RoomNumber, &app.BuildingName, &app.LeaseStartDate, &app.LeaseEndDate,
			&app.MonthlyRent, &app.Deposit, &app.Status,
			&app.CurrentHandlerID, &app.CurrentHandlerName, &app.CurrentHandlerRole, &app.Version, &confirmed,
			&app.TenantSigningStatus, &app.RoomConfirmationStatus, &app.MoveInHandoverStatus,
			&app.ExceptionReason, &app.CreatedAt, &app.UpdatedAt)
		app.Confirmed = confirmed == 1
		app.ExpiryStatus, app.OverdueDays = models.ComputeExpiryFields(app.LeaseEndDate)
		list = append(list, app)
	}

	c.JSON(http.StatusOK, response{Code: 0, Data: list})
}
