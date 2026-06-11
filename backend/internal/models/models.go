package models

import "time"

const (
	RoleRegistrar    = "registrar"
	RoleAuditor      = "auditor"
	RoleReviewer     = "reviewer"

	StatusPending    = "pending"
	StatusProcessing = "processing"
	StatusCompleted  = "completed"
	StatusReturned   = "returned"
	StatusClosed     = "closed"

	NodeDocs      = "docs"
	NodeContract  = "contract"
	NodeAccount   = "account"

	WarningNormal  = "normal"
	WarningNear    = "near"
	WarningOverdue = "overdue"
)

type User struct {
	ID       string    `json:"id"`
	Username string    `json:"username"`
	Name     string    `json:"name"`
	Role     string    `json:"role"`
	Password string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

type OnboardingOrder struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	CandidateName string    `json:"candidate_name"`
	Position      string    `json:"position"`
	Department    string    `json:"department"`
	Status        string    `json:"status"`
	CurrentNode   string    `json:"current_node"`
	CurrentRole   string    `json:"current_role"`
	HandlerID     string    `json:"handler_id"`
	HandlerName   string    `json:"handler_name"`
	RegistrarID   string    `json:"registrar_id"`
	RegistrarName string    `json:"registrar_name"`
	DueDate       time.Time `json:"due_date"`
	WarningLevel  string    `json:"warning_level"`
	Version       int       `json:"version"`
	IsException   bool      `json:"is_exception"`
	ExceptionReason string  `json:"exception_reason"`
	Remark        string    `json:"remark"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Attachment struct {
	ID         string    `json:"id"`
	OrderID    string    `json:"order_id"`
	Node       string    `json:"node"`
	Type       string    `json:"type"`
	Name       string    `json:"name"`
	URL        string    `json:"url"`
	UploadedBy string    `json:"uploaded_by"`
	CreatedAt  time.Time `json:"created_at"`
}

type ProcessRecord struct {
	ID            string    `json:"id"`
	OrderID       string    `json:"order_id"`
	Node          string    `json:"node"`
	Action        string    `json:"action"`
	OperatorID    string    `json:"operator_id"`
	OperatorName  string    `json:"operator_name"`
	OperatorRole  string    `json:"operator_role"`
	FromStatus    string    `json:"from_status"`
	ToStatus      string    `json:"to_status"`
	FromNode      string    `json:"from_node"`
	ToNode        string    `json:"to_node"`
	Remark        string    `json:"remark"`
	ExceptionType string    `json:"exception_type"`
	CreatedAt     time.Time `json:"created_at"`
}

type AuditNote struct {
	ID          string    `json:"id"`
	OrderID     string    `json:"order_id"`
	StatusLabel string    `json:"status_label"`
	Content     string    `json:"content"`
	CreatedBy   string    `json:"created_by"`
	CreatedByName string  `json:"created_by_name"`
	CreatedAt   time.Time `json:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

type ProcessRequest struct {
	Action  string `json:"action"`
	Remark  string `json:"remark"`
	Version int    `json:"version"`
}

type BatchProcessRequest struct {
	OrderIDs []string `json:"order_ids"`
	Action   string   `json:"action"`
	Remark   string   `json:"remark"`
}

type BatchResultItem struct {
	OrderID    string `json:"order_id"`
	Success    bool   `json:"success"`
	Reason     string `json:"reason"`
	NewStatus  string `json:"new_status,omitempty"`
	NewNode    string `json:"new_node,omitempty"`
}

type ApiError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}
