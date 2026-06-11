package model

import "time"

const (
	StatusDraft       = "draft"
	StatusPendingAudit = "pending_audit"
	StatusAuditPassed = "audit_passed"
	StatusSynced      = "synced"
	StatusReturned    = "returned"
)

const (
	RoleRegistrar = "registrar"
	RoleAuditor   = "auditor"
	RoleReviewer  = "reviewer"
)

const (
	ModuleTypeSubmission   = "submission"
	ModuleTypeSample       = "sample"
	ModuleTypeRegistration = "registration"
)

const (
	RemarkTypeStatusChange = "status_change"
	RemarkTypeException    = "exception"
	RemarkTypeSupplement   = "supplement"
)

type User struct {
	ID        int64     `json:"id" db:"id"`
	Username  string    `json:"username" db:"username"`
	Password  string    `json:"-" db:"password"`
	Role      string    `json:"role" db:"role"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type LiveSelectionOrder struct {
	ID                   int64     `json:"id" db:"id"`
	OrderNo              string    `json:"order_no" db:"order_no"`
	ProductName          string    `json:"product_name" db:"product_name"`
	ProductCategory      string    `json:"product_category" db:"product_category"`
	Price                float64   `json:"price" db:"price"`
	Stock                int       `json:"stock" db:"stock"`
	Status               string    `json:"status" db:"status"`
	CurrentHandler       string    `json:"current_handler" db:"current_handler"`
	CurrentRole          string    `json:"current_role" db:"current_role"`
	Version              int       `json:"version" db:"version"`
	Deadline             time.Time `json:"deadline" db:"deadline"`
	SubmissionEvidence   string    `json:"submission_evidence" db:"submission_evidence"`
	SampleEvidence       string    `json:"sample_evidence" db:"sample_evidence"`
	RegistrationEvidence string    `json:"registration_evidence" db:"registration_evidence"`
	CreatedAt            time.Time `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time `json:"updated_at" db:"updated_at"`
	CreatedBy            string    `json:"created_by" db:"created_by"`
	ExceptionReason      string    `json:"exception_reason" db:"exception_reason"`
	IsOverdue            bool      `json:"is_overdue" db:"is_overdue"`
	OverdueReason        string    `json:"overdue_reason" db:"overdue_reason"`
}

type SelectionAttachment struct {
	ID         int64     `json:"id" db:"id"`
	OrderID    int64     `json:"order_id" db:"order_id"`
	FileName   string    `json:"file_name" db:"file_name"`
	FileType   string    `json:"file_type" db:"file_type"`
	FileURL    string    `json:"file_url" db:"file_url"`
	UploadedBy string    `json:"uploaded_by" db:"uploaded_by"`
	UploadedAt time.Time `json:"uploaded_at" db:"uploaded_at"`
	ModuleType string    `json:"module_type" db:"module_type"`
}

type ProcessRecord struct {
	ID            int64     `json:"id" db:"id"`
	OrderID       int64     `json:"order_id" db:"order_id"`
	Operator      string    `json:"operator" db:"operator"`
	OperatorRole  string    `json:"operator_role" db:"operator_role"`
	Action        string    `json:"action" db:"action"`
	FromStatus    string    `json:"from_status" db:"from_status"`
	ToStatus      string    `json:"to_status" db:"to_status"`
	Opinion       string    `json:"opinion" db:"opinion"`
	Version       int       `json:"version" db:"version"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

type AuditRemark struct {
	ID           int64     `json:"id" db:"id"`
	OrderID      int64     `json:"order_id" db:"order_id"`
	Operator     string    `json:"operator" db:"operator"`
	OperatorRole string    `json:"operator_role" db:"operator_role"`
	RemarkType   string    `json:"remark_type" db:"remark_type"`
	Content      string    `json:"content" db:"content"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

type OrderListRequest struct {
	Status   string `query:"status"`
	Keyword  string `query:"keyword"`
	Page     int    `query:"page"`
	PageSize int    `query:"pageSize"`
}

type OrderListResponse struct {
	List     []*LiveSelectionOrder `json:"list"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"pageSize"`
}

type OrderDetailResponse struct {
	Order              *LiveSelectionOrder    `json:"order"`
	Attachments        []*SelectionAttachment `json:"attachments"`
	ProcessRecords     []*ProcessRecord       `json:"process_records"`
	AuditRemarks       []*AuditRemark         `json:"audit_remarks"`
	IsCurrentHandler   bool                   `json:"is_current_handler"`
	CanOperate         bool                   `json:"can_operate"`
}

type CreateOrderRequest struct {
	ProductName       string  `json:"product_name"`
	ProductCategory   string  `json:"product_category"`
	Price             float64 `json:"price"`
	Stock             int     `json:"stock"`
	Deadline          string  `json:"deadline"`
	SubmissionEvidence string `json:"submission_evidence"`
}

type SubmitOrderRequest struct {
	Version    int `json:"version"`
}

type AuditOrderRequest struct {
	Version     int    `json:"version"`
	Pass        bool   `json:"pass"`
	Opinion     string `json:"opinion"`
}

type ReviewOrderRequest struct {
	Version int    `json:"version"`
	Opinion string `json:"opinion"`
}

type SupplementOrderRequest struct {
	Version            int    `json:"version"`
	SubmissionEvidence string `json:"submission_evidence"`
	SampleEvidence     string `json:"sample_evidence"`
	ExceptionReason    string `json:"exception_reason"`
}

type BatchProcessRequest struct {
	Action  string  `json:"action"`
	OrderIDs []int64 `json:"order_ids"`
	Opinion string  `json:"opinion"`
}

type BatchProcessResult struct {
	OrderID int64  `json:"order_id"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type BatchProcessResponse struct {
	Results []*BatchProcessResult `json:"results"`
}

type ProcessModuleRequest struct {
	ModuleType  string `json:"module_type"`
	Version     int    `json:"version"`
	Evidence    string `json:"evidence"`
	Opinion     string `json:"opinion"`
	AuditRemark string `json:"audit_remark"`
	SubmitNext  bool   `json:"submit_next"`
}

type OverdueQueueItem struct {
	Handler     string                 `json:"handler"`
	Role        string                 `json:"role"`
	NormalCount int                    `json:"normal_count"`
	WarningCount int                   `json:"warning_count"`
	OverdueCount int                   `json:"overdue_count"`
	Orders      []*LiveSelectionOrder  `json:"orders"`
}

type OverdueQueueResponse struct {
	Groups []*OverdueQueueItem `json:"groups"`
}

type OverduePushItem struct {
	OrderID     int64  `json:"order_id"`
	Version     int    `json:"version"`
	AuditRemark string `json:"audit_remark"`
}

type BatchOverduePushRequest struct {
	OrderIDs []int64          `json:"order_ids"`
	Reason   string           `json:"reason"`
	Items    []*OverduePushItem `json:"items"`
}

type UploadAttachmentRequest struct {
	FileName   string `json:"file_name"`
	FileType   string `json:"file_type"`
	FileURL    string `json:"file_url"`
	ModuleType string `json:"module_type"`
}
