package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
	"trademark-system/internal/database"
	"trademark-system/internal/models"
)

type BatchHandler struct {
	db *sql.DB
}

func NewBatchHandler(db *sql.DB) *BatchHandler {
	return &BatchHandler{db: db}
}

func (h *BatchHandler) Process(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUserFromContext(r)

	var req models.BatchProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	if len(req.IDs) == 0 {
		respondError(w, http.StatusBadRequest, "请选择要处理的申请单")
		return
	}

	if req.Action == "" {
		respondError(w, http.StatusBadRequest, "请指定处理动作")
		return
	}

	results := []models.BatchResultItem{}
	successCount := 0
	failedCount := 0

	for _, id := range req.IDs {
		result := models.BatchResultItem{ID: id}

		var currentStatus, currentHandler string
		var version int
		var materialComplete, evidenceComplete bool
		err := h.db.QueryRow(`
			SELECT status, current_handler, version, material_complete, evidence_complete
			FROM trademark_applications WHERE id = ?
		`, id).Scan(&currentStatus, &currentHandler, &version, &materialComplete, &evidenceComplete)

		if err != nil {
			result.Success = false
			result.Message = "申请单不存在"
			failedCount++
			results = append(results, result)
			continue
		}

		if currentHandler != string(user.Role) {
			result.Success = false
			result.Message = "不是当前处理人，无权操作"
			failedCount++
			results = append(results, result)
			continue
		}

		actionAllowed := false
		var newStatus, newHandler, moduleType string
		var nodeDueDate time.Time

		switch req.Action {
		case "assign":
			if user.Role != models.RoleRegistrar {
				result.Success = false
				result.Message = "只有商标申请登记员可以分派"
				failedCount++
				results = append(results, result)
				continue
			}
			if currentStatus == string(models.StatusPendingAssign) ||
				currentStatus == string(models.StatusCorrection) ||
				currentStatus == string(models.StatusReturned) {
				if currentStatus == string(models.StatusReturned) && !materialComplete {
					result.Success = false
					result.Message = "退回重新提交需要商标申请材料完整"
					failedCount++
					results = append(results, result)
					continue
				}
				actionAllowed = true
				newStatus = string(models.StatusTransferred)
				newHandler = string(models.RoleAgent)
				moduleType = string(models.ModuleApplication)
				nodeDueDate = time.Now().AddDate(0, 0, 10)
			} else {
				result.Success = false
				result.Message = "当前状态不允许分派"
				failedCount++
				results = append(results, result)
				continue
			}

		case "visit":
			if user.Role != models.RoleAgent {
				result.Success = false
				result.Message = "只有商标申请审核主管可以回访"
				failedCount++
				results = append(results, result)
				continue
			}
			if currentStatus == string(models.StatusTransferred) {
				if !evidenceComplete {
					result.Success = false
					result.Message = "递交通知需要证据完整，请先上传证据"
					failedCount++
					results = append(results, result)
					continue
				}
				actionAllowed = true
				newStatus = string(models.StatusVisited)
				newHandler = string(models.RoleDirector)
				moduleType = string(models.ModuleNotification)
				nodeDueDate = time.Now().AddDate(0, 0, 5)
			} else {
				result.Success = false
				result.Message = "当前状态不允许回访"
				failedCount++
				results = append(results, result)
				continue
			}

		case "review":
			if user.Role != models.RoleDirector {
				result.Success = false
				result.Message = "只有知识产权代理所复核负责人可以复核"
				failedCount++
				results = append(results, result)
				continue
			}
			if currentStatus == string(models.StatusVisited) {
				if !materialComplete || !evidenceComplete {
					result.Success = false
					result.Message = "材料或证据不完整，无法归档"
					failedCount++
					results = append(results, result)
					continue
				}
				actionAllowed = true
				newStatus = string(models.StatusArchived)
				newHandler = ""
				moduleType = string(models.ModuleApplication)
			} else {
				result.Success = false
				result.Message = "当前状态不允许复核"
				failedCount++
				results = append(results, result)
				continue
			}

		case "correct":
			if user.Role != models.RoleRegistrar {
				result.Success = false
				result.Message = "只有商标申请登记员可以补正"
				failedCount++
				results = append(results, result)
				continue
			}
			if currentStatus == string(models.StatusCorrection) || currentStatus == string(models.StatusReturned) {
				actionAllowed = true
				newStatus = string(models.StatusPendingAssign)
				newHandler = string(models.RoleRegistrar)
				moduleType = string(models.ModuleCorrection)
				nodeDueDate = time.Now().AddDate(0, 0, 15)
			} else {
				result.Success = false
				result.Message = "当前状态不允许补正"
				failedCount++
				results = append(results, result)
				continue
			}

		default:
			result.Success = false
			result.Message = "不支持的操作类型"
			failedCount++
			results = append(results, result)
			continue
		}

		if actionAllowed {
			tx, err := h.db.Begin()
			if err != nil {
				result.Success = false
				result.Message = "启动事务失败"
				failedCount++
				results = append(results, result)
				continue
			}

			now := time.Now()
			nodeName, nodeResponsible := getNodeInfo(newStatus)
			opinion := req.Opinion
			if opinion == "" {
				opinion = "批量处理：" + database.GetActionName(req.Action)
			}

			var nodeDueDateStr interface{} = nil
			if req.Action != "review" {
				nodeDueDateStr = nodeDueDate
			}

			_, err = tx.Exec(`
				UPDATE trademark_applications SET
					status = ?, current_handler = ?, updated_at = ?, version = ?,
					last_opinion = ?, last_handler_name = ?, last_handle_time = ?,
					current_node = ?, node_due_date = ?, node_responsible = ?
				WHERE id = ?
			`,
				newStatus, newHandler, now, version+1,
				opinion, user.Name, now,
				nodeName, nodeDueDateStr, nodeResponsible, id,
			)
			if err != nil {
				tx.Rollback()
				result.Success = false
				result.Message = "更新状态失败"
				failedCount++
				results = append(results, result)
				continue
			}

			recordID := generateID()
			_, err = tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID, id, req.Action, currentStatus, newStatus,
				user.ID, opinion, now, moduleType,
			)
			if err != nil {
				tx.Rollback()
				result.Success = false
				result.Message = "创建处理记录失败"
				failedCount++
				results = append(results, result)
				continue
			}

			if req.Action == "review" || req.Action == "correct" {
				_, err = tx.Exec(`
					UPDATE exception_reasons SET resolved = 1, resolved_at = ?
					WHERE application_id = ? AND resolved = 0
				`, now, id)
				if err != nil {
					tx.Rollback()
					result.Success = false
					result.Message = "更新异常状态失败"
					failedCount++
					results = append(results, result)
					continue
				}
			}

			if req.Action == "correct" {
				excID := generateID()
				_, err = tx.Exec(`
					INSERT INTO exception_reasons (
						id, application_id, reason, reason_type, created_by,
						created_at, module_type, resolved
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`,
					excID, id, "批量补正处理", "batch_correction", user.ID,
					now, moduleType, true,
				)
				if err != nil {
					tx.Rollback()
					result.Success = false
					result.Message = "创建异常记录失败"
					failedCount++
					results = append(results, result)
					continue
				}
			}

			if err := tx.Commit(); err != nil {
				result.Success = false
				result.Message = "提交事务失败"
				failedCount++
				results = append(results, result)
				continue
			}

			if req.Action != "review" {
				updateWarningStatus(h.db, id, nodeDueDate.Format("2006-01-02 15:04:05"))
			}

			result.Success = true
			result.Message = "处理成功"
			successCount++
		}

		results = append(results, result)
	}

	respondSuccess(w, models.BatchProcessResponse{
		Total:   len(req.IDs),
		Success: successCount,
		Failed:  failedCount,
		Results: results,
	})
}

