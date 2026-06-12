package database

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"
	"trademark-system/internal/models"
)

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func SeedInitialData(db *sql.DB) error {
	var count int
	db.QueryRow("SELECT COUNT(*) FROM trademark_applications").Scan(&count)
	if count > 0 {
		return nil
	}

	now := time.Now()
	future := now.AddDate(0, 0, 15)
	past := now.AddDate(0, 0, -5)
	soon := now.AddDate(0, 0, 2)

	apps := []struct {
		id               string
		applicationNo    string
		trademarkName    string
		applicantName    string
		applicantContact string
		category         string
		status           models.ApplicationStatus
		currentHandler   string
		createdBy        string
		dueDate          time.Time
		materialComplete bool
		evidenceComplete bool
		warningStatus    models.WarningStatus
		currentNode      string
		nodeDueDate      *time.Time
		nodeOverdue      bool
		nodeResponsible  string
		lastOpinion      string
		lastHandlerName  string
	}{
		{
			id:               generateID(),
			applicationNo:    "TM2026000001",
			trademarkName:    "智能云",
			applicantName:    "北京科技创新有限公司",
			applicantContact: "13800138001",
			category:         "第42类-技术服务",
			status:           models.StatusPendingAssign,
			currentHandler:   "registrar",
			createdBy:        "registrar",
			dueDate:          future,
			materialComplete: true,
			evidenceComplete: true,
			warningStatus:    models.WarningNormal,
			currentNode:      "待分派",
			nodeDueDate:      &future,
			nodeOverdue:      false,
			nodeResponsible:  "商标申请登记员",
		},
		{
			id:               generateID(),
			applicationNo:    "TM2026000002",
			trademarkName:    "绿源优品",
			applicantName:    "上海绿色农业发展公司",
			applicantContact: "13800138002",
			category:         "第31类-饲料种籽",
			status:           models.StatusPendingAssign,
			currentHandler:   "registrar",
			createdBy:        "registrar",
			dueDate:          future,
			materialComplete: false,
			evidenceComplete: true,
			warningStatus:    models.WarningNormal,
			currentNode:      "待分派",
			nodeDueDate:      &future,
			nodeOverdue:      false,
			nodeResponsible:  "商标申请登记员",
			lastOpinion:      "材料不完整，缺少委托书",
			lastHandlerName:  "系统",
		},
		{
			id:               generateID(),
			applicationNo:    "TM2026000003",
			trademarkName:    "速达物流",
			applicantName:    "广州速运集团股份有限公司",
			applicantContact: "13800138003",
			category:         "第39类-运输贮藏",
			status:           models.StatusTransferred,
			currentHandler:   "agent",
			createdBy:        "registrar",
			dueDate:          soon,
			materialComplete: true,
			evidenceComplete: true,
			warningStatus:    models.WarningApproaching,
			currentNode:      "已转办",
			nodeDueDate:      &soon,
			nodeOverdue:      false,
			nodeResponsible:  "商标申请审核主管",
			lastOpinion:      "材料齐全，已转办代理人处理",
			lastHandlerName:  "商标申请登记员",
		},
		{
			id:               generateID(),
			applicationNo:    "TM2026000004",
			trademarkName:    "悦动健身",
			applicantName:    "深圳健康生活科技有限公司",
			applicantContact: "13800138004",
			category:         "第41类-教育娱乐",
			status:           models.StatusTransferred,
			currentHandler:   "agent",
			createdBy:        "registrar",
			dueDate:          past,
			materialComplete: true,
			evidenceComplete: false,
			warningStatus:    models.WarningOverdue,
			currentNode:      "已转办",
			nodeDueDate:      &past,
			nodeOverdue:      true,
			nodeResponsible:  "商标申请审核主管",
			lastOpinion:      "已转办，请及时处理并提交证据",
			lastHandlerName:  "商标申请登记员",
		},
		{
			id:               generateID(),
			applicationNo:    "TM2026000005",
			trademarkName:    "味享天下",
			applicantName:    "成都美食餐饮管理公司",
			applicantContact: "13800138005",
			category:         "第43类-餐饮住宿",
			status:           models.StatusCorrection,
			currentHandler:   "registrar",
			createdBy:        "registrar",
			dueDate:          future,
			materialComplete: false,
			evidenceComplete: true,
			warningStatus:    models.WarningNormal,
			currentNode:      "待补正",
			nodeDueDate:      &future,
			nodeOverdue:      false,
			nodeResponsible:  "商标申请登记员",
			lastOpinion:      "缺少商标图样和申请人身份证明，请补正",
			lastHandlerName:  "商标申请审核主管",
		},
		{
			id:               generateID(),
			applicationNo:    "TM2026000006",
			trademarkName:    "智联教育",
			applicantName:    "杭州在线教育科技有限公司",
			applicantContact: "13800138006",
			category:         "第9类-科学仪器",
			status:           models.StatusVisited,
			currentHandler:   "director",
			createdBy:        "registrar",
			dueDate:          future,
			materialComplete: true,
			evidenceComplete: true,
			warningStatus:    models.WarningNormal,
			currentNode:      "已回访",
			nodeDueDate:      &future,
			nodeOverdue:      false,
			nodeResponsible:  "知识产权代理所复核负责人",
			lastOpinion:      "已完成回访，材料齐全，请复核归档",
			lastHandlerName:  "商标申请审核主管",
		},
		{
			id:               generateID(),
			applicationNo:    "TM2026000007",
			trademarkName:    "金盾安防",
			applicantName:    "南京安保设备制造有限公司",
			applicantContact: "13800138007",
			category:         "第6类-金属材料",
			status:           models.StatusArchived,
			currentHandler:   "",
			createdBy:        "registrar",
			dueDate:          past,
			materialComplete: true,
			evidenceComplete: true,
			warningStatus:    models.WarningNormal,
			currentNode:      "已归档",
			nodeOverdue:      false,
			nodeResponsible:  "",
			lastOpinion:      "已完成复核归档",
			lastHandlerName:  "知识产权代理所复核负责人",
		},
		{
			id:               generateID(),
			applicationNo:    "TM2026000008",
			trademarkName:    "星空旅行",
			applicantName:    "三亚国际旅行社有限公司",
			applicantContact: "13800138008",
			category:         "第39类-运输贮藏",
			status:           models.StatusReturned,
			currentHandler:   "registrar",
			createdBy:        "registrar",
			dueDate:          future,
			materialComplete: false,
			evidenceComplete: false,
			warningStatus:    models.WarningApproaching,
			currentNode:      "已退回",
			nodeDueDate:      &soon,
			nodeOverdue:      false,
			nodeResponsible:  "商标申请登记员",
			lastOpinion:      "材料不完整且缺少证据，已退回重新提交",
			lastHandlerName:  "商标申请审核主管",
		},
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, app := range apps {
		var nodeDueDateVal interface{}
		if app.nodeDueDate != nil {
			nodeDueDateVal = app.nodeDueDate.Format("2006-01-02 15:04:05")
		} else {
			nodeDueDateVal = nil
		}

		_, err := tx.Exec(`
			INSERT INTO trademark_applications (
				id, application_no, trademark_name, applicant_name, applicant_contact,
				category, status, current_handler, created_by, created_at, updated_at,
				due_date, warning_status, warning_text, last_opinion, last_handler_name, version,
				material_complete, evidence_complete, current_node, node_due_date,
				node_overdue, node_responsible
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			app.id, app.applicationNo, app.trademarkName, app.applicantName, app.applicantContact,
			app.category, string(app.status), app.currentHandler, app.createdBy, now, now,
			app.dueDate, string(app.warningStatus), "", app.lastOpinion, app.lastHandlerName, 1,
			app.materialComplete, app.evidenceComplete, app.currentNode, nodeDueDateVal,
			app.nodeOverdue, app.nodeResponsible,
		)
		if err != nil {
			return err
		}

		recordID := generateID()
		_, err = tx.Exec(`
			INSERT INTO processing_records (
				id, application_id, action, old_status, new_status,
				handler, opinion, created_at, module_type
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			recordID, app.id, "create", "", string(models.StatusPendingAssign),
			app.createdBy, "创建商标申请单", now, string(models.ModuleApplication),
		)
		if err != nil {
			return err
		}

		if app.status == models.StatusTransferred {
			recordID2 := generateID()
			_, err = tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID2, app.id, "assign", string(models.StatusPendingAssign), string(models.StatusTransferred),
				"registrar", app.lastOpinion, now.Add(time.Hour), string(models.ModuleApplication),
			)
			if err != nil {
				return err
			}
		}

		if app.status == models.StatusVisited {
			recordID2 := generateID()
			_, err = tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID2, app.id, "assign", string(models.StatusPendingAssign), string(models.StatusTransferred),
				"registrar", "材料齐全，分派代理人", now.Add(time.Hour), string(models.ModuleApplication),
			)
			if err != nil {
				return err
			}
			recordID3 := generateID()
			_, err = tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID3, app.id, "visit", string(models.StatusTransferred), string(models.StatusVisited),
				"agent", app.lastOpinion, now.Add(time.Hour*2), string(models.ModuleNotification),
			)
			if err != nil {
				return err
			}
		}

		if app.status == models.StatusCorrection {
			recordID2 := generateID()
			_, err = tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID2, app.id, "assign", string(models.StatusPendingAssign), string(models.StatusTransferred),
				"registrar", "初步审核后转办", now.Add(time.Hour), string(models.ModuleApplication),
			)
			if err != nil {
				return err
			}
			recordID3 := generateID()
			_, err = tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID3, app.id, "return", string(models.StatusTransferred), string(models.StatusCorrection),
				"agent", app.lastOpinion, now.Add(time.Hour*2), string(models.ModuleCorrection),
			)
			if err != nil {
				return err
			}

			excID := generateID()
			_, err = tx.Exec(`
				INSERT INTO exception_reasons (
					id, application_id, reason, reason_type, created_by,
					created_at, module_type, resolved
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`,
				excID, app.id, "缺少商标图样和申请人身份证明", "material_missing", "agent",
				now.Add(time.Hour*2), string(models.ModuleCorrection), false,
			)
			if err != nil {
				return err
			}
		}

		if app.status == models.StatusReturned {
			recordID2 := generateID()
			_, err = tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID2, app.id, "assign", string(models.StatusPendingAssign), string(models.StatusTransferred),
				"registrar", "分派处理", now.Add(time.Hour), string(models.ModuleApplication),
			)
			if err != nil {
				return err
			}
			recordID3 := generateID()
			_, err = tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID3, app.id, "return", string(models.StatusTransferred), string(models.StatusReturned),
				"agent", app.lastOpinion, now.Add(time.Hour*2), string(models.ModuleApplication),
			)
			if err != nil {
				return err
			}

			excID := generateID()
			_, err = tx.Exec(`
				INSERT INTO exception_reasons (
					id, application_id, reason, reason_type, created_by,
					created_at, module_type, resolved
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`,
				excID, app.id, "材料不完整且缺少递交通知证据", "evidence_missing", "agent",
				now.Add(time.Hour*2), string(models.ModuleNotification), false,
			)
			if err != nil {
				return err
			}
		}

		if app.status == models.StatusArchived {
			recordID2 := generateID()
			_, err = tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID2, app.id, "assign", string(models.StatusPendingAssign), string(models.StatusTransferred),
				"registrar", "材料齐全，分派代理人", now.Add(-time.Hour*24*3), string(models.ModuleApplication),
			)
			if err != nil {
				return err
			}
			recordID3 := generateID()
			_, err = tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID3, app.id, "visit", string(models.StatusTransferred), string(models.StatusVisited),
				"agent", "已完成回访，提交复核", now.Add(-time.Hour*24*2), string(models.ModuleNotification),
			)
			if err != nil {
				return err
			}
			recordID4 := generateID()
			_, err = tx.Exec(`
				INSERT INTO processing_records (
					id, application_id, action, old_status, new_status,
					handler, opinion, created_at, module_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				recordID4, app.id, "review", string(models.StatusVisited), string(models.StatusArchived),
				"director", "已完成复核归档", now.Add(-time.Hour*24), string(models.ModuleApplication),
			)
			if err != nil {
				return err
			}
		}

		if app.materialComplete {
			attachID := generateID()
			_, err = tx.Exec(`
				INSERT INTO attachments (
					id, application_id, file_name, file_type, file_size,
					module_type, uploaded_by, uploaded_at, evidence_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				attachID, app.id, "商标申请书.pdf", "application/pdf", 1024000,
				string(models.ModuleApplication), app.createdBy, now, "application_form",
			)
			if err != nil {
				return err
			}

			attachID2 := generateID()
			_, err = tx.Exec(`
				INSERT INTO attachments (
					id, application_id, file_name, file_type, file_size,
					module_type, uploaded_by, uploaded_at, evidence_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				attachID2, app.id, "商标图样.png", "image/png", 512000,
				string(models.ModuleApplication), app.createdBy, now, "trademark_image",
			)
			if err != nil {
				return err
			}
		}

		if app.evidenceComplete && app.status != models.StatusPendingAssign {
			attachID := generateID()
			_, err = tx.Exec(`
				INSERT INTO attachments (
					id, application_id, file_name, file_type, file_size,
					module_type, uploaded_by, uploaded_at, evidence_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				attachID, app.id, "递交通知回执.pdf", "application/pdf", 2048000,
				string(models.ModuleNotification), "agent", now.Add(time.Hour*2), "notification_evidence",
			)
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func GetStatusName(status string) string {
	names := map[string]string{
		"pending_assign": "待分派",
		"transferred":    "已转办",
		"visited":        "已回访",
		"correction":     "待补正",
		"returned":       "已退回",
		"archived":       "已归档",
	}
	if name, ok := names[status]; ok {
		return name
	}
	return status
}

func GetWarningName(status string) string {
	names := map[string]string{
		"normal":      "正常",
		"approaching": "临期",
		"overdue":     "逾期",
	}
	if name, ok := names[status]; ok {
		return name
	}
	return status
}

func GetRoleName(role string) string {
	names := map[string]string{
		"registrar": "商标申请登记员",
		"agent":     "商标申请审核主管",
		"director":  "知识产权代理所复核负责人",
	}
	if name, ok := names[role]; ok {
		return name
	}
	return role
}

func GetActionName(action string) string {
	names := map[string]string{
		"create":          "创建申请",
		"assign":          "分派",
		"transfer":        "转办",
		"visit":           "回访",
		"correct":         "补正",
		"return":          "退回",
		"review":          "复核",
		"archive":         "归档",
		"upload_evidence": "上传证据",
	}
	if name, ok := names[action]; ok {
		return name
	}
	return action
}

func GetModuleName(module string) string {
	names := map[string]string{
		"application":  "商标申请",
		"correction":   "材料补正",
		"notification": "递交通知",
	}
	if name, ok := names[module]; ok {
		return name
	}
	return module
}

func CalculateWarning(dueDate time.Time) (string, string) {
	now := time.Now()
	diff := dueDate.Sub(now)
	days := int(diff.Hours() / 24)

	if days < 0 {
		return "overdue", fmt.Sprintf("已逾期%d天", -days)
	} else if days <= 3 {
		return "approaching", fmt.Sprintf("剩余%d天到期", days)
	}
	return "normal", fmt.Sprintf("剩余%d天到期", days)
}
