package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Role string

const (
	RoleOpsSpecialist Role = "ops_specialist"
	RoleWarehouseMgr  Role = "warehouse_manager"
	RoleShopOwner     Role = "shop_owner"
)

type OrderStage string

const (
	StageListing     OrderStage = "listing"
	StageInventory   OrderStage = "inventory"
	StageFulfillment OrderStage = "fulfillment"
)

type OrderStatus string

const (
	StatusPending    OrderStatus = "pending"
	StatusSubmitted  OrderStatus = "submitted"
	StatusReturned   OrderStatus = "returned"
	StatusApproved   OrderStatus = "approved"
	StatusCompleted  OrderStatus = "completed"
)

type WarningLevel string

const (
	WarningNormal  WarningLevel = "normal"
	WarningNearDue WarningLevel = "near_due"
	WarningOverdue WarningLevel = "overdue"
)

type User struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex" json:"username"`
	Password  string    `json:"-"`
	Name      string    `json:"name"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}

type CrossBorderOrder struct {
	ID               string     `gorm:"primaryKey" json:"id"`
	OrderNo          string     `gorm:"uniqueIndex" json:"order_no"`
	ShopName         string     `json:"shop_name"`
	ProductName      string     `json:"product_name"`
	SKU              string     `json:"sku"`
	Quantity         int        `json:"quantity"`
	Amount           float64    `json:"amount"`
	Country          string     `json:"country"`
	CurrentStage     OrderStage `json:"current_stage"`
	CurrentStatus    OrderStatus `json:"current_status"`
	IsResubmitted    bool       `json:"is_resubmitted"`
	ResubmitCount    int        `json:"resubmit_count"`
	CurrentHandlerID string     `json:"current_handler_id"`
	CurrentHandler   *User      `gorm:"foreignKey:CurrentHandlerID" json:"current_handler,omitempty"`
	Version          int        `json:"version"`
	ListingDueAt     *time.Time `json:"listing_due_at"`
	InventoryDueAt   *time.Time `json:"inventory_due_at"`
	FulfillmentDueAt *time.Time `json:"fulfillment_due_at"`
	ListingData      string     `gorm:"type:text" json:"listing_data,omitempty"`
	InventoryData    string     `gorm:"type:text" json:"inventory_data,omitempty"`
	FulfillmentData  string     `gorm:"type:text" json:"fulfillment_data,omitempty"`
	CreatedByID      string     `json:"created_by_id"`
	CreatedBy        *User      `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func (o *CrossBorderOrder) BeforeCreate(tx *gorm.DB) error {
	if o.ID == "" {
		o.ID = uuid.New().String()
	}
	if o.Version == 0 {
		o.Version = 1
	}
	return nil
}

type OrderAttachment struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	OrderID     string    `gorm:"index" json:"order_id"`
	Stage       OrderStage `json:"stage"`
	FileName    string    `json:"file_name"`
	FileType    string    `json:"file_type"`
	FileURL     string    `json:"file_url"`
	UploadedByID string   `json:"uploaded_by_id"`
	UploadedBy  *User     `gorm:"foreignKey:UploadedByID" json:"uploaded_by,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

func (a *OrderAttachment) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	return nil
}

type ProcessingRecord struct {
	ID              string      `gorm:"primaryKey" json:"id"`
	OrderID         string      `gorm:"index" json:"order_id"`
	Stage           OrderStage  `json:"stage"`
	Action          string      `json:"action"`
	FromStatus      OrderStatus `json:"from_status"`
	ToStatus        OrderStatus `json:"to_status"`
	OperatorID      string      `json:"operator_id"`
	Operator        *User       `gorm:"foreignKey:OperatorID" json:"operator,omitempty"`
	Note            string      `gorm:"type:text" json:"note,omitempty"`
	IsException     bool        `json:"is_exception"`
	ExceptionReason string      `gorm:"type:text" json:"exception_reason,omitempty"`
	ClientIP        string      `json:"client_ip,omitempty"`
	CreatedAt       time.Time   `json:"created_at"`
}

func (r *ProcessingRecord) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}

type AuditNote struct {
	ID         string    `gorm:"primaryKey" json:"id"`
	OrderID    string    `gorm:"index" json:"order_id"`
	Stage      OrderStage `json:"stage"`
	Content    string    `gorm:"type:text" json:"content"`
	AuthorID   string    `json:"author_id"`
	Author     *User     `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (n *AuditNote) BeforeCreate(tx *gorm.DB) error {
	if n.ID == "" {
		n.ID = uuid.New().String()
	}
	return nil
}

type ExceptionLog struct {
	ID              string    `gorm:"primaryKey" json:"id"`
	OrderID         string    `gorm:"index" json:"order_id"`
	Stage           OrderStage `json:"stage"`
	ExceptionType   string    `json:"exception_type"`
	Reason          string    `gorm:"type:text" json:"reason"`
	OperatorID      string    `json:"operator_id"`
	Operator        *User     `gorm:"foreignKey:OperatorID" json:"operator,omitempty"`
	CorrectedAction string    `gorm:"type:text" json:"corrected_action,omitempty"`
	IsResolved      bool      `json:"is_resolved"`
	CreatedAt       time.Time `json:"created_at"`
	ResolvedAt      *time.Time `json:"resolved_at,omitempty"`
}

func (e *ExceptionLog) BeforeCreate(tx *gorm.DB) error {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	return nil
}
