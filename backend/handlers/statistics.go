package handlers

import (
	"net/http"
	"time"

	"trae-123-4/backend/database"
	"trae-123-4/backend/models"

	"github.com/gin-gonic/gin"
)

func GetStatistics(c *gin.Context) {
	stats := models.StatisticsData{}

	database.DB.QueryRow("SELECT COUNT(*) FROM lease_applications").Scan(&stats.Total)
	database.DB.QueryRow("SELECT COUNT(*) FROM lease_applications WHERE status = 'pending_verification'").Scan(&stats.PendingVerification)
	database.DB.QueryRow("SELECT COUNT(*) FROM lease_applications WHERE status = 'verification_failed'").Scan(&stats.VerificationFailed)
	database.DB.QueryRow("SELECT COUNT(*) FROM lease_applications WHERE status = 'verification_complete'").Scan(&stats.VerificationComplete)

	today := time.Now().Format("2006-01-02")
	expiringDate := time.Now().Add(30 * 24 * time.Hour).Format("2006-01-02")

	database.DB.QueryRow("SELECT COUNT(*) FROM lease_applications WHERE lease_end_date < ?", today).Scan(&stats.OverdueCount)
	database.DB.QueryRow("SELECT COUNT(*) FROM lease_applications WHERE lease_end_date >= ? AND lease_end_date <= ?", today, expiringDate).Scan(&stats.ExpiringSoonCount)
	database.DB.QueryRow("SELECT COUNT(*) FROM lease_applications WHERE lease_end_date > ?", expiringDate).Scan(&stats.NormalCount)

	c.JSON(http.StatusOK, response{Code: 0, Data: stats})
}
