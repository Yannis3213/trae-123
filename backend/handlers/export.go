package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"trae-123-4/backend/database"

	"github.com/gin-gonic/gin"
)

func ExportCSV(c *gin.Context) {
	status := c.Query("status")
	keyword := c.Query("keyword")
	expiryStatus := c.Query("expiry_status")

	where := "WHERE 1=1"
	args := []interface{}{}

	if status != "" {
		where += " AND status = ?"
		args = append(args, status)
	}
	if keyword != "" {
		where += " AND (tenant_name LIKE ? OR application_no LIKE ?)"
		kw := "%" + keyword + "%"
		args = append(args, kw, kw)
	}
	if expiryStatus != "" {
		today := time.Now().Format("2006-01-02")
		expiringDate := time.Now().Add(30 * 24 * time.Hour).Format("2006-01-02")
		switch expiryStatus {
		case "normal":
			where += " AND lease_end_date > ?"
			args = append(args, expiringDate)
		case "expiring_soon":
			where += " AND lease_end_date <= ? AND lease_end_date >= ?"
			args = append(args, expiringDate, today)
		case "overdue":
			where += " AND lease_end_date < ?"
			args = append(args, today)
		}
	}

	querySQL := `SELECT application_no, tenant_name, room_number, building_name, status,
		tenant_signing_status, room_confirmation_status, move_in_handover_status,
		current_handler_name, exception_reason, created_at
		FROM lease_applications ` + where + ` ORDER BY created_at DESC`

	rows, err := database.DB.Query(querySQL, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response{Code: 500, Message: "查询失败"})
		return
	}
	defer rows.Close()

	type csvRow struct {
		AppNo               string
		TenantName          string
		RoomNumber          string
		BuildingName        string
		Status              string
		TenantSigningStatus string
		RoomConfStatus      string
		MoveInStatus        string
		HandlerName         string
		ExceptionReason     string
		CreatedAt           string
	}

	data := []csvRow{}
	for rows.Next() {
		var r csvRow
		rows.Scan(&r.AppNo, &r.TenantName, &r.RoomNumber, &r.BuildingName, &r.Status,
			&r.TenantSigningStatus, &r.RoomConfStatus, &r.MoveInStatus,
			&r.HandlerName, &r.ExceptionReason, &r.CreatedAt)
		data = append(data, r)
	}

	statusMap := map[string]string{
		"pending_verification":  "待核验",
		"verification_failed":   "核验失败",
		"verification_complete": "核验完成",
	}
	subStatusMap := map[string]string{
		"pending":  "待处理",
		"complete": "已完成",
		"failed":   "异常",
	}

	now := time.Now()
	filename := fmt.Sprintf("lease_applications_%s.csv", now.Format("20060102_150405"))

	var sb strings.Builder
	sb.WriteString("\xEF\xBB\xBF")
	exportTime := now.Format("2006-01-02 15:04:05")
	filterInfo := "无"
	if status != "" || keyword != "" || expiryStatus != "" {
		parts := []string{}
		if status != "" {
			parts = append(parts, "状态="+status)
		}
		if keyword != "" {
			parts = append(parts, "关键词="+keyword)
		}
		if expiryStatus != "" {
			parts = append(parts, "到期状态="+expiryStatus)
		}
		filterInfo = strings.Join(parts, ", ")
	}
	sb.WriteString(fmt.Sprintf("导出时间,%s\n", exportTime))
	sb.WriteString(fmt.Sprintf("筛选条件,%s\n", filterInfo))
	sb.WriteString(fmt.Sprintf("数据条数,%s\n", strconv.Itoa(len(data))))
	sb.WriteString("\n")
	sb.WriteString("申请编号,租客姓名,房间号,楼栋,状态,签约状态,房态确认,入住交接,当前处理人,异常原因,创建时间\n")

	for _, r := range data {
		statusLabel := statusMap[r.Status]
		if statusLabel == "" {
			statusLabel = r.Status
		}
		tsLabel := subStatusMap[r.TenantSigningStatus]
		if tsLabel == "" {
			tsLabel = r.TenantSigningStatus
		}
		rcLabel := subStatusMap[r.RoomConfStatus]
		if rcLabel == "" {
			rcLabel = r.RoomConfStatus
		}
		miLabel := subStatusMap[r.MoveInStatus]
		if miLabel == "" {
			miLabel = r.MoveInStatus
		}
		escape := func(s string) string {
			if strings.Contains(s, ",") || strings.Contains(s, "\"") || strings.Contains(s, "\n") {
				return "\"" + strings.ReplaceAll(s, "\"", "\"\"") + "\""
			}
			return s
		}
		sb.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
			escape(r.AppNo), escape(r.TenantName), escape(r.RoomNumber), escape(r.BuildingName),
			escape(statusLabel), escape(tsLabel), escape(rcLabel), escape(miLabel),
			escape(r.HandlerName), escape(r.ExceptionReason), escape(r.CreatedAt)))
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.String(http.StatusOK, sb.String())
}
