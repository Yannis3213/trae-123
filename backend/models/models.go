package models

import (
	"time"
)

type Role string

const (
	RoleRegistrar   Role = "registrar"
	RoleAuditor     Role = "auditor"
	RoleReviewer    Role = "reviewer"
)

type ApplicationStatus string

const (
	StatusPending     ApplicationStatus = "待分派"
	StatusTransferred ApplicationStatus = "已转办"
	StatusVisited     ApplicationStatus = "已回访"
)

type UrgencyLevel string

const (
	UrgencyNormal   UrgencyLevel = "normal"
	UrgencyWarning  UrgencyLevel = "warning"
	UrgencyOverdue  UrgencyLevel = "overdue"
)

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Password string `json:"-"`
	Name     string `json:"name"`
	Role     Role   `json:"role"`
}

type StudentApplication struct {
	ID                    string            `json:"id"`
	StudentName           string            `json:"student_name"`
	IdCard                string            `json:"id_card"`
	Phone                 string            `json:"phone"`
	Program               string            `json:"program"`
	Status                ApplicationStatus `json:"status"`
	CurrentHandler        string            `json:"current_handler"`
	CurrentHandlerName    string            `json:"current_handler_name"`
	CurrentHandlerRole    Role              `json:"current_handler_role"`
	NextHandler           string            `json:"next_handler"`
	NextHandlerName       string            `json:"next_handler_name"`
	NextHandlerRole       Role              `json:"next_handler_role"`
	AssignmentDeadline    time.Time         `json:"assignment_deadline"`
	AuditDeadline         time.Time         `json:"audit_deadline"`
	ReviewDeadline        time.Time         `json:"review_deadline"`
	CreatedAt             time.Time         `json:"created_at"`
	UpdatedAt             time.Time         `json:"updated_at"`
	Version               int               `json:"version"`
	Urgency               UrgencyLevel      `json:"urgency"`
	ResponsiblePerson     string            `json:"responsible_person"`
	ResponsiblePersonName string            `json:"responsible_person_name"`
	MaterialsComplete     bool              `json:"materials_complete"`
	ClassAssigned         bool              `json:"class_assigned"`
	PaymentConfirmed      bool              `json:"payment_confirmed"`
}

type Attachment struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	Type          string    `json:"type"`
	Name          string    `json:"name"`
	UploadedBy    string    `json:"uploaded_by"`
	UploadedAt    time.Time `json:"uploaded_at"`
	Verified      bool      `json:"verified"`
}

type ProcessingRecord struct {
	ID              string            `json:"id"`
	ApplicationID   string            `json:"application_id"`
	Action          string            `json:"action"`
	HandlerID       string            `json:"handler_id"`
	HandlerName     string            `json:"handler_name"`
	HandlerRole     Role              `json:"handler_role"`
	PreviousStatus  ApplicationStatus `json:"previous_status"`
	NewStatus       ApplicationStatus `json:"new_status"`
	PreviousHandler string            `json:"previous_handler"`
	NewHandler      string            `json:"new_handler"`
	Remark          string            `json:"remark"`
	CreatedAt       time.Time         `json:"created_at"`
	Version         int               `json:"version"`
	IsCorrection    bool              `json:"is_correction"`
}

type AuditNote struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	UserID        string    `json:"user_id"`
	UserName      string    `json:"user_name"`
	Content       string    `json:"content"`
	CreatedAt     time.Time `json:"created_at"`
}

type ExceptionRecord struct {
	ID              string    `json:"id"`
	ApplicationID   string    `json:"application_id"`
	Type            string    `json:"type"`
	Reason          string    `json:"reason"`
	TriggeredBy     string    `json:"triggered_by"`
	TriggeredByName string    `json:"triggered_by_name"`
	TriggeredAt     time.Time `json:"triggered_at"`
	Resolved        bool      `json:"resolved"`
	ResolvedAt      time.Time `json:"resolved_at"`
	ResolutionNote  string    `json:"resolution_note"`
}

type BatchResult struct {
	ApplicationID   string `json:"application_id"`
	StudentName     string `json:"student_name"`
	Success         bool   `json:"success"`
	Reason          string `json:"reason"`
	ExcType         string `json:"exc_type,omitempty"`
	CurrVersion     int    `json:"curr_version,omitempty"`
	NewVersion      int    `json:"new_version,omitempty"`
	NewStatus       string `json:"new_status,omitempty"`
	NewHandler      string `json:"new_handler,omitempty"`
}

type EvidenceSummary struct {
	MaterialsCount  int  `json:"materials_count"`
	MaterialsOK     bool `json:"materials_ok"`
	ClassOK         bool `json:"class_ok"`
	PaymentOK       bool `json:"payment_ok"`
	AllComplete     bool `json:"all_complete"`
}