func (h *BatchHandler) AdvanceOverdue(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUserFromContext(r)

	if user.Role != models.RoleRegistrar {
		respondError(w, http.StatusForbidden, "只有商标申请登记员可以批量推进逾期申请")
		return
	}

	var req struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "参数错误")
		return
	}

	if len(req.IDs) == 0 {
		respondError(w, http.StatusBadRequest, "请选择要推进的申请单")
		return
	}

	results := []models.BatchResultItem{}
	successCount := 0
	failedCount := 0

	for _, id := range req.IDs {
		result := models.BatchResultItem{ID: id}

		var currentStatus, currentHandler, applicationNo string
		var version int
		var warningStatus string
		var nodeOverdue int
		var materialComplete, evidenceComplete bool
		err := h.db.QueryRow(`
			SELECT status, current_handler, version, warning_status, node_overdue,
				material_complete, evidence_complete, application_no
			FROM trademark_applications WHERE id = ?
		`, id).Scan(&currentStatus, &currentHandler, &version, &warningStatus, &nodeOverdue,
			&materialComplete, &evidenceComplete, &applicationNo)

		if err != nil {
			result.Success = false
			result.Message = "申请单不存在"
			failedCount++
			results = append(results, result)
			continue
		}

		if currentHandler != string(user.Role) {
			result.Success = false
			result.Message = "不是当前处理人，无权操作"
			failedCount++
			results = append(results, result)
			continue
		}

		if warningStatus != "overdue" && nodeOverdue != 1 {
			result.Success = false
			result.Message = "申请单未逾期，无需推进"
			failedCount++
			results = append(results, result)
			continue
		}

		if !materialComplete {
			result.Success = false
			result.Message = "材料不完整，请先补正材料"
			failedCount++
			results = append(results, result)

			tx, _ := h.db.Begin()
			now := time.Now()
			excID := generateID()
			tx.Exec(`
				INSERT INTO exception_reasons (
					id, application_id, reason, reason_type, created_by,
					created_at, module_type, resolved
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`,
				excID, id, "批量推进拦截：材料不完整", "material_missing", user.ID,
				now, string(models.ModuleCorrection), false,
			)
			recordID := generateID()
			tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID, id, "correct_attempt", currentStatus, currentStatus,
				user.ID, "批量推进被拦截：材料不完整，需要补正", now, string(models.ModuleCorrection),
			)
			tx.Commit()
			continue
		}

		if currentStatus != string(models.StatusPendingAssign) {
			result.Success = false
			result.Message = "当前状态不允许推进，应先完成补正"
			failedCount++
			results = append(results, result)

			tx, _ := h.db.Begin()
			now := time.Now()
			excID := generateID()
			tx.Exec(`
				INSERT INTO exception_reasons (
					id, application_id, reason, reason_type, created_by,
					created_at, module_type, resolved
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`,
				excID, id, "批量推进拦截：状态不正确", "status_conflict", user.ID,
				now, string(models.ModuleApplication), false,
			)
			recordID := generateID()
			tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID, id, "advance_attempt", currentStatus, currentStatus,
				user.ID, "批量推进被拦截：状态冲突，需要先处理当前状态", now, string(models.ModuleApplication),
			)
			tx.Commit()
			continue
		}

		newStatus := string(models.StatusTransferred)
		newHandler := string(models.RoleAgent)
		nodeName, nodeResponsible := getNodeInfo(newStatus)
		now := time.Now()
		nodeDueDate := now.AddDate(0, 0, 10)

		tx, err := h.db.Begin()
		if err != nil {
			result.Success = false
			result.Message = "启动事务失败"
			failedCount++
			results = append(results, result)
			continue
		}

		opinion := "逾期批量推进：已完成补正，分派代理人处理"

		_, err = tx.Exec(`
			UPDATE trademark_applications SET
				status = ?, current_handler = ?, updated_at = ?, version = ?,
				last_opinion = ?, last_handler_name = ?, last_handle_time = ?,
				current_node = ?, node_due_date = ?, node_responsible = ?,
				material_complete = ?
			WHERE id = ?
		`,
			newStatus, newHandler, now, version+1,
			opinion, user.Name, now,
			nodeName, nodeDueDate, nodeResponsible,
			true, id,
		)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Message = "更新状态失败"
			failedCount++
			results = append(results, result)
			continue
		}

		recordID := generateID()
		_, err = tx.Exec(`
			INSERT INTO processing_records (
				id, application_id, action, old_status, new_status,
				handler, opinion, created_at, module_type
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			recordID, id, "assign", currentStatus, newStatus,
			user.ID, opinion, now, string(models.ModuleApplication),
		)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Message = "创建处理记录失败"
			failedCount++
			results = append(results, result)
			continue
		}

		excID := generateID()
		_, err = tx.Exec(`
			INSERT INTO exception_reasons (
				id, application_id, reason, reason_type, created_by,
				created_at, module_type, resolved
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`,
			excID, id, "逾期批量推进处理", "overdue_advance", user.ID,
			now, string(models.ModuleApplication), true,
		)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Message = "创建异常记录失败"
			failedCount++
			results = append(results, result)
			continue
		}

		_, err = tx.Exec(`
			UPDATE exception_reasons SET resolved = 1, resolved_at = ?
			WHERE application_id = ? AND resolved = 0
		`, now, id)
		if err != nil {
			tx.Rollback()
			result.Success = false
			result.Message = "更新异常状态失败"
			failedCount++
			results = append(results, result)
			continue
		}

		if err := tx.Commit(); err != nil {
			result.Success = false
			result.Message = "提交事务失败"
			failedCount++
			results = append(results, result)
			continue
		}

		updateWarningStatus(h.db, id, nodeDueDate.Format("2006-01-02 15:04:05"))

		result.Success = true
		result.Message = "已成功分派，逾期处理完成"
		successCount++
		results = append(results, result)
	}

	respondSuccess(w, models.BatchProcessResponse{
		Total:   len(req.IDs),
		Success: successCount,
		Failed:  failedCount,
		Results: results,
	})
}
