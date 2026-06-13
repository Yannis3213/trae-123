package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"pharmacy-nearexpiry/internal/database"
	"pharmacy-nearexpiry/internal/middleware"
	"pharmacy-nearexpiry/internal/models"
)

type CreateOrderRequest struct {
	StoreName   string    `json:"store_name"`
	ProductName string    `json:"product_name"`
	BatchNo     string    `json:"batch_no"`
	ExpiryDate  time.Time `json:"expiry_date"`
	Quantity    int       `json:"quantity"`
	DueDate     time.Time `json:"due_date"`
	PharmacistID string   `json:"pharmacist_id"`
	Remark      string    `json:"remark"`
}

func ListOrders(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, `{"error":"未授权"}`, http.StatusUnauthorized)
		return
	}

	status := r.URL.Query().Get("status")
	store := r.URL.Query().Get("store")
	keyword := r.URL.Query().Get("keyword")
	onlyMy := r.URL.Query().Get("only_my")

	query := `SELECT id, order_no, store_name, product_name, batch_no, expiry_date, 
		quantity, status, current_handler, created_by, created_at, updated_at, version, due_date, closed_at
		FROM near_expiry_orders WHERE 1=1`
	var args []interface{}

	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}

	if store != "" {
		query += " AND store_name = ?"
		args = append(args, store)
	}

	if keyword != "" {
		query += " AND (order_no LIKE ? OR product_name LIKE ? OR store_name LIKE ?)"
		kw := "%" + keyword + "%"
		args = append(args, kw, kw, kw)
	}

	if onlyMy == "true" {
		query += " AND (current_handler = ? OR created_by = ?)"
		args = append(args, user.ID, user.ID)
	}

	query += " ORDER BY created_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, `{"error":"查询失败"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []models.OrderListItem
	for rows.Next() {
		var o models.NearExpiryOrder
		var closedAt sql.NullTime
		err := rows.Scan(&o.ID, &o.OrderNo, &o.StoreName, &o.ProductName, &o.BatchNo,
			&o.ExpiryDate, &o.Quantity, &o.Status, &o.CurrentHandler, &o.CreatedBy,
			&o.CreatedAt, &o.UpdatedAt, &o.Version, &o.DueDate, &closedAt)
		if err != nil {
			continue
		}
		if closedAt.Valid {
			o.ClosedAt = &closedAt.Time
		}

		hasInspection, hasTransfer, hasRemoval := getEvidenceStatus(o.ID)
		var missing []models.EvidenceType
		if !hasInspection {
			missing = append(missing, models.EvidenceInspection)
		}
		if !hasTransfer {
			missing = append(missing, models.EvidenceTransfer)
		}
		if !hasRemoval {
			missing = append(missing, models.EvidenceRemoval)
		}

		now := time.Now()
		isOverdue := o.DueDate.Before(now) && o.Status != models.StatusClosed
		isNearDue := !isOverdue && o.DueDate.Sub(now).Hours() < 72

		items = append(items, models.OrderListItem{
			NearExpiryOrder:  o,
			HasInspection:    hasInspection,
			HasTransfer:      hasTransfer,
			HasRemoval:       hasRemoval,
			MissingEvidences: missing,
			EvidenceComplete: len(missing) == 0,
			IsOverdue:        isOverdue,
			IsNearDue:        isNearDue,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func getEvidenceStatus(orderID string) (hasInspection bool, hasTransfer bool, hasRemoval bool) {
	rows, err := database.DB.Query("SELECT DISTINCT evidence_type FROM attachments WHERE order_id = ?", orderID)
	if err != nil {
		return false, false, false
	}
	defer rows.Close()

	for rows.Next() {
		var et string
		rows.Scan(&et)
		switch models.EvidenceType(et) {
		case models.EvidenceInspection:
			hasInspection = true
		case models.EvidenceTransfer:
			hasTransfer = true
		case models.EvidenceRemoval:
			hasRemoval = true
		}
	}
	return
}

func GetOrderDetail(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")

	var order models.NearExpiryOrder
	var closedAt sql.NullTime
	err := database.DB.QueryRow(`SELECT id, order_no, store_name, product_name, batch_no, expiry_date,
		quantity, status, current_handler, created_by, created_at, updated_at, version, due_date, closed_at
		FROM near_expiry_orders WHERE id = ?`, orderID).Scan(
		&order.ID, &order.OrderNo, &order.StoreName, &order.ProductName, &order.BatchNo,
		&order.ExpiryDate, &order.Quantity, &order.Status, &order.CurrentHandler, &order.CreatedBy,
		&order.CreatedAt, &order.UpdatedAt, &order.Version, &order.DueDate, &closedAt,
	)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"处理单不存在"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"查询失败"}`, http.StatusInternalServerError)
		return
	}
	if closedAt.Valid {
		order.ClosedAt = &closedAt.Time
	}

	attachments := getAttachments(orderID)
	records := getProcessingRecords(orderID)
	notes := getAuditNotes(orderID)
	exceptions := getExceptionReasons(orderID)
	missing := getMissingEvidences(orderID)

	now := time.Now()
	isOverdue := order.DueDate.Before(now) && order.Status != models.StatusClosed
	isNearDue := !isOverdue && order.DueDate.Sub(now).Hours() < 72

	detail := models.OrderDetail{
		NearExpiryOrder:   order,
		Attachments:       attachments,
		ProcessingRecords: records,
		AuditNotes:        notes,
		ExceptionReasons:  exceptions,
		MissingEvidences:  missing,
		IsOverdue:         isOverdue,
		IsNearDue:         isNearDue,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detail)
}

func getMissingEvidences(orderID string) []models.EvidenceType {
	rows, _ := database.DB.Query("SELECT DISTINCT evidence_type FROM attachments WHERE order_id = ?", orderID)
	defer rows.Close()

	exists := make(map[models.EvidenceType]bool)
	for rows.Next() {
		var et string
		rows.Scan(&et)
		exists[models.EvidenceType(et)] = true
	}

	var missing []models.EvidenceType
	required := []models.EvidenceType{models.EvidenceInspection, models.EvidenceTransfer, models.EvidenceRemoval}
	for _, req := range required {
		if !exists[req] {
			missing = append(missing, req)
		}
	}
	return missing
}

func getAttachments(orderID string) []models.Attachment {
	rows, _ := database.DB.Query(`SELECT id, order_id, evidence_type, file_name, uploaded_by, uploaded_at, remark
		FROM attachments WHERE order_id = ? ORDER BY uploaded_at DESC`, orderID)
	defer rows.Close()

	var attachments []models.Attachment
	for rows.Next() {
		var a models.Attachment
		rows.Scan(&a.ID, &a.OrderID, &a.EvidenceType, &a.FileName, &a.UploadedBy, &a.UploadedAt, &a.Remark)
		attachments = append(attachments, a)
	}
	return attachments
}

func getProcessingRecords(orderID string) []models.ProcessingRecord {
	rows, _ := database.DB.Query(`SELECT id, order_id, action, from_status, to_status, operator, operator_role, remark, created_at
		FROM processing_records WHERE order_id = ? ORDER BY created_at ASC`, orderID)
	defer rows.Close()

	var records []models.ProcessingRecord
	for rows.Next() {
		var r models.ProcessingRecord
		rows.Scan(&r.ID, &r.OrderID, &r.Action, &r.FromStatus, &r.ToStatus,
			&r.Operator, &r.OperatorRole, &r.Remark, &r.CreatedAt)
		records = append(records, r)
	}
	return records
}

func getAuditNotes(orderID string) []models.AuditNote {
	rows, _ := database.DB.Query(`SELECT id, order_id, content, author, created_at
		FROM audit_notes WHERE order_id = ? ORDER BY created_at DESC`, orderID)
	defer rows.Close()

	var notes []models.AuditNote
	for rows.Next() {
		var n models.AuditNote
		rows.Scan(&n.ID, &n.OrderID, &n.Content, &n.Author, &n.CreatedAt)
		notes = append(notes, n)
	}
	return notes
}

func getExceptionReasons(orderID string) []models.ExceptionReason {
	rows, _ := database.DB.Query(`SELECT id, order_id, reason, exception_type, reported_by, created_at, resolved
		FROM exception_reasons WHERE order_id = ? ORDER BY created_at DESC`, orderID)
	defer rows.Close()

	var reasons []models.ExceptionReason
	for rows.Next() {
		var e models.ExceptionReason
		var resolved int
		rows.Scan(&e.ID, &e.OrderID, &e.Reason, &e.ExceptionType, &e.ReportedBy, &e.CreatedAt, &resolved)
		e.Resolved = resolved == 1
		reasons = append(reasons, e)
	}
	return reasons
}

func CreateOrder(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, `{"error":"未授权"}`, http.StatusUnauthorized)
		return
	}

	if user.Role != models.RoleShopClerk {
		http.Error(w, `{"error":"只有门店店员可以创建处理单"}`, http.StatusForbidden)
		return
	}

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"请求参数错误"}`, http.StatusBadRequest)
		return
	}

	if req.StoreName == "" || req.ProductName == "" || req.BatchNo == "" || req.Quantity <= 0 {
		http.Error(w, `{"error":"请填写完整信息"}`, http.StatusBadRequest)
		return
	}

	if req.PharmacistID == "" {
		http.Error(w, `{"error":"请指定处理药师"}`, http.StatusBadRequest)
		return
	}

	var pharmacistExists bool
	database.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE id = ? AND role = ?)",
		req.PharmacistID, models.RolePharmacist).Scan(&pharmacistExists)
	if !pharmacistExists {
		http.Error(w, `{"error":"指定的执业药师不存在"}`, http.StatusBadRequest)
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		http.Error(w, `{"error":"创建失败"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var maxNo int
	tx.QueryRow("SELECT COALESCE(MAX(CAST(SUBSTR(order_no, 9) AS INTEGER)), 0) FROM near_expiry_orders").Scan(&maxNo)
	orderNo := "JXQ-2026-" + formatSerial(maxNo+1)

	now := time.Now()
	orderID := uuid.NewString()
	dueDate := req.DueDate
	if dueDate.IsZero() {
		dueDate = now.AddDate(0, 0, 7)
	}

	_, err = tx.Exec(`INSERT INTO near_expiry_orders
		(id, order_no, store_name, product_name, batch_no, expiry_date, quantity, 
		 status, current_handler, created_by, created_at, updated_at, version, due_date)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		orderID, orderNo, req.StoreName, req.ProductName, req.BatchNo, req.ExpiryDate,
		req.Quantity, models.StatusPendingDispatch, req.PharmacistID, user.ID,
		now, now, 1, dueDate,
	)
	if err != nil {
		http.Error(w, `{"error":"创建失败"}`, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(`INSERT INTO processing_records
		(id, order_id, action, from_status, to_status, operator, operator_role, remark, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), orderID, "创建", "", models.StatusPendingDispatch,
		user.ID, user.Role, req.Remark, now,
	)

	_, err = tx.Exec(`INSERT INTO processing_records
		(id, order_id, action, from_status, to_status, operator, operator_role, remark, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), orderID, "派发", models.StatusPendingDispatch, models.StatusPendingDispatch,
		user.ID, user.Role, "指派给执业药师处理", now,
	)

	if err = tx.Commit(); err != nil {
		http.Error(w, `{"error":"创建失败"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":       orderID,
		"order_no": orderNo,
		"status":   models.StatusPendingDispatch,
	})
}

func formatSerial(n int) string {
	if n < 10 {
		return "000" + string(rune('0'+n))
	}
	if n < 100 {
		return "00" + itoa(n)
	}
	if n < 1000 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var result string
	for n > 0 {
		result = string(rune('0'+n%10)) + result
		n /= 10
	}
	return result
}
