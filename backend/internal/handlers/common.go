package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"pharmacy-nearexpiry/internal/database"
	"pharmacy-nearexpiry/internal/middleware"
	"pharmacy-nearexpiry/internal/models"
)

func ListUsers(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")

	query := "SELECT id, username, name, role, store FROM users WHERE 1=1"
	var args []interface{}

	if role != "" {
		query += " AND role = ?"
		args = append(args, role)
	}
	query += " ORDER BY name"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, `{"error":"查询失败"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		rows.Scan(&u.ID, &u.Username, &u.Name, &u.Role, &u.Store)
		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, `{"error":"未授权"}`, http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

type AddAuditNoteRequest struct {
	Content string `json:"content"`
}

func AddAuditNote(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, `{"error":"未授权"}`, http.StatusUnauthorized)
		return
	}

	orderID := chiURLParam(r, "id")

	var req AddAuditNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
		http.Error(w, `{"error":"请输入备注内容"}`, http.StatusBadRequest)
		return
	}

	noteID := uuid.NewString()
	now := time.Now()

	_, err := database.DB.Exec(`INSERT INTO audit_notes (id, order_id, content, author, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		noteID, orderID, req.Content, user.ID, now,
	)
	if err != nil {
		http.Error(w, `{"error":"添加备注失败"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         noteID,
		"content":    req.Content,
		"author":     user.ID,
		"created_at": now,
	})
}

type UploadAttachmentRequest struct {
	EvidenceType string `json:"evidence_type"`
	FileName     string `json:"file_name"`
	Remark       string `json:"remark"`
}

func UploadAttachment(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, `{"error":"未授权"}`, http.StatusUnauthorized)
		return
	}

	orderID := chiURLParam(r, "id")

	var req UploadAttachmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"请求参数错误"}`, http.StatusBadRequest)
		return
	}

	if req.EvidenceType == "" || req.FileName == "" {
		http.Error(w, `{"error":"请填写完整信息"}`, http.StatusBadRequest)
		return
	}

	evType := models.EvidenceType(req.EvidenceType)
	if evType != models.EvidenceInspection && evType != models.EvidenceTransfer && evType != models.EvidenceRemoval {
		http.Error(w, `{"error":"无效的证据类型"}`, http.StatusBadRequest)
		return
	}

	var orderExists bool
	database.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM near_expiry_orders WHERE id = ?)", orderID).Scan(&orderExists)
	if !orderExists {
		http.Error(w, `{"error":"处理单不存在"}`, http.StatusNotFound)
		return
	}

	attachID := uuid.NewString()
	now := time.Now()

	_, err := database.DB.Exec(`INSERT INTO attachments (id, order_id, evidence_type, file_name, uploaded_by, uploaded_at, remark)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		attachID, orderID, evType, req.FileName, user.ID, now, req.Remark,
	)
	if err != nil {
		http.Error(w, `{"error":"上传失败"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":            attachID,
		"evidence_type": evType,
		"file_name":     req.FileName,
		"uploaded_by":   user.ID,
		"uploaded_at":   now,
	})
}

func GetStats(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, `{"error":"未授权"}`, http.StatusUnauthorized)
		return
	}

	now := time.Now()
	threeDaysLater := now.AddDate(0, 0, 3)

	stats := make(map[string]interface{})

	var total int
	database.DB.QueryRow("SELECT COUNT(*) FROM near_expiry_orders").Scan(&total)
	stats["total"] = total

	var pending int
	database.DB.QueryRow("SELECT COUNT(*) FROM near_expiry_orders WHERE status = ?", models.StatusPendingDispatch).Scan(&pending)
	stats["pending_dispatch"] = pending

	var processing int
	database.DB.QueryRow("SELECT COUNT(*) FROM near_expiry_orders WHERE status = ?", models.StatusProcessing).Scan(&processing)
	stats["processing"] = processing

	var closed int
	database.DB.QueryRow("SELECT COUNT(*) FROM near_expiry_orders WHERE status = ?", models.StatusClosed).Scan(&closed)
	stats["closed"] = closed

	var returned int
	database.DB.QueryRow("SELECT COUNT(*) FROM near_expiry_orders WHERE status = ?", models.StatusReturned).Scan(&returned)
	stats["returned"] = returned

	var myPending int
	database.DB.QueryRow("SELECT COUNT(*) FROM near_expiry_orders WHERE current_handler = ? AND status != ?",
		user.ID, models.StatusClosed).Scan(&myPending)
	stats["my_pending"] = myPending

	var overdue int
	database.DB.QueryRow("SELECT COUNT(*) FROM near_expiry_orders WHERE due_date < ? AND status != ?",
		now, models.StatusClosed).Scan(&overdue)
	stats["overdue"] = overdue

	var nearDue int
	database.DB.QueryRow("SELECT COUNT(*) FROM near_expiry_orders WHERE due_date >= ? AND due_date <= ? AND status != ?",
		now, threeDaysLater, models.StatusClosed).Scan(&nearDue)
	stats["near_due"] = nearDue

	var normal int
	database.DB.QueryRow("SELECT COUNT(*) FROM near_expiry_orders WHERE due_date > ? AND status != ?",
		threeDaysLater, models.StatusClosed).Scan(&normal)
	stats["normal"] = normal

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"time":   time.Now(),
	})
}
