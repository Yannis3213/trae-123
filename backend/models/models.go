package models

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

func GenerateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func ComputeExpiryFields(endDate string) (string, int) {
	if endDate == "" {
		return "normal", 0
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return "normal", 0
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	diff := end.Sub(today).Hours() / 24
	if diff < 0 {
		return "overdue", int(-diff)
	}
	if diff <= 30 {
		return "expiring_soon", 0
	}
	return "normal", 0
}

type LeaseApplication struct {
	ID                      string   `json:"id"`
	ApplicationNo           string   `json:"application_no"`
	TenantName              string   `json:"tenant_name"`
	TenantPhone             string   `json:"tenant_phone"`
	RoomNumber              string   `json:"room_number"`
	BuildingName            string   `json:"building_name"`
	LeaseStartDate          string   `json:"lease_start_date"`
	LeaseEndDate            string   `json:"lease_end_date"`
	MonthlyRent             float64  `json:"monthly_rent"`
	Deposit                 float64  `json:"deposit"`
	Status                  string   `json:"status"`
	CurrentHandlerID        string   `json:"current_handler_id"`
	CurrentHandlerName      string   `json:"current_handler_name"`
	CurrentHandlerRole      string   `json:"current_handler_role"`
	Version                 int      `json:"version"`
	Confirmed               bool     `json:"confirmed"`
	TenantSigningStatus     string   `json:"tenant_signing_status"`
	RoomConfirmationStatus  string   `json:"room_confirmation_status"`
	MoveInHandoverStatus    string   `json:"move_in_handover_status"`
	ExceptionReason         string   `json:"exception_reason"`
	ExpiryStatus            string   `json:"expiry_status"`
	OverdueDays             int      `json:"overdue_days"`
	CreatedAt               string   `json:"created_at"`
	UpdatedAt               string   `json:"updated_at"`
}

type Attachment struct {
	ID           string `json:"id"`
	ApplicationID string `json:"application_id"`
	FileName     string `json:"file_name"`
	FileType     string `json:"file_type"`
	FilePath     string `json:"file_path"`
	UploadedBy   string `json:"uploaded_by"`
	UploadRole   string `json:"upload_role"`
	CreatedAt    string `json:"created_at"`
}

type ProcessingRecord struct {
	ID              string `json:"id"`
	ApplicationID   string `json:"application_id"`
	HandlerID       string `json:"handler_id"`
	HandlerName     string `json:"handler_name"`
	HandlerRole     string `json:"handler_role"`
	Action          string `json:"action"`
	FromStatus      string `json:"from_status"`
	ToStatus        string `json:"to_status"`
	Remark          string `json:"remark"`
	ExceptionReason string `json:"exception_reason"`
	Version         int    `json:"version"`
	NextHandlerRole string `json:"next_handler_role"`
	NextHandlerID   string `json:"next_handler_id"`
	NextHandlerName string `json:"next_handler_name"`
	CreatedAt       string `json:"created_at"`
}

type AuditLog struct {
	ID            string `json:"id"`
	ApplicationID string `json:"application_id"`
	OperatorID    string `json:"operator_id"`
	OperatorName  string `json:"operator_name"`
	OperatorRole  string `json:"operator_role"`
	Action        string `json:"action"`
	BeforeStatus  string `json:"before_status"`
	AfterStatus   string `json:"after_status"`
	Detail        string `json:"detail"`
	FailureReason string `json:"failure_reason"`
	Version       int    `json:"version"`
	CreatedAt     string `json:"created_at"`
}

type BatchFailureRecord struct {
	ID            string `json:"id"`
	BatchID       string `json:"batch_id"`
	ApplicationID string `json:"application_id"`
	ApplicationNo string `json:"application_no"`
	Reason        string `json:"reason"`
	HandlerRole   string `json:"handler_role"`
	HandlerID     string `json:"handler_id"`
	HandlerName   string `json:"handler_name"`
	Action        string `json:"action"`
	CreatedAt     string `json:"created_at"`
}

type CreateApplicationRequest struct {
	TenantName     string  `json:"tenant_name" binding:"required"`
	TenantPhone    string  `json:"tenant_phone" binding:"required"`
	RoomNumber     string  `json:"room_number" binding:"required"`
	BuildingName   string  `json:"building_name" binding:"required"`
	LeaseStartDate string  `json:"lease_start_date" binding:"required"`
	LeaseEndDate   string  `json:"lease_end_date" binding:"required"`
	MonthlyRent    float64 `json:"monthly_rent" binding:"required"`
	Deposit        float64 `json:"deposit" binding:"required"`
}

type UpdateApplicationRequest struct {
	TenantName              string  `json:"tenant_name"`
	TenantPhone             string  `json:"tenant_phone"`
	RoomNumber              string  `json:"room_number"`
	BuildingName            string  `json:"building_name"`
	LeaseStartDate          string  `json:"lease_start_date"`
	LeaseEndDate            string  `json:"lease_end_date"`
	MonthlyRent             float64 `json:"monthly_rent"`
	Deposit                 float64 `json:"deposit"`
	Version                 int     `json:"version" binding:"required"`
	TenantSigningStatus     string  `json:"tenant_signing_status"`
	RoomConfirmationStatus  string  `json:"room_confirmation_status"`
	MoveInHandoverStatus    string  `json:"move_in_handover_status"`
	ExceptionReason         string  `json:"exception_reason"`
}

type ProcessRequest struct {
	Action          string `json:"action" binding:"required"`
	Version         int    `json:"version"`
	Remark          string `json:"remark"`
	ExceptionReason string `json:"exception_reason"`
	SubModule       string `json:"sub_module"`
	SubModuleStatus string `json:"sub_module_status"`
}

type BatchApplicationItem struct {
	ID      string `json:"id" binding:"required"`
	Version int    `json:"version"`
}

type BatchProcessRequest struct {
	ApplicationIDs   []string               `json:"application_ids"`
	ApplicationItems []BatchApplicationItem `json:"application_items"`
	Action           string                 `json:"action" binding:"required"`
	Remark           string                 `json:"remark"`
	ExceptionReason  string                 `json:"exception_reason"`
}

type BatchResultItem struct {
	ApplicationID   string `json:"application_id"`
	ApplicationNo   string `json:"application_no"`
	Success         bool   `json:"success"`
	Reason          string `json:"reason"`
}

type StatisticsData struct {
	Total               int `json:"total"`
	PendingVerification int `json:"pending_verification"`
	VerificationFailed  int `json:"verification_failed"`
	VerificationComplete int `json:"verification_complete"`
	OverdueCount        int `json:"overdue_count"`
	ExpiringSoonCount   int `json:"expiring_soon_count"`
	NormalCount         int `json:"normal_count"`
}
