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

type AuditHandler struct {
	DB *sql.DB
}

func (h *AuditHandler) List(c echo.Context) error {
	recordID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的记录ID"})
	}

	rows, err := h.DB.Query("SELECT id, record_id, handler_id, note, created_at FROM audit_notes WHERE record_id = ? ORDER BY created_at ASC", recordID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "查询失败"})
	}
	defer rows.Close()

	var notes []models.AuditNote
	for rows.Next() {
		var n models.AuditNote
		if err := rows.Scan(&n.ID, &n.RecordID, &n.HandlerID, &n.Note, &n.CreatedAt); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "数据解析失败"})
		}
		notes = append(notes, n)
	}

	return c.JSON(http.StatusOK, notes)
}

func (h *AuditHandler) Create(c echo.Context) error {
	recordID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的记录ID"})
	}

	var req struct {
		Note string `json:"note"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求参数错误"})
	}

	if req.Note == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "备注内容不能为空"})
	}

	userID := middleware.GetUserID(c)
	now := time.Now().Format("2006-01-02 15:04:05")

	result, err := h.DB.Exec(
		"INSERT INTO audit_notes (record_id, handler_id, note, created_at) VALUES (?, ?, ?, ?)",
		recordID, userID, req.Note, now,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "创建备注失败"})
	}

	id, _ := result.LastInsertId()
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "message": "备注创建成功"})
}
