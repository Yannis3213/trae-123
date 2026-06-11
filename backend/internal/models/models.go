package models

import "time"

type Role string

const (
	RoleClerk        Role = "fire_clerk"
	RoleSupervisor   Role = "fire_supervisor"
	RoleStationChief Role = "station_chief"
)

type HazardStatus string

const (
	StatusDraft       HazardStatus = "draft"
	StatusPendingAssign HazardStatus = "pending_assign"
	StatusAssigned    HazardStatus = "assigned"
	StatusTransferred HazardStatus = "transferred"
	StatusRectifying  HazardStatus = "rectifying"
	StatusRechecking  HazardStatus = "rechecking"
	StatusReturned    HazardStatus = "returned"
	StatusRevisited   HazardStatus = "revisited"
	StatusClosed      HazardStatus = "closed"
	StatusArchived    HazardStatus = "archived"
)

type Priority string

const (
	PriorityLow    Priority = "low"
	PriorityMedium Priority = "medium"
	PriorityHigh   Priority = "high"
	PriorityUrgent Priority = "urgent"
)

type WarningLevel string

const (
	WarningNormal  WarningLevel = "normal"
	WarningNearDue WarningLevel = "near_due"
	WarningOverdue WarningLevel = "overdue"
)

type FireHazard struct {
	ID              int64        `json:"id"`
	HazardNo        string       `json:"hazard_no"`
	Title           string       `json:"title"`
	Description     string       `json:"description"`
	Location        string       `json:"location"`
	Priority        Priority     `json:"priority"`
	Responsible     string       `json:"responsible"`
	CurrentHandler  string       `json:"current_handler"`
	Status          HazardStatus `json:"status"`
	Deadline        time.Time    `json:"deadline"`
	WarningLevel    WarningLevel `json:"warning_level"`
	AbnormalTags    []string     `json:"abnormal_tags"`
	RectifyNotice   string       `json:"rectify_notice"`
	RecheckResult   string       `json:"recheck_result"`
	ReturnReason    string       `json:"return_reason"`
	Version         int64        `json:"version"`
	CreatedBy       string       `json:"created_by"`
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
}

type Attachment struct {
	ID         int64     `json:"id"`
	HazardID   int64     `json:"hazard_id"`
	FileName   string    `json:"file_name"`
	FileType   string    `json:"file_type"`
	FileSize   int64     `json:"file_size"`
	FileURL    string    `json:"file_url"`
	UploadedBy string    `json:"uploaded_by"`
	UploadedAt time.Time `json:"uploaded_at"`
}

type ProcessRecord struct {
	ID            int64        `json:"id"`
	HazardID      int64        `json:"hazard_id"`
	Action        string       `json:"action"`
	FromStatus    HazardStatus `json:"from_status"`
	ToStatus      HazardStatus `json:"to_status"`
	Operator      string       `json:"operator"`
	OperatorRole  Role         `json:"operator_role"`
	Remark        string       `json:"remark"`
	Evidence      []string     `json:"evidence"`
	CreatedAt     time.Time    `json:"created_at"`
}

type AuditNote struct {
	ID         int64     `json:"id"`
	HazardID   int64     `json:"hazard_id"`
	Content    string    `json:"content"`
	Auditor    string    `json:"auditor"`
	AuditorRole Role    `json:"auditor_role"`
	CreatedAt  time.Time `json:"created_at"`
}

type AbnormalReason struct {
	ID         int64     `json:"id"`
	HazardID   int64     `json:"hazard_id"`
	Reason     string    `json:"reason"`
	Category   string    `json:"category"`
	ReportedBy string    `json:"reported_by"`
	CreatedAt  time.Time `json:"created_at"`
	Resolved   bool      `json:"resolved"`
}

type BatchResult struct {
	ID      int64  `json:"id"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type BatchRequest struct {
	IDs     []int64 `json:"ids"`
	Action  string  `json:"action"`
	Remark  string  `json:"remark"`
	Version int64   `json:"version"`
}

type User struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Role     Role   `json:"role"`
	RoleName string `json:"role_name"`
}
