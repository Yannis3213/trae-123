package models

import (
	"time"
	"gorm.io/gorm"
)

type PatrolOrder struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	OrderNo           string         `gorm:"uniqueIndex;size:64;not null" json:"order_no"`
	CustomerName      string         `gorm:"size:128;not null" json:"customer_name"`
	IDNumber          string         `gorm:"size:32;not null" json:"id_number"`
	Phone             string         `gorm:"size:32" json:"phone"`
	InsuranceType     string         `gorm:"size:64;not null" json:"insurance_type"`
	InsuranceAmount   float64        `gorm:"not null;default:0" json:"insurance_amount"`
	Premium           float64        `gorm:"not null;default:0" json:"premium"`
	InsurancePeriod   string         `gorm:"size:64" json:"insurance_period"`
	StartDate         *time.Time     `json:"start_date"`
	EndDate           *time.Time     `json:"end_date"`
	Status            string         `gorm:"size:32;not null;default:待审核" json:"status"`
	CurrentHandlerID  string         `gorm:"size:64" json:"current_handler_id"`
	CurrentHandler    string         `gorm:"size:64" json:"current_handler"`
	CreatorID         string         `gorm:"size:64;not null" json:"creator_id"`
	CreatorName       string         `gorm:"size:64;not null" json:"creator_name"`
	EvidenceUploaded  bool           `gorm:"not null;default:false" json:"evidence_uploaded"`
	ConfirmEvidence   bool           `gorm:"not null;default:false" json:"confirm_evidence"`
	Deadline          *time.Time     `json:"deadline"`
	Version           int            `gorm:"not null;default:1" json:"version"`
	Remark            string         `gorm:"type:text" json:"remark"`
	RejectReason      string         `gorm:"type:text" json:"reject_reason"`
	SupplementReason  string         `gorm:"type:text" json:"supplement_reason"`
	AbnormalReason    string         `gorm:"type:text" json:"abnormal_reason"`
	Attachments       []Attachment   `gorm:"foreignKey:PatrolOrderID" json:"attachments,omitempty"`
	Histories         []OrderHistory `gorm:"foreignKey:PatrolOrderID" json:"histories,omitempty"`
	AuditNotes        []AuditNote    `gorm:"foreignKey:PatrolOrderID" json:"audit_notes,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

type Attachment struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	PatrolOrderID uint           `gorm:"index;not null" json:"patrol_order_id"`
	FileName      string         `gorm:"size:255;not null" json:"file_name"`
	FileType      string         `gorm:"size:64" json:"file_type"`
	FileSize      int64          `gorm:"default:0" json:"file_size"`
	FilePath      string         `gorm:"size:512" json:"file_path"`
	FileURL       string         `gorm:"size:512" json:"file_url"`
	UploaderID    string         `gorm:"size:64" json:"uploader_id"`
	UploaderName  string         `gorm:"size:64" json:"uploader_name"`
	Category      string         `gorm:"size:64" json:"category"`
	IsEvidence    bool           `gorm:"not null;default:false" json:"is_evidence"`
	CreatedAt     time.Time      `json:"created_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

type OrderHistory struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	PatrolOrderID  uint      `gorm:"index;not null" json:"patrol_order_id"`
	Action         string    `gorm:"size:64;not null" json:"action"`
	PreviousStatus string    `gorm:"size:32" json:"previous_status"`
	CurrentStatus  string    `gorm:"size:32" json:"current_status"`
	OperatorID     string    `gorm:"size:64;not null" json:"operator_id"`
	OperatorName   string    `gorm:"size:64;not null" json:"operator_name"`
	OperatorRole   string    `gorm:"size:64" json:"operator_role"`
	Remark         string    `gorm:"type:text" json:"remark"`
	AbnormalReason string    `gorm:"type:text" json:"abnormal_reason"`
	CreatedAt      time.Time `json:"created_at"`
}

type AuditNote struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	PatrolOrderID uint      `gorm:"index;not null" json:"patrol_order_id"`
	NoteType      string    `gorm:"size:64" json:"note_type"`
	Content       string    `gorm:"type:text;not null" json:"content"`
	OperatorID    string    `gorm:"size:64;not null" json:"operator_id"`
	OperatorName  string    `gorm:"size:64;not null" json:"operator_name"`
	CreatedAt     time.Time `json:"created_at"`
}
