package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"aviation-ground-service/internal/middleware"
	"aviation-ground-service/internal/models"

	"github.com/labstack/echo/v4"
)

type ExceptionHandler struct {
	DB *sql.DB
}

func (h *ExceptionHandler) List(c echo.Context) error {
	recordID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的记录ID"})
	}

	rows, err := h.DB.Query("SELECT id, record_id, reason_type, description, created_by, created_at FROM exception_reasons WHERE record_id = ? ORDER BY created_at ASC", recordID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "查询失败"})
	}
	defer rows.Close()

	var reasons []models.ExceptionReason
	for rows.Next() {
		var r models.ExceptionReason
		if err := rows.Scan(&r.ID, &r.RecordID, &r.ReasonType, &r.Description, &r.CreatedBy, &r.CreatedAt); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "数据解析失败"})
		}
		reasons = append(reasons, r)
	}

	return c.JSON(http.StatusOK, reasons)
}

func (h *ExceptionHandler) Create(c echo.Context) error {
	recordID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的记录ID"})
	}

	var req struct {
		ReasonType  string `json:"reason_type"`
		Description string `json:"description"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求参数错误"})
	}

	if req.ReasonType == "" || req.Description == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "异常类型和描述不能为空"})
	}

	userID := middleware.GetUserID(c)
	now := time.Now().Format("2006-01-02 15:04:05")

	result, err := h.DB.Exec(
		"INSERT INTO exception_reasons (record_id, reason_type, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
		recordID, req.ReasonType, req.Description, userID, now,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "创建异常原因失败"})
	}

	id, _ := result.LastInsertId()
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "message": "异常原因创建成功"})
}
