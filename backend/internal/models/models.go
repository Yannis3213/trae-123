package models

import "time"

type Role string

const (
	RoleRegistrar        Role = "registrar"
	RoleReviewSupervisor Role = "review_supervisor"
	RoleArchivist        Role = "archivist"
	RoleAssistant        Role = "assistant"
	RolePhysician        Role = "physician"
	RolePharmacist       Role = "pharmacist"
)

type PrescriptionStatus string

const (
	StatusDraft         PrescriptionStatus = "draft"
	StatusPending       PrescriptionStatus = "pending"
	StatusToConfirm     PrescriptionStatus = "to_confirm"
	StatusAbnormal      PrescriptionStatus = "abnormal"
	StatusProcessing    PrescriptionStatus = "processing"
	StatusRecheck       PrescriptionStatus = "recheck"
	StatusReturned      PrescriptionStatus = "returned"
	StatusCompleted     PrescriptionStatus = "completed"
	StatusArchived      PrescriptionStatus = "archived"
)

type UrgencyLevel string

const (
	UrgencyNormal  UrgencyLevel = "normal"
	UrgencyWarning UrgencyLevel = "warning"
	UrgencyOverdue UrgencyLevel = "overdue"
)

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Name     string `json:"name"`
	Role     Role   `json:"role"`
}

type PrescriptionFlow struct {
	ID                 int64              `json:"id"`
	FlowNo             string             `json:"flow_no"`
	PatientName        string             `json:"patient_name"`
	PrescriptionInfo   string             `json:"prescription_info"`
	DecoctionInfo      string             `json:"decoction_info"`
	DeliveryInfo       string             `json:"delivery_info"`
	Status             PrescriptionStatus `json:"status"`
	Urgency            UrgencyLevel       `json:"urgency"`
	CurrentHandler     string             `json:"current_handler"`
	CurrentRole        Role               `json:"current_role"`
	Version            int64              `json:"version"`
	CreatedBy          string             `json:"created_by"`
	CreatedAt          time.Time          `json:"created_at"`
	UpdatedAt          time.Time          `json:"updated_at"`
	DueAt              time.Time          `json:"due_at"`
	AbnormalReason     string             `json:"abnormal_reason,omitempty"`
	ReturnReason       string             `json:"return_reason,omitempty"`
	IsMaterialComplete bool               `json:"is_material_complete"`
}

type Attachment struct {
	ID          int64  `json:"id"`
	FlowID      int64  `json:"flow_id"`
	Type        string `json:"type"`
	Name        string `json:"name"`
	URL         string `json:"url"`
	UploadedBy  string `json:"uploaded_by"`
	UploadedAt  string `json:"uploaded_at"`
}

type ProcessRecord struct {
	ID          int64              `json:"id"`
	FlowID      int64              `json:"flow_id"`
	Action      string             `json:"action"`
	Operator    string             `json:"operator"`
	OperatorRole Role               `json:"operator_role"`
	FromStatus  PrescriptionStatus `json:"from_status"`
	ToStatus    PrescriptionStatus `json:"to_status"`
	Remark      string             `json:"remark"`
	Evidence    string             `json:"evidence"`
	CreatedAt   time.Time          `json:"created_at"`
}

type AuditNote struct {
	ID         int64     `json:"id"`
	FlowID     int64     `json:"flow_id"`
	Note       string    `json:"note"`
	Operator   string    `json:"operator"`
	CreatedAt  time.Time `json:"created_at"`
}

type AbnormalReason struct {
	ID        int64  `json:"id"`
	FlowID    int64  `json:"flow_id"`
	Reason    string `json:"reason"`
	Type      string `json:"type"`
	Operator  string `json:"operator"`
	CreatedAt string `json:"created_at"`
}

type CreateFlowRequest struct {
	PatientName      string `json:"patient_name"`
	PrescriptionInfo string `json:"prescription_info"`
	DecoctionInfo    string `json:"decoction_info"`
	DeliveryInfo     string `json:"delivery_info"`
	Operator         string `json:"operator"`
	OperatorRole     Role   `json:"operator_role"`
}

type ProcessFlowRequest struct {
	FlowID       int64  `json:"flow_id"`
	Action       string `json:"action"`
	Operator     string `json:"operator"`
	OperatorRole Role   `json:"operator_role"`
	Remark       string `json:"remark"`
	Evidence     string `json:"evidence"`
	Version      int64  `json:"version"`
	AbnormalReason string `json:"abnormal_reason,omitempty"`
	ReturnReason   string `json:"return_reason,omitempty"`
	PrescriptionInfo string `json:"prescription_info,omitempty"`
	DecoctionInfo    string `json:"decoction_info,omitempty"`
	DeliveryInfo     string `json:"delivery_info,omitempty"`
}

type BatchProcessRequest struct {
	FlowIDs      []int64 `json:"flow_ids"`
	Action       string  `json:"action"`
	Operator     string  `json:"operator"`
	OperatorRole Role    `json:"operator_role"`
	Remark       string  `json:"remark"`
	Evidence     string  `json:"evidence"`
}

type BatchResult struct {
	FlowID   int64  `json:"flow_id"`
	FlowNo   string `json:"flow_no"`
	Success  bool   `json:"success"`
	Message  string `json:"message"`
}

type ApiError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}
