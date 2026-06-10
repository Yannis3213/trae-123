package models

import (
	"time"
)

type Role string

const (
	RoleRegistrar  Role = "registrar"
	RoleSupervisor Role = "supervisor"
	RoleManager    Role = "manager"
)

type WorkOrderStatus string

const (
	StatusDraft        WorkOrderStatus = "draft"
	StatusPendingAudit WorkOrderStatus = "pending_audit"
	StatusPendingReview WorkOrderStatus = "pending_review"
	StatusCorrection   WorkOrderStatus = "correction"
	StatusCompleted    WorkOrderStatus = "completed"
	StatusRejected     WorkOrderStatus = "rejected"
)

type WarningLevel string

const (
	WarningNormal   WarningLevel = "normal"
	WarningNearDue  WarningLevel = "near_due"
	WarningOverdue  WarningLevel = "overdue"
)

type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Password  string    `json:"-"`
	Name      string    `json:"name"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type WorkOrder struct {
	ID                  int64           `json:"id"`
	OrderNo             string          `json:"order_no"`
	AppointmentClue     string          `json:"appointment_clue"`
	CustomerName        string          `json:"customer_name"`
	Phone               string          `json:"phone"`
	LicensePlate        string          `json:"license_plate"`
	CarModel            string          `json:"car_model"`
	Mileage             int             `json:"mileage"`
	FaultDescription    string          `json:"fault_description"`
	Status              WorkOrderStatus `json:"status"`
	RegistrarID         int64           `json:"registrar_id"`
	RegistrarName       string          `json:"registrar_name"`
	CurrentHandlerID    int64           `json:"current_handler_id"`
	CurrentHandlerName  string          `json:"current_handler_name"`
	SupervisorID        int64           `json:"supervisor_id,omitempty"`
	SupervisorName      string          `json:"supervisor_name,omitempty"`
	ManagerID           int64           `json:"manager_id,omitempty"`
	ManagerName         string          `json:"manager_name,omitempty"`
	ExpectedCompleteAt  time.Time       `json:"expected_complete_at"`
	WarningLevel        WarningLevel    `json:"warning_level"`
	IsOverdue           bool            `json:"is_overdue"`
	Version             int             `json:"version"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

type WorkOrderDetail struct {
	WorkOrder
	Attachments     []Attachment    `json:"attachments"`
	ProcessingLogs  []ProcessingLog `json:"processing_logs"`
	AuditNotes      []AuditNote     `json:"audit_notes"`
	ExceptionReason string          `json:"exception_reason,omitempty"`
}

type Attachment struct {
	ID          int64     `json:"id"`
	WorkOrderID int64     `json:"work_order_id"`
	FileName    string    `json:"file_name"`
	FileType    string    `json:"file_type"`
	FileSize    int64     `json:"file_size"`
	FilePath    string    `json:"file_path"`
	UploadedBy  int64     `json:"uploaded_by"`
	Uploader    string    `json:"uploader"`
	EvidenceType string   `json:"evidence_type"`
	CreatedAt   time.Time `json:"created_at"`
}

type ProcessingLog struct {
	ID          int64           `json:"id"`
	WorkOrderID int64           `json:"work_order_id"`
	OperatorID  int64           `json:"operator_id"`
	Operator    string          `json:"operator"`
	Action      string          `json:"action"`
	FromStatus  WorkOrderStatus `json:"from_status"`
	ToStatus    WorkOrderStatus `json:"to_status"`
	Remark      string          `json:"remark"`
	CreatedAt   time.Time       `json:"created_at"`
}

type AuditNote struct {
	ID          int64     `json:"id"`
	WorkOrderID int64     `json:"work_order_id"`
	OperatorID  int64     `json:"operator_id"`
	Operator    string    `json:"operator"`
	Note        string    `json:"note"`
	CreatedAt   time.Time `json:"created_at"`
}

type ExceptionRecord struct {
	ID               int64           `json:"id"`
	WorkOrderID      int64           `json:"work_order_id"`
	ExceptionType    string          `json:"exception_type"`
	Reason           string          `json:"reason"`
	OperatorID       int64           `json:"operator_id"`
	Operator         string          `json:"operator"`
	CurrentStatus    WorkOrderStatus `json:"current_status"`
	Resolution       string          `json:"resolution"`
	CreatedAt        time.Time       `json:"created_at"`
	ResolvedAt       *time.Time      `json:"resolved_at,omitempty"`
}

type BatchOperationRequest struct {
	IDs         []int64 `json:"ids"`
	Action      string  `json:"action"`
	AuditNote   string  `json:"audit_note,omitempty"`
}

type BatchResultItem struct {
	ID      int64  `json:"id"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type BatchOperationResponse struct {
	Total   int               `json:"total"`
	Success int               `json:"success"`
	Failed  int               `json:"failed"`
	Results []BatchResultItem `json:"results"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

type WorkOrderListRequest struct {
	Page             int             `json:"page" form:"page"`
	PageSize         int             `json:"page_size" form:"page_size"`
	Status           WorkOrderStatus `json:"status" form:"status"`
	AppointmentClue  string          `json:"appointment_clue" form:"appointment_clue"`
	WarningLevel     WarningLevel    `json:"warning_level" form:"warning_level"`
	LicensePlate     string          `json:"license_plate" form:"license_plate"`
}

type WorkOrderCreateRequest struct {
	AppointmentClue  string    `json:"appointment_clue"`
	CustomerName     string    `json:"customer_name"`
	Phone            string    `json:"phone"`
	LicensePlate     string    `json:"license_plate"`
	CarModel         string    `json:"car_model"`
	Mileage          int       `json:"mileage"`
	FaultDescription string    `json:"fault_description"`
	ExpectedCompleteAt time.Time `json:"expected_complete_at"`
}

type WorkOrderProcessRequest struct {
	Action          string            `json:"action"`
	Remark          string            `json:"remark"`
	ExceptionReason string           `json:"exception_reason,omitempty"`
	Version         int               `json:"version"`
}

type Statistics struct {
	TotalCount       int64 `json:"total_count"`
	PendingAudit     int64 `json:"pending_audit"`
	PendingReview    int64 `json:"pending_review"`
	Correction       int64 `json:"correction"`
	Completed        int64 `json:"completed"`
	Normal           int64 `json:"normal"`
	NearDue          int64 `json:"near_due"`
	Overdue          int64 `json:"overdue"`
}
