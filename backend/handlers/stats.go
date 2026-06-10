package handlers

import (
	"net/http"
	"time"

	"coldchain/models"

	"github.com/gin-gonic/gin"
)

func GetSummary(c *gin.Context) {
	statusCounts := make(map[string]int)
	rows, err := DB.Query("SELECT status, COUNT(*) FROM applications GROUP BY status")
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "查询失败"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		rows.Scan(&status, &count)
		statusCounts[status] = count
	}

	expiryCounts := map[string]int{"normal": 0, "near_expiry": 0, "overdue": 0}
	appRows, err := DB.Query("SELECT expected_date FROM applications")
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "查询失败"})
		return
	}
	defer appRows.Close()

	total := 0
	for appRows.Next() {
		var expectedDate string
		appRows.Scan(&expectedDate)
		group := calculateExpiryGroup(expectedDate)
		expiryCounts[group]++
		total++
	}

	c.JSON(http.StatusOK, gin.H{
		"by_status": gin.H{
			"draft":              statusCounts["draft"],
			"pending_temp":       statusCounts["pending_temp"],
			"pending_correction": statusCounts["pending_correction"],
			"under_review":       statusCounts["under_review"],
			"completed":          statusCounts["completed"],
		},
		"by_expiry_group": gin.H{
			"normal":      expiryCounts["normal"],
			"near_expiry": expiryCounts["near_expiry"],
			"overdue":     expiryCounts["overdue"],
		},
		"total": total,
	})
}

func GetExpiryWarnings(c *gin.Context) {
	rows, err := DB.Query(
		`SELECT id, order_no, product_name, product_count, expected_date, appointment_time,
		 temperature_zone, status, current_step, creator_id, handler_id, version, correction_note, created_at, updated_at
		 FROM applications ORDER BY expected_date ASC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "查询失败"})
		return
	}
	defer rows.Close()

	groups := map[string][]models.Application{
		"normal":      {},
		"near_expiry": {},
		"overdue":     {},
	}

	for rows.Next() {
		var app models.Application
		rows.Scan(
			&app.ID, &app.OrderNo, &app.ProductName, &app.ProductCount,
			&app.ExpectedDate, &app.AppointmentTime, &app.TemperatureZone,
			&app.Status, &app.CurrentStep, &app.CreatorID, &app.HandlerID,
			&app.Version, &app.CorrectionNote, &app.CreatedAt, &app.UpdatedAt,
		)

		group := calculateExpiryGroup(app.ExpectedDate)
		app.ExpiryGroup = group
		fillNames(&app)

		groups[group] = append(groups[group], app)
	}

	c.JSON(http.StatusOK, gin.H{
		"normal":       groups["normal"],
		"near_expiry":  groups["near_expiry"],
		"overdue":      groups["overdue"],
		"generated_at": time.Now().Format("2006-01-02 15:04:05"),
	})
}
