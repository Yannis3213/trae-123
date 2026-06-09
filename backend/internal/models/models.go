package models

import (
	"time"

	"consultation-system/internal/config"
)

type User struct {
	ID           string      `json:"id"`
	Username     string      `json:"username"`
	PasswordHash string      `json:"-"`
	RealName     string      `json:"real_name"`
	Role         config.Role `json:"role"`
	Department   string      `json:"department"`
	CreatedAt    time.Time   `json:"created_at"`
}

type Consultation struct {
	ID                 string                    `json:"id"`
	PatientName        string                    `json:"patient_name"`
	PatientID          string                    `json:"patient_id"`
	Age                int                       `json:"age"`
	Gender             string                    `json:"gender"`
	Department         string                    `json:"department"`
	AttendingPhysician string                    `json:"attending_physician"`
	ConsultationType   string                    `json:"consultation_type"`
	ConsultationReason string                    `json:"consultation_reason"`
	ConsultationDept   string                    `json:"consultation_dept"`
	RequestedDoctor    string                    `json:"requested_doctor"`
	AppointmentTime    *time.Time                `json:"appointment_time"`
	Deadline           *time.Time                `json:"deadline"`
	Status             config.ConsultationStatus `json:"status"`
	CurrentStage       config.ProcessStage       `json:"current_stage"`
	CurrentHandler     string                    `json:"current_handler"`
	RegistrarID        string                    `json:"registrar_id"`
	RegistrarName      string                    `json:"registrar_name"`
	AuditorID          string                    `json:"auditor_id"`
	AuditorName        string                    `json:"auditor_name"`
	ReviewerID         string                    `json:"reviewer_id"`
	ReviewerName       string                    `json:"reviewer_name"`
	Urgency            config.UrgencyLevel       `json:"urgency"`
	EvidenceList       string                    `json:"evidence_list"`
	Version            int                       `json:"version"`
	IsArchived         bool                      `json:"is_archived"`
	CreatedBy          string                    `json:"created_by"`
	CreatedAt          time.Time                 `json:"created_at"`
	UpdatedAt          time.Time                 `json:"updated_at"`
	UpdatedBy          string                    `json:"updated_by"`
	Result             string                    `json:"result"`
	ScheduleVerified   bool                      `json:"schedule_verified"`
	FeedbackVerified   bool                      `json:"feedback_verified"`
}

type Attachment struct {
	ID             string    `json:"id"`
	ConsultationID string    `json:"consultation_id"`
	FileName       string    `json:"file_name"`
	FileType       string    `json:"file_type"`
	EvidenceType   string    `json:"evidence_type"`
	UploadedBy     string    `json:"uploaded_by"`
	CreatedAt      time.Time `json:"created_at"`
}

type ProcessRecord struct {
	ID             string                    `json:"id"`
	ConsultationID string                    `json:"consultation_id"`
	Stage          config.ProcessStage       `json:"stage"`
	Action         string                    `json:"action"`
	FromStatus     config.ConsultationStatus `json:"from_status"`
	ToStatus       config.ConsultationStatus `json:"to_status"`
	HandlerID      string                    `json:"handler_id"`
	HandlerName    string                    `json:"handler_name"`
	HandlerRole    config.Role               `json:"handler_role"`
	Remark         string                    `json:"remark"`
	EvidenceUsed   string                    `json:"evidence_used"`
	Version        int                       `json:"version"`
	CreatedAt      time.Time                 `json:"created_at"`
}

type AbnormalRecord struct {
	ID             string     `json:"id"`
	ConsultationID string     `json:"consultation_id"`
	AbnormalType   string     `json:"abnormal_type"`
	Reason         string     `json:"reason"`
	ReportedBy     string     `json:"reported_by"`
	IsResolved     bool       `json:"is_resolved"`
	Resolution     string     `json:"resolution"`
	ResolvedAt     *time.Time `json:"resolved_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

type AuditNote struct {
	ID             string    `json:"id"`
	ConsultationID string    `json:"consultation_id"`
	Note           string    `json:"note"`
	CreatedBy      string    `json:"created_by"`
	CreatedAt      time.Time `json:"created_at"`
}
