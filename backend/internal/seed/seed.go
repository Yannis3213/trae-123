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
	}{
		{"CA1234", "王明", "110101199001011234", "12A", models.StatusDraft, models.RoleCheckinAgent, 1, 5, "zhiJiYuan", ""},
		{"CA5678", "李红", "110101199202022345", "08C", models.StatusPendingReview, models.RoleBaggageSupervisor, 2, 4, "zhiJiYuan", ""},
		{"CA9012", "赵强", "110101199303033456", "15F", models.StatusApproved, models.RoleStationManager, 3, 3, "zhiJiYuan", ""},
		{"CA3456", "刘芳", "110101199404044567", "03A", models.StatusReturned, models.RoleCheckinAgent, 2, 2, "zhiJiYuan", "行李信息不完整，请补充"},
		{"CA7890", "陈伟", "110101199505055678", "22D", models.StatusDraft, models.RoleCheckinAgent, 1, 0, "zhiJiYuan", ""},
		{"CA2345", "孙丽", "110101199606066789", "07B", models.StatusPendingReview, models.RoleBaggageSupervisor, 2, 1, "zhiJiYuan", ""},
		{"CA6789", "周杰", "110101199707077890", "18E", models.StatusDraft, models.RoleCheckinAgent, 1, 10, "zhiJiYuan", ""},
		{"CA4321", "吴敏", "110101199808088901", "11A", models.StatusDraft, models.RoleCheckinAgent, 1, -1, "zhiJiYuan", ""},
	}

	recordIDs := make([]int64, len(records))
	for i, r := range records {
		checkinTime := now.Add(-time.Duration(24-i) * time.Hour).Format("2006-01-02 15:04:05")
		deadline := now.Add(time.Duration(r.DeadlineDays) * 24 * time.Hour).Format("2006-01-02 15:04:05")
		createdAt := now.Add(-time.Duration(24-i) * time.Hour).Format("2006-01-02 15:04:05")
		updatedAt := createdAt

		result, err := db.Exec(
			"INSERT INTO checkin_records (flight_no, passenger_name, passenger_id, seat_no, checkin_time, status, version, deadline, created_by, current_handler_role, return_reason, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			r.FlightNo, r.Passenger, r.PassengerID, r.SeatNo, checkinTime,
			r.Status, r.Version, deadline, userIDs[r.CreatedBy], r.HandlerRole, r.ReturnReason, createdAt, updatedAt,
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
		{1, models.AttachCheckinEvidence, "checkin_evidence_ca5678.jpg", "zhiJiYuan"},
		{1, models.AttachBaggageEvidence, "baggage_evidence_ca5678.jpg", "xingLiZhuGuan"},
		{2, models.AttachCheckinEvidence, "checkin_evidence_ca9012.jpg", "zhiJiYuan"},
		{2, models.AttachBaggageEvidence, "baggage_evidence_ca9012.jpg", "xingLiZhuGuan"},
		{2, models.AttachExceptionEvidence, "exception_evidence_ca9012.jpg", "xingLiZhuGuan"},
		{5, models.AttachCheckinEvidence, "checkin_evidence_ca2345.jpg", "zhiJiYuan"},
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
		RecordIdx   int
		Handler     string
		HandlerRole models.UserRole
		Action      models.ProcessAction
		Comment     string
	}{
		{1, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核"},
		{2, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核"},
		{2, "xingLiZhuGuan", models.RoleBaggageSupervisor, models.ActionApprove, "审核通过，行李信息完整"},
		{3, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核"},
		{3, "xingLiZhuGuan", models.RoleBaggageSupervisor, models.ActionReturn, "行李信息不完整，请补充"},
		{5, "zhiJiYuan", models.RoleCheckinAgent, models.ActionSubmit, "提交审核"},
	}

	for i, p := range processingRecords {
		recordID := recordIDs[p.RecordIdx]
		createdAt := now.Add(-time.Duration(len(processingRecords)-i) * time.Hour).Format("2006-01-02 15:04:05")
		_, err := db.Exec(
			"INSERT INTO processing_records (record_id, handler_id, handler_role, action, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			recordID, userIDs[p.Handler], p.HandlerRole, p.Action, p.Comment, createdAt,
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
		{1, "xingLiZhuGuan", "值机证据清晰，待审核行李信息"},
		{2, "zhanDianJingLi", "所有证据齐全，可确认同步"},
		{3, "xingLiZhuGuan", "请补充完整行李信息后重新提交"},
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
		{3, "missing_baggage", "旅客行李标签缺失，需要补打标签", "xingLiZhuGuan"},
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
