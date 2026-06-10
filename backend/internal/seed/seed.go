package seed

import (
	"crypto/sha256"
	"database/sql"
	"fmt"
	"time"

	"aviation-ground-service/internal/models"
)

func HashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return fmt.Sprintf("%x", h)
}

func SeedDemoData(db *sql.DB) error {
	var count int
	db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count > 0 {
		return nil
	}

	now := time.Now()
	nowStr := now.Format("2006-01-02 15:04:05")

	users := []struct {
		Username string
		Password string
		Role     models.UserRole
		Name     string
	}{
		{"zhiJiYuan", "123456", models.RoleCheckinAgent, "张值机"},
		{"xingLiZhuGuan", "123456", models.RoleBaggageSupervisor, "李行李"},
		{"zhanDianJingLi", "123456", models.RoleStationManager, "王站长"},
	}

	userIDs := make(map[string]int64)
	for _, u := range users {
		result, err := db.Exec(
			"INSERT INTO users (username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?)",
			u.Username, HashPassword(u.Password), u.Role, u.Name, nowStr,
		)
		if err != nil {
			return fmt.Errorf("failed to seed user %s: %w", u.Username, err)
		}
		id, _ := result.LastInsertId()
		userIDs[u.Username] = id
	}

	records := []struct {
		FlightNo     string
		Passenger    string
		PassengerID  string
		SeatNo       string
		Status       models.RecordStatus
		HandlerRole  models.UserRole
		Version      int
		DeadlineDays int
		CreatedBy    string
		ReturnReason string
		Scenario     string
	}{
		{"CA1234", "王明", "110101199001011234", "12A", models.StatusDraft, models.RoleCheckinAgent, 1, 5, "zhiJiYuan", "", "场景1：正常流转 - 值机员可直接提交审核"},
		{"CA5678", "李红", "110101199202022345", "08C", models.StatusPendingReview, models.RoleBaggageSupervisor, 2, 4, "zhiJiYuan", "", "场景2：缺材料 - 缺少行李托运证据，无法审核通过"},
		{"CA9012", "赵强", "110101199303033456", "15F", models.StatusApproved, models.RoleStationManager, 3, 3, "zhiJiYuan", "", "场景3：已审核 - 站长可确认同步"},
		{"CA3456", "刘芳", "110101199404044567", "03A", models.StatusReturned, models.RoleCheckinAgent, 2, 2, "zhiJiYuan", "行李信息不完整，请补全重量和件数", "场景4：退回补正 - 值机员需补正后重新提交"},
		{"CA7890", "陈伟", "110101199505055678", "22D", models.StatusPendingReview, models.RoleBaggageSupervisor, 2, -2, "zhiJiYuan", "", "场景5：已逾期 - 截止时间已过，禁止处理"},
		{"CA2345", "孙丽", "110101199606066789", "07B", models.StatusPendingReview, models.RoleBaggageSupervisor, 2, 1, "zhiJiYuan", "", "场景6：临期 - 距离截止时间不足24小时"},
		{"CA6789", "周杰", "110101199707077890", "18E", models.StatusDraft, models.RoleCheckinAgent, 1, 10, "zhiJiYuan", "", "场景7：状态冲突 - 值机员草稿，行李主管不能处理"},
		{"CA4321", "吴敏", "110101199808088901", "11A", models.StatusSynced, models.RoleStationManager, 4, 7, "zhiJiYuan", "", "场景8：已完成 - 已同步，无可用操作"},
		{"CA5566", "郑浩", "110101198709099012", "19C", models.StatusPendingReview, models.RoleBaggageSupervisor, 3, -1, "zhiJiYuan", "", "场景9：版本冲突演示 - 版本v3"},
		{"CA7788", "钱雪", "110101198810100123", "05D", models.StatusPendingReview, models.RoleBaggageSupervisor, 2, 2, "zhiJiYuan", "", "场景10：正常待审核 - 证据齐全可通过"},
	}

	recordIDs := make([]int64, len(records))
	for i, r := range records {
		checkinTime := now.Add(-time.Duration(24-i) * time.Hour).Format("2006-01-02 15:04:05")
		deadline := now.Add(time.Duration(r.DeadlineDays) * 24 * time.Hour).Format("2006-01-02 15:04:05")
		createdAt := now.Add(-time.Duration(24-i) * time.Hour).Format("2006-01-02 15:04:05")
		updatedAt := createdAt

		result, err := db.Exec(
			"INSERT INTO checkin_records (flight_no, passenger_name, passenger_id, seat_no, checkin_time, status, version, deadline, created_by, current_handler_role, return_reason, scenario, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			r.FlightNo, r.Passenger, r.PassengerID, r.SeatNo, checkinTime,
			r.Status, r.Version, deadline, userIDs[r.CreatedBy], r.HandlerRole, r.ReturnReason, r.Scenario, createdAt, updatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to seed record %s: %w", r.FlightNo, err)
		}
		recordIDs[i], _ = result.LastInsertId()
	}

	attachments := []struct {
		RecordIdx  int
		Type       models.AttachmentType
		FileName   string
		UploadedBy string
	}{
		{0, models.AttachCheckinEvidence, "checkin_ca1234_wangming.jpg", "zhiJiYuan"},
		{1, models.AttachCheckinEvidence, "checkin_ca5678_lihong.jpg", "zhiJiYuan"},
		{2, models.AttachCheckinEvidence, "checkin_ca9012_zhaoqiang.jpg", "zhiJiYuan"},
		{2, models.AttachBaggageEvidence, "baggage_ca9012_zhaoqiang.jpg", "xingLiZhuGuan"},
		{2, models.AttachExceptionEvidence, "exception_ca9012_zhaoqiang.jpg", "xingLiZhuGuan"},
		{3, models.AttachCheckinEvidence, "checkin_ca3456_liufang.jpg", "zhiJiYuan"},
		{4, models.AttachCheckinEvidence, "checkin_ca7890_chenwei.jpg", "zhiJiYuan"},
		{4, models.AttachBaggageEvidence, "baggage_ca7890_chenwei.jpg", "xingLiZhuGuan"},
		{5, models.AttachCheckinEvidence, "checkin_ca2345_sunli.jpg", "zhiJiYuan"},
		{6, models.AttachCheckinEvidence, "checkin_ca6789_zhoujie.jpg", "zhiJiYuan"},
		{8, models.AttachCheckinEvidence, "checkin_ca5566_zhenghao.jpg", "zhiJiYuan"},
		{8, models.AttachBaggageEvidence, "baggage_ca5566_zhenghao.jpg", "xingLiZhuGuan"},
		{9, models.AttachCheckinEvidence, "checkin_ca7788_qianxue.jpg", "zhiJiYuan"},
		{9, models.AttachBaggageEvidence, "baggage_ca7788_qianxue.jpg", "xingLiZhuGuan"},
	}

	for _, a := range attachments {
		recordID := recordIDs[a.RecordIdx]
		filePath := fmt.Sprintf("/uploads/%d/%s", recordID, a.FileName)
		_, err := db.Exec(
			"INSERT INTO attachments (record_id, type, file_name, file_path, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			recordID, a.Type, a.FileName, filePath, userIDs[a.UploadedBy], nowStr,
		)
		if err != nil {
			return fmt.Errorf("failed to seed attachment: %w", err)
		}
	}

	processingRecords := []struct {
		RecordIdx           int
		Handler             string
		HandlerRole         models.UserRole
		Action              models.ProcessAction
		Comment             string
		FromStatus          models.RecordStatus
		ToStatus            models.RecordStatus
		VersionBefore       int
		VersionAfter        int
		PreviousHandlerRole models.UserRole
		NextHandlerRole     models.UserRole
		BlockReason         string
		BlockType           string
		Success             bool
	}{
		// 记录 #1 (CA1234 王明)：场景1 - 正常流转，草稿→待审核
		{0, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核",
			models.StatusDraft, models.StatusPendingReview, 1, 2,
			models.RoleCheckinAgent, models.RoleBaggageSupervisor, "", "", true},

		// 记录 #2 (CA5678 李红)：场景2 - 正常流转，草稿→待审核
		{1, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核",
			models.StatusDraft, models.StatusPendingReview, 1, 2,
			models.RoleCheckinAgent, models.RoleBaggageSupervisor, "", "", true},

		// 记录 #3 (CA9012 赵强)：场景3 - 正常流转完整链路：草稿→待审核→审核通过
		{2, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核",
			models.StatusDraft, models.StatusPendingReview, 1, 2,
			models.RoleCheckinAgent, models.RoleBaggageSupervisor, "", "", true},
		{2, "xingLiZhuGuan", models.RoleBaggageSupervisor, models.ActionApprove, "审核通过，行李信息完整",
			models.StatusPendingReview, models.StatusApproved, 2, 3,
			models.RoleBaggageSupervisor, models.RoleStationManager, "", "", true},

		// 记录 #4 (CA3456 刘芳)：场景4 - 退回补正链路：草稿→待审核→退回
		{3, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核",
			models.StatusDraft, models.StatusPendingReview, 1, 2,
			models.RoleCheckinAgent, models.RoleBaggageSupervisor, "", "", true},
		{3, "xingLiZhuGuan", models.RoleBaggageSupervisor, models.ActionReturn, "行李信息不完整，请补全重量和件数",
			models.StatusPendingReview, models.StatusReturned, 2, 3,
			models.RoleBaggageSupervisor, models.RoleCheckinAgent, "", "", true},

		// 记录 #5 (CA7890 陈伟)：场景5 - 逾期拦截演示：尝试审核通过但被拦截
		{4, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核",
			models.StatusDraft, models.StatusPendingReview, 1, 2,
			models.RoleCheckinAgent, models.RoleBaggageSupervisor, "", "", true},
		{4, "xingLiZhuGuan", models.RoleBaggageSupervisor, models.ActionApprove, "尝试审核通过",
			models.StatusPendingReview, models.StatusPendingReview, 2, 2,
			models.RoleBaggageSupervisor, models.RoleBaggageSupervisor,
			"已逾期：该记录的处理责任人是行李主管，截止时间已过，禁止审核通过操作", "deadline", false},

		// 记录 #6 (CA2345 孙丽)：场景6 - 临期状态
		{5, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核",
			models.StatusDraft, models.StatusPendingReview, 1, 2,
			models.RoleCheckinAgent, models.RoleBaggageSupervisor, "", "", true},

		// 记录 #9 (CA5566 郑浩)：场景9 - 版本冲突演示：用旧版本提交被拦截
		{8, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核",
			models.StatusDraft, models.StatusPendingReview, 1, 2,
			models.RoleCheckinAgent, models.RoleBaggageSupervisor, "", "", true},
		{8, "xingLiZhuGuan", models.RoleBaggageSupervisor, models.ActionApprove, "尝试用旧版本审核",
			models.StatusPendingReview, models.StatusPendingReview, 2, 2,
			models.RoleBaggageSupervisor, models.RoleBaggageSupervisor,
			"版本冲突：当前版本 v3，您提交的是 v2，请刷新后重试", "version", false},

		// 记录 #10 (CA7788 钱雪)：场景10 - 正常待审核，状态流转：草稿→待审核
		{9, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核",
			models.StatusDraft, models.StatusPendingReview, 1, 2,
			models.RoleCheckinAgent, models.RoleBaggageSupervisor, "", "", true},

		// 记录 #8 (CA4321 吴敏)：场景8 - 完整流转链路：草稿→待审核→审核通过→已同步
		{7, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核",
			models.StatusDraft, models.StatusPendingReview, 1, 2,
			models.RoleCheckinAgent, models.RoleBaggageSupervisor, "", "", true},
		{7, "xingLiZhuGuan", models.RoleBaggageSupervisor, models.ActionApprove, "审核通过",
			models.StatusPendingReview, models.StatusApproved, 2, 3,
			models.RoleBaggageSupervisor, models.RoleStationManager, "", "", true},
		{7, "zhanDianJingLi", models.RoleStationManager, models.ActionConfirmSync, "确认同步完成",
			models.StatusApproved, models.StatusSynced, 3, 4,
			models.RoleStationManager, models.RoleStationManager, "", "", true},

		// 记录 #6 (CA6789 周杰)：场景7 - 状态冲突演示：值机员草稿，行李主管尝试处理被拒绝
		{6, "xingLiZhuGuan", models.RoleBaggageSupervisor, models.ActionApprove, "尝试审核草稿状态的记录",
			models.StatusDraft, models.StatusDraft, 1, 1,
			models.RoleCheckinAgent, models.RoleCheckinAgent,
			"状态冲突：当前状态是草稿，此操作需要待审核状态", "status", false},
	}

	for i, p := range processingRecords {
		recordID := recordIDs[p.RecordIdx]
		createdAt := now.Add(-time.Duration(len(processingRecords)-i) * time.Hour).Format("2006-01-02 15:04:05")
		successInt := 0
		if p.Success {
			successInt = 1
		}
		_, err := db.Exec(
			`INSERT INTO processing_records (
				record_id, handler_id, handler_role, action, comment,
				from_status, to_status, version_before, version_after,
				previous_handler_role, next_handler_role, block_reason, block_type,
				success, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			recordID, userIDs[p.Handler], p.HandlerRole, p.Action, p.Comment,
			p.FromStatus, p.ToStatus, p.VersionBefore, p.VersionAfter,
			p.PreviousHandlerRole, p.NextHandlerRole, p.BlockReason, p.BlockType,
			successInt, createdAt,
		)
		if err != nil {
			return fmt.Errorf("failed to seed processing record: %w", err)
		}
	}

	auditNotes := []struct {
		RecordIdx int
		Handler   string
		Note      string
	}{
		{1, "xingLiZhuGuan", "值机证据齐全，待审核行李信息"},
		{2, "zhanDianJingLi", "所有证据齐全，可确认同步"},
		{3, "xingLiZhuGuan", "请补充完整行李重量和件数后重新提交"},
		{4, "xingLiZhuGuan", "已逾期2天，需特殊审批方可处理"},
		{5, "xingLiZhuGuan", "临期提醒：距离截止时间不足24小时"},
		{8, "xingLiZhuGuan", "已同步到离港系统，流程结束"},
	}

	for _, n := range auditNotes {
		recordID := recordIDs[n.RecordIdx]
		_, err := db.Exec(
			"INSERT INTO audit_notes (record_id, handler_id, note, created_at) VALUES (?, ?, ?, ?)",
			recordID, userIDs[n.Handler], n.Note, nowStr,
		)
		if err != nil {
			return fmt.Errorf("failed to seed audit note: %w", err)
		}
	}

	exceptionReasons := []struct {
		RecordIdx   int
		ReasonType  string
		Description string
		CreatedBy   string
	}{
		{2, "late_checkin", "旅客延迟值机，已走特殊通道处理", "zhiJiYuan"},
		{3, "missing_baggage_tag", "旅客行李标签缺失，需要补打标签", "xingLiZhuGuan"},
		{4, "overdue_processing", "超过处理期限，需值班经理审批", "xingLiZhuGuan"},
		{5, "approaching_deadline", "临近处理截止时间", "xingLiZhuGuan"},
	}

	for _, e := range exceptionReasons {
		recordID := recordIDs[e.RecordIdx]
		_, err := db.Exec(
			"INSERT INTO exception_reasons (record_id, reason_type, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
			recordID, e.ReasonType, e.Description, userIDs[e.CreatedBy], nowStr,
		)
		if err != nil {
			return fmt.Errorf("failed to seed exception reason: %w", err)
		}
	}

	return nil
}
