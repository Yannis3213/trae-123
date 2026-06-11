package main

type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Password string `json:"-"`
	Name     string `json:"name"`
	Role     string `json:"role"`
}

type RepairOrder struct {
	ID            int    `json:"id"`
	OrderNo       string `json:"order_no"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	Status        string `json:"status"`
	Priority      string `json:"priority"`
	CustomerID    int    `json:"customer_id"`
	TechnicianID  int    `json:"technician_id"`
	ManagerID     int    `json:"manager_id"`
	Deadline      string `json:"deadline"`
	Version       int    `json:"version"`
	ExceptionType string `json:"exception_type"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

type Attachment struct {
	ID         int    `json:"id"`
	OrderID    int    `json:"order_id"`
	FileName   string `json:"file_name"`
	Category   string `json:"category"`
	UploadedBy int    `json:"uploaded_by"`
	UploadRole string `json:"upload_role"`
	CreatedAt  string `json:"created_at"`
}

type ProcessRecord struct {
	ID           int    `json:"id"`
	OrderID      int    `json:"order_id"`
	Action       string `json:"action"`
	FromStatus   string `json:"from_status"`
	ToStatus     string `json:"to_status"`
	OperatorID   int    `json:"operator_id"`
	OperatorRole string `json:"operator_role"`
	Remark       string `json:"remark"`
	CreatedAt    string `json:"created_at"`
}

type AuditNote struct {
	ID         int    `json:"id"`
	OrderID    int    `json:"order_id"`
	Note       string `json:"note"`
	AuthorID   int    `json:"author_id"`
	AuthorRole string `json:"author_role"`
	CreatedAt  string `json:"created_at"`
}

type ExceptionReason struct {
	ID          int    `json:"id"`
	OrderID     int    `json:"order_id"`
	ReasonType  string `json:"reason_type"`
	Description string `json:"description"`
	CreatedBy   int    `json:"created_by"`
	CreatedAt   string `json:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateOrderRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Priority    string `json:"priority"`
	Deadline    string `json:"deadline"`
}

type UpdateStatusRequest struct {
	Status          string `json:"status"`
	Version         int    `json:"version"`
	Remark          string `json:"remark"`
	ExceptionReason string `json:"exception_reason"`
	Attachments     []struct {
		FileName string `json:"file_name"`
		Category string `json:"category"`
	} `json:"attachments"`
}

type BatchOrderItem struct {
	OrderID int `json:"order_id"`
	Version int `json:"version"`
}

type BatchUpdateRequest struct {
	Orders []BatchOrderItem `json:"orders"`
	Status string           `json:"status"`
	Remark string           `json:"remark"`
}

type BatchResultItem struct {
	OrderID      int    `json:"order_id"`
	OrderNo      string `json:"order_no"`
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	FromStatus   string `json:"from_status"`
	ToStatus     string `json:"to_status"`
	Version      int    `json:"version"`
	SubmittedVer int    `json:"submitted_version"`
	CurrentVer   int    `json:"current_version"`
	TechnicianID int    `json:"technician_id"`
	ManagerID    int    `json:"manager_id"`
}

type OrderDetailResponse struct {
	Order            RepairOrder       `json:"order"`
	Attachments      []Attachment      `json:"attachments"`
	ProcessRecords   []ProcessRecord   `json:"process_records"`
	AuditNotes       []AuditNote       `json:"audit_notes"`
	ExceptionReasons []ExceptionReason `json:"exception_reasons"`
	ExpiryStatus     string            `json:"expiry_status"`
}

type StatusCount struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type StatisticsResponse struct {
	StatusCounts map[string]int `json:"status_counts"`
	ExpiryCounts map[string]int `json:"expiry_counts"`
	Total        int            `json:"total"`
}

type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type PaginatedResponse struct {
	List         []RepairOrder  `json:"list"`
	Total        int            `json:"total"`
	Page         int            `json:"page"`
	PageSize     int            `json:"page_size"`
	StatusCounts map[string]int `json:"status_counts"`
}

type AuditTrailItem struct {
	Type         string `json:"type"`
	ID           int    `json:"id"`
	OrderID      int    `json:"order_id"`
	Action       string `json:"action,omitempty"`
	Note         string `json:"note,omitempty"`
	ReasonType   string `json:"reason_type,omitempty"`
	Description  string `json:"description,omitempty"`
	Remark       string `json:"remark,omitempty"`
	OperatorID   int    `json:"operator_id,omitempty"`
	OperatorRole string `json:"operator_role,omitempty"`
	AuthorID     int    `json:"author_id,omitempty"`
	AuthorRole   string `json:"author_role,omitempty"`
	CreatedBy    int    `json:"created_by,omitempty"`
	FromStatus   string `json:"from_status,omitempty"`
	ToStatus     string `json:"to_status,omitempty"`
	CreatedAt    string `json:"created_at"`
}
