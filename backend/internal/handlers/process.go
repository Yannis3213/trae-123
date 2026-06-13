package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"pharmacy-nearexpiry/internal/database"
	"pharmacy-nearexpiry/internal/middleware"
	"pharmacy-nearexpiry/internal/models"
)

type ProcessOrderRequest struct {
	Version         int    `json:"version"`
	Remark          string `json:"remark"`
	Action          string `json:"action"`
	EvidenceType    string `json:"evidence_type"`
	FileName        string `json:"file_name"`
	ExceptionReason string `json:"exception_reason"`
}

type BatchProcessRequest struct {
	OrderIDs []string `json:"order_ids"`
	Versions []int    `json:"versions"`
	Action   string   `json:"action"`
	Remark   string   `json:"remark"`
	ExceptionReason string `json:"exception_reason"`
}

func recordInterception(tx *sql.Tx, orderID string, user *models.User, action string, reason string) {
	now := time.Now()
	tx.Exec(`INSERT INTO processing_records
		(id, order_id, action, from_status, to_status, operator, operator_role, remark, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), orderID, "拦截: "+action, "", "",
		user.ID, user.Role, reason, now,
	)
	tx.Exec(`INSERT INTO exception_reasons
		(id, order_id, reason, exception_type, reported_by, created_at, resolved)
		VALUES (?, ?, ?, ?, ?, ?, 0)`,
		uuid.NewString(), orderID, reason, "interception", user.ID, now,
	)
	tx.Exec(`INSERT INTO audit_notes (id, order_id, content, author, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		uuid.NewString(), orderID, fmt.Sprintf("[拦截] %s: %s", action, reason), user.ID, now,
	)
}

func ProcessOrder(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, `{"error":"未授权"}`, http.StatusUnauthorized)
		return
	}

	orderID := chiURLParam(r, "id")

	var req ProcessOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"请求参数错误"}`, http.StatusBadRequest)
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		http.Error(w, `{"error":"处理失败"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var order models.NearExpiryOrder
	var currentVersion int
	err = tx.QueryRow(`SELECT id, order_no, status, current_handler, version, due_date, created_by
		FROM near_expiry_orders WHERE id = ?`, orderID).Scan(
		&order.ID, &order.OrderNo, &order.Status, &order.CurrentHandler,
		&currentVersion, &order.DueDate, &order.CreatedBy,
	)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"处理单不存在"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"查询失败"}`, http.StatusInternalServerError)
		return
	}

	if req.Version != currentVersion {
		reason := fmt.Sprintf("版本冲突: 提交版本%d, 当前版本%d", req.Version, currentVersion)
		recordInterception(tx, orderID, user, req.Action, reason)
		tx.Commit()
		http.Error(w, fmt.Sprintf(`{"error":"版本冲突，请刷新后重试"}`), http.StatusConflict)
		return
	}

	if order.Status == models.StatusClosed {
		reason := "处理单已关闭，无法操作"
		recordInterception(tx, orderID, user, req.Action, reason)
		tx.Commit()
		http.Error(w, `{"error":"处理单已关闭，无法操作"}`, http.StatusBadRequest)
		return
	}

	var newStatus models.OrderStatus
	var actionName string
	var newHandler string

	switch req.Action {
	case "process":
		if user.Role != models.RolePharmacist {
			reason := fmt.Sprintf("角色越权: %s尝试处理，只有执业药师可以处理", user.Role)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"只有执业药师可以处理"}`, http.StatusForbidden)
			return
		}
		if order.Status != models.StatusPendingDispatch && order.Status != models.StatusReturned {
			reason := fmt.Sprintf("状态不允许: 当前%s，不允许处理", order.Status)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"当前状态不允许处理"}`, http.StatusBadRequest)
			return
		}
		if order.CurrentHandler != user.ID {
			reason := fmt.Sprintf("越权操作: 当前处理人%s，操作人%s", order.CurrentHandler, user.ID)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"不是当前处理人，越权操作"}`, http.StatusForbidden)
			return
		}
		if order.Status == models.StatusPendingDispatch {
			missing := getMissingEvidencesTx(tx, orderID)
			if len(missing) > 0 {
				reason := fmt.Sprintf("待派发缺证据不得进入处理中: 缺少%v", missing)
				recordInterception(tx, orderID, user, req.Action, reason)
				tx.Commit()
				http.Error(w, fmt.Sprintf(`{"error":"缺少必要证据材料，无法开始处理"}`), http.StatusBadRequest)
				return
			}
		}
		newStatus = models.StatusProcessing
		actionName = "处理完成"
		newHandler = user.ID

	case "submit_review":
		if user.Role != models.RolePharmacist {
			reason := fmt.Sprintf("角色越权: %s尝试提交复核，只有执业药师可以提交复核", user.Role)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"只有执业药师可以提交复核"}`, http.StatusForbidden)
			return
		}
		if order.Status != models.StatusProcessing {
			reason := fmt.Sprintf("状态不允许: 当前%s，不允许提交复核", order.Status)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"当前状态不允许提交复核"}`, http.StatusBadRequest)
			return
		}
		if order.CurrentHandler != user.ID {
			reason := fmt.Sprintf("越权操作: 当前处理人%s，操作人%s", order.CurrentHandler, user.ID)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"不是当前处理人，越权操作"}`, http.StatusForbidden)
			return
		}
		missing := getMissingEvidencesTx(tx, orderID)
		if len(missing) > 0 {
			reason := fmt.Sprintf("缺少必要证据材料: %v", missing)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"缺少必要证据材料，无法提交复核"}`, http.StatusBadRequest)
			return
		}
		newStatus = models.StatusProcessing
		actionName = "提交复核"
		newHandler = "manager01"

	case "review_approve":
		if user.Role != models.RoleAreaManager {
			reason := fmt.Sprintf("角色越权: %s尝试复核，只有区域经理可以复核", user.Role)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"只有区域经理可以复核"}`, http.StatusForbidden)
			return
		}
		if order.Status != models.StatusProcessing {
			reason := fmt.Sprintf("状态不允许: 当前%s，不允许复核", order.Status)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"当前状态不允许复核"}`, http.StatusBadRequest)
			return
		}
		if order.CurrentHandler != user.ID {
			reason := fmt.Sprintf("越权操作: 当前处理人%s，操作人%s", order.CurrentHandler, user.ID)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"不是当前处理人，越权操作"}`, http.StatusForbidden)
			return
		}
		missing := getMissingEvidencesTx(tx, orderID)
		if len(missing) > 0 {
			reason := fmt.Sprintf("缺少必要证据材料: %v", missing)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"缺少必要证据材料，无法通过复核"}`, http.StatusBadRequest)
			return
		}
		newStatus = models.StatusClosed
		actionName = "复核通过"
		newHandler = ""

	case "review_reject":
		if user.Role != models.RoleAreaManager {
			reason := fmt.Sprintf("角色越权: %s尝试退回，只有区域经理可以退回", user.Role)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"只有区域经理可以退回"}`, http.StatusForbidden)
			return
		}
		if order.Status != models.StatusProcessing {
			reason := fmt.Sprintf("状态不允许: 当前%s，不允许退回", order.Status)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"当前状态不允许退回"}`, http.StatusBadRequest)
			return
		}
		if order.CurrentHandler != user.ID {
			reason := fmt.Sprintf("越权操作: 当前处理人%s，操作人%s", order.CurrentHandler, user.ID)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"不是当前处理人，越权操作"}`, http.StatusForbidden)
			return
		}
		if req.ExceptionReason == "" {
			http.Error(w, `{"error":"请填写退回原因"}`, http.StatusBadRequest)
			return
		}
		newStatus = models.StatusReturned
		actionName = "退回补正"
		newHandler = order.CreatedBy

		_, err = tx.Exec(`INSERT INTO exception_reasons 
			(id, order_id, reason, exception_type, reported_by, created_at, resolved)
			VALUES (?, ?, ?, ?, ?, ?, 0)`,
			uuid.NewString(), orderID, req.ExceptionReason, "return_reject", user.ID, time.Now(),
		)
		if err != nil {
			http.Error(w, `{"error":"记录异常失败"}`, http.StatusInternalServerError)
			return
		}

		_, err = tx.Exec(`INSERT INTO audit_notes (id, order_id, content, author, created_at)
			VALUES (?, ?, ?, ?, ?)`,
			uuid.NewString(), orderID, fmt.Sprintf("[退回补正] %s", req.ExceptionReason), user.ID, time.Now(),
		)
		if err != nil {
			http.Error(w, `{"error":"记录审计备注失败"}`, http.StatusInternalServerError)
			return
		}

	case "correct":
		if user.Role != models.RoleShopClerk {
			reason := fmt.Sprintf("角色越权: %s尝试补正，只有门店店员可以补正", user.Role)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"只有门店店员可以补正"}`, http.StatusForbidden)
			return
		}
		if order.Status != models.StatusReturned && order.Status != models.StatusPendingDispatch {
			reason := fmt.Sprintf("状态不允许: 当前%s，不允许补正", order.Status)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"当前状态不允许补正"}`, http.StatusBadRequest)
			return
		}
		if order.Status == models.StatusReturned {
			if order.CurrentHandler != user.ID && order.CreatedBy != user.ID {
				reason := fmt.Sprintf("越权操作: 退回处理人%s，创建人%s，操作人%s", order.CurrentHandler, order.CreatedBy, user.ID)
				recordInterception(tx, orderID, user, req.Action, reason)
				tx.Commit()
				http.Error(w, `{"error":"不是退回处理人或创建人，越权操作"}`, http.StatusForbidden)
				return
			}
		}
		if order.Status == models.StatusPendingDispatch {
			if order.CreatedBy != user.ID {
				reason := fmt.Sprintf("越权操作: 创建人%s，操作人%s", order.CreatedBy, user.ID)
				recordInterception(tx, orderID, user, req.Action, reason)
				tx.Commit()
				http.Error(w, `{"error":"不是创建人，越权操作"}`, http.StatusForbidden)
				return
			}
		}
		missing := getMissingEvidencesTx(tx, orderID)
		if len(missing) > 0 {
			reason := fmt.Sprintf("补正后仍缺证据: %v", missing)
			recordInterception(tx, orderID, user, req.Action, reason)
			tx.Commit()
			http.Error(w, `{"error":"证据不全，补正提交前请补齐所有证据"}`, http.StatusBadRequest)
			return
		}
		newStatus = models.StatusPendingDispatch
		actionName = "补正提交"

		var pharmacistID string
		tx.QueryRow(`SELECT id FROM users WHERE role = ? AND store = (SELECT store_name FROM near_expiry_orders WHERE id = ?) LIMIT 1`,
			models.RolePharmacist, orderID).Scan(&pharmacistID)
		newHandler = pharmacistID

		_, err = tx.Exec(`UPDATE exception_reasons SET resolved = 1 WHERE order_id = ? AND resolved = 0`,
			orderID,
		)

		_, err = tx.Exec(`INSERT INTO audit_notes (id, order_id, content, author, created_at)
			VALUES (?, ?, ?, ?, ?)`,
			uuid.NewString(), orderID, fmt.Sprintf("[补正提交] %s", func() string {
				if req.Remark != "" {
					return req.Remark
				}
				return "门店店员补正后重新提交"
			}()), user.ID, time.Now(),
		)

	default:
		http.Error(w, `{"error":"未知操作"}`, http.StatusBadRequest)
		return
	}

	now := time.Now()
	var updateSQL string
	var args []interface{}

	if newStatus == models.StatusClosed {
		updateSQL = `UPDATE near_expiry_orders SET status = ?, current_handler = ?, updated_at = ?, version = version + 1, closed_at = ? WHERE id = ? AND version = ?`
		args = []interface{}{newStatus, newHandler, now, now, orderID, currentVersion}
	} else {
		updateSQL = `UPDATE near_expiry_orders SET status = ?, current_handler = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`
		args = []interface{}{newStatus, newHandler, now, orderID, currentVersion}
	}

	result, err := tx.Exec(updateSQL, args...)
	if err != nil {
		http.Error(w, `{"error":"更新失败"}`, http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		reason := "状态已变更，更新时版本冲突"
		recordInterception(tx, orderID, user, req.Action, reason)
		tx.Commit()
		http.Error(w, `{"error":"状态已变更，请刷新后重试"}`, http.StatusConflict)
		return
	}

	if req.EvidenceType != "" && req.FileName != "" {
		evType := models.EvidenceType(req.EvidenceType)
		if evType == models.EvidenceInspection || evType == models.EvidenceTransfer || evType == models.EvidenceRemoval {
			_, err = tx.Exec(`INSERT INTO attachments 
				(id, order_id, evidence_type, file_name, uploaded_by, uploaded_at, remark)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
				uuid.NewString(), orderID, evType, req.FileName, user.ID, now, req.Remark,
			)
			if err != nil {
				http.Error(w, `{"error":"上传附件失败"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	_, err = tx.Exec(`INSERT INTO processing_records
		(id, order_id, action, from_status, to_status, operator, operator_role, remark, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), orderID, actionName, order.Status, newStatus,
		user.ID, user.Role, req.Remark, now,
	)
	if err != nil {
		http.Error(w, `{"error":"记录操作日志失败"}`, http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, `{"error":"提交失败"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"new_status":   newStatus,
		"new_version":  currentVersion + 1,
		"new_handler":  newHandler,
		"action":       actionName,
	})
}

func chiURLParam(r *http.Request, key string) string {
	chiCtx := chi.RouteContext(r.Context())
	if chiCtx != nil {
		for i, k := range chiCtx.URLParams.Keys {
			if k == key && i < len(chiCtx.URLParams.Values) {
				return chiCtx.URLParams.Values[i]
			}
		}
	}
	return ""
}

func getMissingEvidencesTx(tx *sql.Tx, orderID string) []models.EvidenceType {
	rows, _ := tx.Query("SELECT DISTINCT evidence_type FROM attachments WHERE order_id = ?", orderID)
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

func BatchProcess(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, `{"error":"未授权"}`, http.StatusUnauthorized)
		return
	}

	var req BatchProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"请求参数错误"}`, http.StatusBadRequest)
		return
	}

	if len(req.OrderIDs) == 0 {
		http.Error(w, `{"error":"请选择要处理的单据"}`, http.StatusBadRequest)
		return
	}

	if len(req.OrderIDs) > 50 {
		http.Error(w, `{"error":"批量处理最多50条"}`, http.StatusBadRequest)
		return
	}

	if len(req.Versions) > 0 && len(req.Versions) != len(req.OrderIDs) {
		http.Error(w, `{"error":"版本号数量与单据数量不一致"}`, http.StatusBadRequest)
		return
	}

	var results []models.BatchResult

	for i, orderID := range req.OrderIDs {
		var version int
		if len(req.Versions) > i {
			version = req.Versions[i]
		}
		result := processSingleOrder(user, orderID, req.Action, req.Remark, version, req.ExceptionReason)
		results = append(results, result)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func processSingleOrder(user *models.User, orderID string, action string, remark string, reqVersion int, exceptionReason string) models.BatchResult {
	tx, err := database.DB.Begin()
	if err != nil {
		return models.BatchResult{OrderID: orderID, Success: false, Message: "数据库错误"}
	}
	defer tx.Rollback()

	var order models.NearExpiryOrder
	var currentVersion int
	err = tx.QueryRow(`SELECT id, order_no, status, current_handler, version, created_by
		FROM near_expiry_orders WHERE id = ?`, orderID).Scan(
		&order.ID, &order.OrderNo, &order.Status, &order.CurrentHandler, &currentVersion, &order.CreatedBy,
	)
	if err == sql.ErrNoRows {
		return models.BatchResult{OrderID: orderID, Success: false, Message: "处理单不存在"}
	}
	if err != nil {
		return models.BatchResult{OrderID: orderID, Success: false, Message: "查询失败"}
	}

	result := models.BatchResult{OrderID: orderID, OrderNo: order.OrderNo, Success: false}

	if reqVersion > 0 && reqVersion != currentVersion {
		reason := fmt.Sprintf("版本冲突: 提交版本%d, 当前版本%d", reqVersion, currentVersion)
		recordInterception(tx, orderID, user, action, reason)
		tx.Commit()
		result.Message = "版本冲突，请刷新后重试"
		result.NewVersion = currentVersion
		return result
	}

	if order.Status == models.StatusClosed {
		recordInterception(tx, orderID, user, action, "处理单已关闭，无法批量操作")
		tx.Commit()
		result.Message = "处理单已关闭"
		return result
	}

	var newStatus models.OrderStatus
	var actionName string
	var newHandler string

	switch action {
	case "process":
		if user.Role != models.RolePharmacist {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("角色越权: %s尝试批量处理，只有执业药师可以处理", user.Role))
			tx.Commit()
			result.Message = "权限不足，只有执业药师可以处理"
			return result
		}
		if order.Status != models.StatusPendingDispatch && order.Status != models.StatusReturned {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("状态不允许: 当前%s，不允许批量处理", order.Status))
			tx.Commit()
			result.Message = "状态不允许处理"
			return result
		}
		if order.CurrentHandler != user.ID {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("越权: 处理人%s，操作人%s", order.CurrentHandler, user.ID))
			tx.Commit()
			result.Message = "不是当前处理人，越权操作"
			return result
		}
		if order.Status == models.StatusPendingDispatch {
			missing := getMissingEvidencesTx(tx, orderID)
			if len(missing) > 0 {
				reason := fmt.Sprintf("待派发缺证据不得进入处理中: 缺少%v", missing)
				recordInterception(tx, orderID, user, action, reason)
				tx.Commit()
				result.Message = "缺少必要证据材料，无法开始处理"
				return result
			}
		}
		newStatus = models.StatusProcessing
		actionName = "批量处理"
		newHandler = user.ID

	case "submit_review":
		if user.Role != models.RolePharmacist {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("角色越权: %s尝试批量提交复核，只有执业药师可以提交复核", user.Role))
			tx.Commit()
			result.Message = "权限不足，只有执业药师可以提交复核"
			return result
		}
		if order.Status != models.StatusProcessing {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("状态不允许: 当前%s，不允许批量提交复核", order.Status))
			tx.Commit()
			result.Message = "状态不允许提交复核"
			return result
		}
		if order.CurrentHandler != user.ID {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("越权: 处理人%s，操作人%s", order.CurrentHandler, user.ID))
			tx.Commit()
			result.Message = "不是当前处理人，越权操作"
			return result
		}
		missing := getMissingEvidencesTx(tx, orderID)
		if len(missing) > 0 {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("缺少证据: %v", missing))
			tx.Commit()
			result.Message = "缺少必要证据材料"
			return result
		}
		newStatus = models.StatusProcessing
		actionName = "批量提交复核"
		newHandler = "manager01"

	case "review_approve":
		if user.Role != models.RoleAreaManager {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("角色越权: %s尝试批量复核，只有区域经理可以复核", user.Role))
			tx.Commit()
			result.Message = "权限不足，只有区域经理可以复核"
			return result
		}
		if order.Status != models.StatusProcessing {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("状态不允许: 当前%s，不允许批量复核", order.Status))
			tx.Commit()
			result.Message = "状态不允许复核"
			return result
		}
		if order.CurrentHandler != user.ID {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("越权: 处理人%s，操作人%s", order.CurrentHandler, user.ID))
			tx.Commit()
			result.Message = "不是当前处理人，越权操作"
			return result
		}
		missing := getMissingEvidencesTx(tx, orderID)
		if len(missing) > 0 {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("缺少证据: %v", missing))
			tx.Commit()
			result.Message = "缺少必要证据材料"
			return result
		}
		newStatus = models.StatusClosed
		actionName = "批量复核通过"
		newHandler = ""

	case "review_reject":
		if user.Role != models.RoleAreaManager {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("角色越权: %s尝试批量退回，只有区域经理可以退回", user.Role))
			tx.Commit()
			result.Message = "权限不足，只有区域经理可以退回"
			return result
		}
		if order.Status != models.StatusProcessing {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("状态不允许: 当前%s，不允许批量退回", order.Status))
			tx.Commit()
			result.Message = "状态不允许退回"
			return result
		}
		if order.CurrentHandler != user.ID {
			recordInterception(tx, orderID, user, action, fmt.Sprintf("越权: 处理人%s，操作人%s", order.CurrentHandler, user.ID))
			tx.Commit()
			result.Message = "不是当前处理人，越权操作"
			return result
		}
		newStatus = models.StatusReturned
		actionName = "批量退回补正"
		newHandler = order.CreatedBy

		rejectReason := exceptionReason
		if rejectReason == "" {
			rejectReason = remark
		}
		if rejectReason == "" {
			rejectReason = "批量退回补正"
		}
		_, err = tx.Exec(`INSERT INTO exception_reasons 
			(id, order_id, reason, exception_type, reported_by, created_at, resolved)
			VALUES (?, ?, ?, ?, ?, ?, 0)`,
			uuid.NewString(), orderID, rejectReason, "batch_reject", user.ID, time.Now(),
		)
		_, err = tx.Exec(`INSERT INTO audit_notes (id, order_id, content, author, created_at)
			VALUES (?, ?, ?, ?, ?)`,
			uuid.NewString(), orderID, fmt.Sprintf("[批量退回补正] %s", rejectReason), user.ID, time.Now(),
		)

	default:
		return models.BatchResult{OrderID: orderID, Success: false, Message: "未知操作"}
	}

	now := time.Now()
	var updateSQL string
	var args []interface{}

	if newStatus == models.StatusClosed {
		updateSQL = `UPDATE near_expiry_orders SET status = ?, current_handler = ?, updated_at = ?, version = version + 1, closed_at = ? WHERE id = ? AND version = ?`
		args = []interface{}{newStatus, newHandler, now, now, orderID, currentVersion}
	} else {
		updateSQL = `UPDATE near_expiry_orders SET status = ?, current_handler = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`
		args = []interface{}{newStatus, newHandler, now, orderID, currentVersion}
	}

	updateResult, err := tx.Exec(updateSQL, args...)
	if err != nil {
		recordInterception(tx, orderID, user, action, "更新失败: "+err.Error())
		tx.Commit()
		result.Message = "更新失败"
		return result
	}

	rowsAffected, _ := updateResult.RowsAffected()
	if rowsAffected == 0 {
		recordInterception(tx, orderID, user, action, "状态已变更，更新时版本冲突")
		tx.Commit()
		result.Message = "状态冲突，请刷新后重试"
		return result
	}

	_, err = tx.Exec(`INSERT INTO processing_records
		(id, order_id, action, from_status, to_status, operator, operator_role, remark, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), orderID, actionName, order.Status, newStatus,
		user.ID, user.Role, remark, now,
	)
	if err != nil {
		result.Message = "记录日志失败"
		return result
	}

	if err = tx.Commit(); err != nil {
		result.Message = "提交失败"
		return result
	}

	result.Success = true
	result.Message = actionName + "成功"
	result.NewVersion = currentVersion + 1
	return result
}
