package repository

import (
	"database/sql"
	"time"

	"consultation-system/internal/config"
	"consultation-system/internal/models"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func CreateUser(user *models.User, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if user.ID == "" {
		user.ID = uuid.New().String()
	}
	user.PasswordHash = string(hash)
	user.CreatedAt = time.Now()

	_, err = DB.Exec(`INSERT INTO users (id, username, password_hash, real_name, role, department, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Username, user.PasswordHash, user.RealName, user.Role, user.Department, user.CreatedAt)
	return err
}

func GetUserByUsername(username string) (*models.User, error) {
	row := DB.QueryRow(`SELECT id, username, password_hash, real_name, role, department, created_at 
		FROM users WHERE username = ?`, username)
	user := &models.User{}
	err := row.Scan(&user.ID, &user.Username, &user.PasswordHash, &user.RealName, &user.Role, &user.Department, &user.CreatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func GetUserByID(id string) (*models.User, error) {
	row := DB.QueryRow(`SELECT id, username, password_hash, real_name, role, department, created_at 
		FROM users WHERE id = ?`, id)
	user := &models.User{}
	err := row.Scan(&user.ID, &user.Username, &user.PasswordHash, &user.RealName, &user.Role, &user.Department, &user.CreatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func GetAllUsers() ([]models.User, error) {
	rows, err := DB.Query(`SELECT id, username, real_name, role, department, created_at FROM users`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		u := models.User{}
		err := rows.Scan(&u.ID, &u.Username, &u.RealName, &u.Role, &u.Department, &u.CreatedAt)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func VerifyPassword(user *models.User, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	return err == nil
}

func CreateConsultation(c *models.Consultation) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	if c.Status == "" {
		c.Status = config.StatusPending
	}
	if c.CurrentStage == "" {
		c.CurrentStage = config.StageRegistration
	}
	if c.Version == 0 {
		c.Version = 1
	}
	if c.CreatedAt.IsZero() {
		c.CreatedAt = time.Now()
	}
	if c.UpdatedAt.IsZero() {
		c.UpdatedAt = time.Now()
	}

	_, err := DB.Exec(`INSERT INTO consultations 
		(id, patient_name, patient_id, age, gender, department, attending_physician, 
		consultation_type, consultation_reason, consultation_dept, requested_doctor,
		appointment_time, deadline, status, current_stage, current_handler, urgency,
		evidence_list, version, is_archived, created_by, created_at, updated_at, updated_by,
		result, schedule_verified, feedback_verified)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.PatientName, c.PatientID, c.Age, c.Gender, c.Department, c.AttendingPhysician,
		c.ConsultationType, c.ConsultationReason, c.ConsultationDept, c.RequestedDoctor,
		c.AppointmentTime, c.Deadline, c.Status, c.CurrentStage, c.CurrentHandler, c.Urgency,
		c.EvidenceList, c.Version, c.IsArchived, c.CreatedBy, c.CreatedAt, c.UpdatedAt, c.UpdatedBy,
		c.Result, c.ScheduleVerified, c.FeedbackVerified)
	return err
}

func GetConsultationByID(id string) (*models.Consultation, error) {
	row := DB.QueryRow(`SELECT id, patient_name, patient_id, age, gender, department, attending_physician,
		consultation_type, consultation_reason, consultation_dept, requested_doctor,
		appointment_time, deadline, status, current_stage, current_handler, urgency,
		evidence_list, version, is_archived, created_by, created_at, updated_at, updated_by,
		result, schedule_verified, feedback_verified
		FROM consultations WHERE id = ?`, id)

	c := &models.Consultation{}
	var apptTime, deadline sql.NullTime
	err := row.Scan(&c.ID, &c.PatientName, &c.PatientID, &c.Age, &c.Gender, &c.Department, &c.AttendingPhysician,
		&c.ConsultationType, &c.ConsultationReason, &c.ConsultationDept, &c.RequestedDoctor,
		&apptTime, &deadline, &c.Status, &c.CurrentStage, &c.CurrentHandler, &c.Urgency,
		&c.EvidenceList, &c.Version, &c.IsArchived, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt, &c.UpdatedBy,
		&c.Result, &c.ScheduleVerified, &c.FeedbackVerified)
	if err != nil {
		return nil, err
	}
	if apptTime.Valid {
		t := apptTime.Time
		c.AppointmentTime = &t
	}
	if deadline.Valid {
		t := deadline.Time
		c.Deadline = &t
	}
	return c, nil
}

type ConsultationFilter struct {
	Status         config.ConsultationStatus
	Stage          config.ProcessStage
	Urgency        config.UrgencyLevel
	Department     string
	PatientName    string
	PatientID      string
	IsArchived     *bool
	CreatedBy      string
	CurrentHandler string
	OrHandlerEmpty bool
	SearchKeyword  string
}

func ListConsultations(filter ConsultationFilter, page, pageSize int) ([]models.Consultation, int, error) {
	query := `SELECT id, patient_name, patient_id, age, gender, department, attending_physician,
		consultation_type, consultation_dept, requested_doctor,
		appointment_time, deadline, status, current_stage, current_handler, urgency,
		version, is_archived, created_by, created_at, updated_at, updated_by,
		schedule_verified, feedback_verified
		FROM consultations WHERE 1=1`
	countQuery := `SELECT COUNT(*) FROM consultations WHERE 1=1`
	args := []interface{}{}
	countArgs := []interface{}{}

	if filter.Status != "" {
		query += ` AND status = ?`
		countQuery += ` AND status = ?`
		args = append(args, filter.Status)
		countArgs = append(countArgs, filter.Status)
	}
	if filter.Stage != "" {
		query += ` AND current_stage = ?`
		countQuery += ` AND current_stage = ?`
		args = append(args, filter.Stage)
		countArgs = append(countArgs, filter.Stage)
	}
	if filter.Urgency != "" {
		query += ` AND urgency = ?`
		countQuery += ` AND urgency = ?`
		args = append(args, filter.Urgency)
		countArgs = append(countArgs, filter.Urgency)
	}
	if filter.Department != "" {
		query += ` AND department = ?`
		countQuery += ` AND department = ?`
		args = append(args, filter.Department)
		countArgs = append(countArgs, filter.Department)
	}
	if filter.PatientID != "" {
		query += ` AND patient_id = ?`
		countQuery += ` AND patient_id = ?`
		args = append(args, filter.PatientID)
		countArgs = append(countArgs, filter.PatientID)
	}
	if filter.SearchKeyword != "" {
		query += ` AND (patient_name LIKE ? OR patient_id LIKE ? OR consultation_reason LIKE ?)`
		countQuery += ` AND (patient_name LIKE ? OR patient_id LIKE ? OR consultation_reason LIKE ?)`
		kw := "%" + filter.SearchKeyword + "%"
		args = append(args, kw, kw, kw)
		countArgs = append(countArgs, kw, kw, kw)
	}
	if filter.IsArchived != nil {
		query += ` AND is_archived = ?`
		countQuery += ` AND is_archived = ?`
		args = append(args, *filter.IsArchived)
		countArgs = append(countArgs, *filter.IsArchived)
	}
	if filter.CurrentHandler != "" {
		if filter.OrHandlerEmpty {
			query += ` AND (current_handler = ? OR current_handler IS NULL OR current_handler = '')`
			countQuery += ` AND (current_handler = ? OR current_handler IS NULL OR current_handler = '')`
		} else {
			query += ` AND current_handler = ?`
			countQuery += ` AND current_handler = ?`
		}
		args = append(args, filter.CurrentHandler)
		countArgs = append(countArgs, filter.CurrentHandler)
	}

	query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
	args = append(args, pageSize, (page-1)*pageSize)

	var total int
	if err := DB.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []models.Consultation
	for rows.Next() {
		c := models.Consultation{}
		var apptTime, deadline sql.NullTime
		err := rows.Scan(&c.ID, &c.PatientName, &c.PatientID, &c.Age, &c.Gender, &c.Department, &c.AttendingPhysician,
			&c.ConsultationType, &c.ConsultationDept, &c.RequestedDoctor,
			&apptTime, &deadline, &c.Status, &c.CurrentStage, &c.CurrentHandler, &c.Urgency,
			&c.Version, &c.IsArchived, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt, &c.UpdatedBy,
			&c.ScheduleVerified, &c.FeedbackVerified)
		if err != nil {
			return nil, 0, err
		}
		if apptTime.Valid {
			t := apptTime.Time
			c.AppointmentTime = &t
		}
		if deadline.Valid {
			t := deadline.Time
			c.Deadline = &t
		}
		list = append(list, c)
	}
	return list, total, nil
}

func UpdateConsultation(c *models.Consultation, expectedVersion int) (bool, error) {
	c.UpdatedAt = time.Now()
	newVersion := c.Version + 1
	result, err := DB.Exec(`UPDATE consultations SET
		patient_name=?, patient_id=?, age=?, gender=?, department=?, attending_physician=?,
		consultation_type=?, consultation_reason=?, consultation_dept=?, requested_doctor=?,
		appointment_time=?, deadline=?, status=?, current_stage=?, current_handler=?, urgency=?,
		evidence_list=?, version=?, is_archived=?, updated_at=?, updated_by=?,
		result=?, schedule_verified=?, feedback_verified=?
		WHERE id=? AND version=?`,
		c.PatientName, c.PatientID, c.Age, c.Gender, c.Department, c.AttendingPhysician,
		c.ConsultationType, c.ConsultationReason, c.ConsultationDept, c.RequestedDoctor,
		c.AppointmentTime, c.Deadline, c.Status, c.CurrentStage, c.CurrentHandler, c.Urgency,
		c.EvidenceList, newVersion, c.IsArchived, c.UpdatedAt, c.UpdatedBy,
		c.Result, c.ScheduleVerified, c.FeedbackVerified,
		c.ID, expectedVersion)
	if err != nil {
		return false, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	if rows > 0 {
		c.Version = newVersion
	}
	return rows > 0, nil
}

func CreateProcessRecord(r *models.ProcessRecord) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	r.CreatedAt = time.Now()
	_, err := DB.Exec(`INSERT INTO process_records
		(id, consultation_id, stage, action, from_status, to_status, handler_id, handler_name, handler_role, remark, evidence_used, version, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.ID, r.ConsultationID, r.Stage, r.Action, r.FromStatus, r.ToStatus,
		r.HandlerID, r.HandlerName, r.HandlerRole, r.Remark, r.EvidenceUsed, r.Version, r.CreatedAt)
	return err
}

func GetProcessRecords(consultationID string) ([]models.ProcessRecord, error) {
	rows, err := DB.Query(`SELECT id, consultation_id, stage, action, from_status, to_status,
		handler_id, handler_name, handler_role, remark, evidence_used, version, created_at
		FROM process_records WHERE consultation_id = ? ORDER BY created_at ASC`, consultationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.ProcessRecord
	for rows.Next() {
		r := models.ProcessRecord{}
		err := rows.Scan(&r.ID, &r.ConsultationID, &r.Stage, &r.Action, &r.FromStatus, &r.ToStatus,
			&r.HandlerID, &r.HandlerName, &r.HandlerRole, &r.Remark, &r.EvidenceUsed, &r.Version, &r.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

func CreateAbnormalRecord(a *models.AbnormalRecord) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	a.CreatedAt = time.Now()
	_, err := DB.Exec(`INSERT INTO abnormal_records
		(id, consultation_id, abnormal_type, reason, reported_by, is_resolved, resolution, resolved_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.ConsultationID, a.AbnormalType, a.Reason, a.ReportedBy,
		a.IsResolved, a.Resolution, a.ResolvedAt, a.CreatedAt)
	return err
}

func ResolveAbnormalRecord(id, resolution string) error {
	now := time.Now()
	_, err := DB.Exec(`UPDATE abnormal_records SET is_resolved=1, resolution=?, resolved_at=? WHERE id=?`,
		resolution, now, id)
	return err
}

func GetAbnormalRecords(consultationID string) ([]models.AbnormalRecord, error) {
	rows, err := DB.Query(`SELECT id, consultation_id, abnormal_type, reason, reported_by,
		is_resolved, resolution, resolved_at, created_at
		FROM abnormal_records WHERE consultation_id = ? ORDER BY created_at DESC`, consultationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.AbnormalRecord
	for rows.Next() {
		a := models.AbnormalRecord{}
		var resolvedAt sql.NullTime
		err := rows.Scan(&a.ID, &a.ConsultationID, &a.AbnormalType, &a.Reason, &a.ReportedBy,
			&a.IsResolved, &a.Resolution, &resolvedAt, &a.CreatedAt)
		if err != nil {
			return nil, err
		}
		if resolvedAt.Valid {
			t := resolvedAt.Time
			a.ResolvedAt = &t
		}
		list = append(list, a)
	}
	return list, nil
}

func CreateAttachment(a *models.Attachment) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	a.CreatedAt = time.Now()
	_, err := DB.Exec(`INSERT INTO attachments
		(id, consultation_id, file_name, file_type, evidence_type, uploaded_by, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.ConsultationID, a.FileName, a.FileType, a.EvidenceType, a.UploadedBy, a.CreatedAt)
	return err
}

func GetAttachments(consultationID string) ([]models.Attachment, error) {
	rows, err := DB.Query(`SELECT id, consultation_id, file_name, file_type, evidence_type, uploaded_by, created_at
		FROM attachments WHERE consultation_id = ? ORDER BY created_at DESC`, consultationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.Attachment
	for rows.Next() {
		a := models.Attachment{}
		err := rows.Scan(&a.ID, &a.ConsultationID, &a.FileName, &a.FileType, &a.EvidenceType, &a.UploadedBy, &a.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, nil
}

func CreateAuditNote(n *models.AuditNote) error {
	if n.ID == "" {
		n.ID = uuid.New().String()
	}
	n.CreatedAt = time.Now()
	_, err := DB.Exec(`INSERT INTO audit_notes (id, consultation_id, note, created_by, created_at)
		VALUES (?, ?, ?, ?, ?)`, n.ID, n.ConsultationID, n.Note, n.CreatedBy, n.CreatedAt)
	return err
}

func GetAuditNotes(consultationID string) ([]models.AuditNote, error) {
	rows, err := DB.Query(`SELECT id, consultation_id, note, created_by, created_at
		FROM audit_notes WHERE consultation_id = ? ORDER BY created_at DESC`, consultationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.AuditNote
	for rows.Next() {
		n := models.AuditNote{}
		err := rows.Scan(&n.ID, &n.ConsultationID, &n.Note, &n.CreatedBy, &n.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	return list, nil
}

func buildFilterWhere(filter ConsultationFilter) (string, []interface{}) {
	where := ""
	args := []interface{}{}
	if filter.Status != "" {
		where += ` AND status = ?`
		args = append(args, filter.Status)
	}
	if filter.Stage != "" {
		where += ` AND current_stage = ?`
		args = append(args, filter.Stage)
	}
	if filter.Urgency != "" {
		where += ` AND urgency = ?`
		args = append(args, filter.Urgency)
	}
	if filter.Department != "" {
		where += ` AND department = ?`
		args = append(args, filter.Department)
	}
	if filter.PatientID != "" {
		where += ` AND patient_id = ?`
		args = append(args, filter.PatientID)
	}
	if filter.SearchKeyword != "" {
		where += ` AND (patient_name LIKE ? OR patient_id LIKE ? OR consultation_reason LIKE ?)`
		kw := "%" + filter.SearchKeyword + "%"
		args = append(args, kw, kw, kw)
	}
	if filter.CreatedBy != "" {
		where += ` AND created_by = ?`
		args = append(args, filter.CreatedBy)
	}
	if filter.IsArchived != nil {
		where += ` AND is_archived = ?`
		args = append(args, *filter.IsArchived)
	}
	if filter.CurrentHandler != "" {
		if filter.OrHandlerEmpty {
			where += ` AND (current_handler = ? OR current_handler IS NULL OR current_handler = '')`
		} else {
			where += ` AND current_handler = ?`
		}
		args = append(args, filter.CurrentHandler)
	}
	return where, args
}

func GetStatistics(baseFilter ConsultationFilter) (map[string]int, error) {
	stats := make(map[string]int)

	activeFilter := baseFilter
	bFalse := false
	activeFilter.IsArchived = &bFalse
	whereActive, argsActive := buildFilterWhere(activeFilter)
	statusSQL := `SELECT status, COUNT(*) FROM consultations WHERE 1=1` + whereActive + ` GROUP BY status`
	rows, err := DB.Query(statusSQL, argsActive...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		stats[status] = count
	}

	urgencySQL := `SELECT urgency, COUNT(*) FROM consultations WHERE 1=1` + whereActive + ` GROUP BY urgency`
	rows2, err := DB.Query(urgencySQL, argsActive...)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()
	for rows2.Next() {
		var urgency string
		var count int
		if err := rows2.Scan(&urgency, &count); err != nil {
			return nil, err
		}
		stats["urgency_"+urgency] = count
	}

	archivedFilter := baseFilter
	bTrue := true
	archivedFilter.IsArchived = &bTrue
	whereArchived, argsArchived := buildFilterWhere(archivedFilter)
	archivedSQL := `SELECT COUNT(*) FROM consultations WHERE 1=1` + whereArchived
	row := DB.QueryRow(archivedSQL, argsArchived...)
	var archived int
	if err := row.Scan(&archived); err != nil {
		return nil, err
	}
	stats["archived"] = archived
	return stats, nil
}
