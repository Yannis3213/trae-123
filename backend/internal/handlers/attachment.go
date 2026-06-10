package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"aviation-ground-service/internal/middleware"
	"aviation-ground-service/internal/models"

	"github.com/labstack/echo/v4"
)

type AttachmentHandler struct {
	DB *sql.DB
}

func (h *AttachmentHandler) Upload(c echo.Context) error {
	recordID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的记录ID"})
	}

	var exists int
	h.DB.QueryRow("SELECT 1 FROM checkin_records WHERE id = ?", recordID).Scan(&exists)
	if exists != 1 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "记录不存在"})
	}

	attachType := c.FormValue("type")
	if attachType == "" {
		attachType = string(models.AttachCheckinEvidence)
	}

	fileName := c.FormValue("file_name")
	if fileName == "" {
		fileName = fmt.Sprintf("attachment_%d_%s", recordID, attachType)
	}

	userID := middleware.GetUserID(c)
	now := time.Now().Format("2006-01-02 15:04:05")
	filePath := fmt.Sprintf("/uploads/%d/%s", recordID, fileName)

	result, err := h.DB.Exec(
		"INSERT INTO attachments (record_id, type, file_name, file_path, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		recordID, attachType, fileName, filePath, userID, now,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "上传附件失败"})
	}

	id, _ := result.LastInsertId()
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "message": "附件上传成功"})
}

func (h *AttachmentHandler) List(c echo.Context) error {
	recordID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的记录ID"})
	}

	rows, err := h.DB.Query("SELECT id, record_id, type, file_name, file_path, uploaded_by, created_at FROM attachments WHERE record_id = ?", recordID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "查询失败"})
	}
	defer rows.Close()

	var attachments []models.Attachment
	for rows.Next() {
		var a models.Attachment
		if err := rows.Scan(&a.ID, &a.RecordID, &a.Type, &a.FileName, &a.FilePath, &a.UploadedBy, &a.CreatedAt); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "数据解析失败"})
		}
		attachments = append(attachments, a)
	}

	return c.JSON(http.StatusOK, attachments)
}

func (h *AttachmentHandler) Delete(c echo.Context) error {
	recordID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的记录ID"})
	}

	attachID, err := strconv.ParseInt(c.Param("aid"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的附件ID"})
	}

	result, err := h.DB.Exec("DELETE FROM attachments WHERE id = ? AND record_id = ?", attachID, recordID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "删除附件失败"})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "附件不存在"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "附件删除成功"})
}
