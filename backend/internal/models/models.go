package models

import "time"

type Role string

const (
	RoleShopClerk    Role = "shop_clerk"
	RolePharmacist   Role = "pharmacist"
	RoleAreaManager  Role = "area_manager"
)

type OrderStatus string

const (
	StatusPendingDispatch OrderStatus = "pending_dispatch"
	StatusProcessing      OrderStatus = "processing"
	StatusClosed          OrderStatus = "closed"
	StatusReturned        OrderStatus = "returned"
)

type EvidenceType string

const (
	EvidenceInspection  EvidenceType = "inspection"
	EvidenceTransfer    EvidenceType = "transfer"
	EvidenceRemoval     EvidenceType = "removal"
)

type NearExpiryOrder struct {
	ID            string      `json:"id"`
	OrderNo       string      `json:"order_no"`
	StoreName     string      `json:"store_name"`
	ProductName   string      `json:"product_name"`
	BatchNo       string      `json:"batch_no"`
	ExpiryDate    time.Time   `json:"expiry_date"`
	Quantity      int         `json:"quantity"`
	Status        OrderStatus `json:"status"`
	CurrentHandler string     `json:"current_handler"`
	CreatedBy     string      `json:"created_by"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
	Version       int         `json:"version"`
	DueDate       time.Time   `json:"due_date"`
	ClosedAt      *time.Time  `json:"closed_at,omitempty"`
}

type Attachment struct {
	ID         string       `json:"id"`
	OrderID    string       `json:"order_id"`
	EvidenceType EvidenceType `json:"evidence_type"`
	FileName   string       `json:"file_name"`
	UploadedBy string       `json:"uploaded_by"`
	UploadedAt time.Time    `json:"uploaded_at"`
	Remark     string       `json:"remark"`
}

type ProcessingRecord struct {
	ID          string      `json:"id"`
	OrderID     string      `json:"order_id"`
	Action      string      `json:"action"`
	FromStatus  OrderStatus `json:"from_status"`
	ToStatus    OrderStatus `json:"to_status"`
	Operator    string      `json:"operator"`
	OperatorRole Role       `json:"operator_role"`
	Remark      string      `json:"remark"`
	CreatedAt   time.Time   `json:"created_at"`
}

type AuditNote struct {
	ID        string    `json:"id"`
	OrderID   string    `json:"order_id"`
	Content   string    `json:"content"`
	Author    string    `json:"author"`
	CreatedAt time.Time `json:"created_at"`
}

type ExceptionReason struct {
	ID          string `json:"id"`
	OrderID     string `json:"order_id"`
	Reason      string `json:"reason"`
	ExceptionType string `json:"exception_type"`
	ReportedBy  string `json:"reported_by"`
	CreatedAt   time.Time `json:"created_at"`
	Resolved    bool   `json:"resolved"`
}

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Name     string `json:"name"`
	Role     Role   `json:"role"`
	Store    string `json:"store"`
}

type BatchResult struct {
	OrderID string `json:"order_id"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type OrderDetail struct {
	NearExpiryOrder
	Attachments       []Attachment       `json:"attachments"`
	ProcessingRecords []ProcessingRecord `json:"processing_records"`
	AuditNotes        []AuditNote        `json:"audit_notes"`
	ExceptionReasons  []ExceptionReason  `json:"exception_reasons"`
	MissingEvidences  []EvidenceType     `json:"missing_evidences"`
	IsOverdue         bool               `json:"is_overdue"`
	IsNearDue         bool               `json:"is_near_due"`
}
