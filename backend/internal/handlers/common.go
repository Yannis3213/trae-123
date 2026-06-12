package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
	"trademark-system/internal/database"
	"trademark-system/internal/middleware"
	"trademark-system/internal/models"
)

var currentRole = models.RoleRegistrar

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, code int, message string) {
	respondJSON(w, code, models.ApiResponse{
		Code:    code,
		Message: message,
	})
}

func respondSuccess(w http.ResponseWriter, data interface{}) {
	respondJSON(w, http.StatusOK, models.ApiResponse{
		Code:    200,
		Message: "success",
		Data:    data,
	})
}

func getIntParam(r *http.Request, key string, defaultValue int) int {
	val := r.URL.Query().Get(key)
	if val == "" {
		return defaultValue
	}
	if v, err := strconv.Atoi(val); err == nil {
		return v
	}
	return defaultValue
}

func GetCurrentUserFromContext(r *http.Request) *models.User {
	return middleware.GetCurrentUser(r.Context())
}

func ListRoles(w http.ResponseWriter, r *http.Request) {
	roles := []struct {
		Role     string `json:"role"`
		RoleName string `json:"role_name"`
	}{
		{string(models.RoleRegistrar), "商标申请登记员（流程专员）"},
		{string(models.RoleAgent), "商标申请审核主管（代理人）"},
		{string(models.RoleDirector), "知识产权代理所复核负责人（所长）"},
	}
	respondSuccess(w, roles)
}

func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUserFromContext(r)
	respondSuccess(w, user)
}

func SwitchRole(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	role := models.Role(req.Role)
	if _, ok := models.RoleNames[role]; !ok {
		respondError(w, http.StatusBadRequest, "无效角色")
		return
	}

	currentRole = role
	respondSuccess(w, map[string]interface{}{
		"role":      role,
		"role_name": models.RoleNames[role],
	})
}

func updateWarningStatus(db *sql.DB, id string, dueDateStr string) error {
	dueDate, err := time.ParseInLocation("2006-01-02 15:04:05", dueDateStr, time.Local)
	if err != nil {
		return err
	}
	if dueDate.IsZero() {
		return nil
	}

	warningStatus, warningText := database.CalculateWarning(dueDate)

	var nodeDueDate *time.Time
	db.QueryRow(`SELECT node_due_date FROM trademark_applications WHERE id = ?`, id).Scan(&nodeDueDate)

	nodeOverdue := false
	if nodeDueDate != nil && nodeDueDate.Before(time.Now()) {
		nodeOverdue = true
	}

	_, err = db.Exec(`
		UPDATE trademark_applications 
		SET warning_status = ?, warning_text = ?, node_overdue = ?
		WHERE id = ?
	`, warningStatus, warningText, nodeOverdue, id)
	return err
}

func insertProcessingRecord(db *sql.DB, appID, action, oldStatus, newStatus, handler, opinion, moduleType string) error {
	now := time.Now()
	id := generateID()
	_, err := db.Exec(`
		INSERT INTO processing_records (
			id, application_id, action, old_status, new_status,
			handler, opinion, created_at, module_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, appID, action, oldStatus, newStatus, handler, opinion, now, moduleType)
	return err
}

func insertExceptionReason(db *sql.DB, appID, reason, reasonType, handler, moduleType string) error {
	now := time.Now()
	id := generateID()
	_, err := db.Exec(`
		INSERT INTO exception_reasons (
			id, application_id, reason, reason_type, created_by,
			created_at, module_type, resolved
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, appID, reason, reasonType, handler, now, moduleType, false)
	return err
}

func getNodeInfo(status string) (string, string) {
	nodeMap := map[string][2]string{
		"pending_assign": {"待分派", "商标申请登记员"},
		"transferred":    {"已转办", "商标申请审核主管"},
		"visited":        {"已回访", "知识产权代理所复核负责人"},
		"correction":     {"待补正", "商标申请登记员"},
		"returned":       {"已退回", "商标申请登记员"},
		"archived":       {"已归档", ""},
	}
	if info, ok := nodeMap[status]; ok {
		return info[0], info[1]
	}
	return status, ""
}
