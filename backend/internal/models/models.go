package models

import (
	"time"
)

type Role string

const (
	RoleRegistrar Role = "registrar"
	RoleAgent     Role = "agent"
	RoleDirector  Role = "director"
)

type ApplicationStatus string

const (
	StatusPendingAssign  ApplicationStatus = "pending_assign"
	StatusTransferred    ApplicationStatus = "transferred"
	StatusVisited        ApplicationStatus = "visited"
	StatusCorrection     ApplicationStatus = "correction"
	StatusReturned       ApplicationStatus = "returned"
	StatusArchived       ApplicationStatus = "archived"
)

type WarningStatus string

const (
	WarningNormal   WarningStatus = "normal"
	WarningApproaching WarningStatus = "approaching"
	WarningOverdue  WarningStatus = "overdue"
)

type ModuleType string

const (
	ModuleApplication  ModuleType = "application"
	ModuleCorrection   ModuleType = "correction"
	ModuleNotification ModuleType = "notification"
)

type User struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Role     Role   `json:"role"`
	RoleName string `json:"role_name"`
}

type TrademarkApplication struct {
	ID               string            `json:"id"`
	ApplicationNo    string            `json:"application_no"`
	TrademarkName    string            `json:"trademark_name"`
	ApplicantName    string            `json:"applicant_name"`
	ApplicantContact string            `json:"applicant_contact"`
	Category         string            `json:"category"`
	Status           ApplicationStatus `json:"status"`
	StatusName       string            `json:"status_name"`
	CurrentHandler   string            `json:"current_handler"`
	CurrentHandlerName string          `json:"current_handler_name"`
	CreatedBy        string            `json:"created_by"`
	CreatedByName    string            `json:"created_by_name"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
	DueDate          time.Time         `json:"due_date"`
	WarningStatus    WarningStatus     `json:"warning_status"`
	WarningText      string            `json:"warning_text"`
	LastOpinion      string            `json:"last_opinion"`
	LastHandlerName  string            `json:"last_handler_name"`
	LastHandleTime   *time.Time        `json:"last_handle_time"`
	Version          int               `json:"version"`
	MaterialComplete bool              `json:"material_complete"`
	EvidenceComplete bool              `json:"evidence_complete"`
	CurrentNode      string            `json:"current_node"`
	NodeDueDate      *time.Time        `json:"node_due_date"`
	NodeOverdue      bool              `json:"node_overdue"`
	NodeResponsible  string            `json:"node_responsible"`
}

type Attachment struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	FileName      string    `json:"file_name"`
	FileType      string    `json:"file_type"`
	FileSize      int64     `json:"file_size"`
	ModuleType    ModuleType `json:"module_type"`
	UploadedBy    string    `json:"uploaded_by"`
	UploadedByName string   `json:"uploaded_by_name"`
	UploadedAt    time.Time `json:"uploaded_at"`
	EvidenceType  string    `json:"evidence_type"`
}

type ProcessingRecord struct {
	ID            string            `json:"id"`
	ApplicationID string            `json:"application_id"`
	Action        string            `json:"action"`
	ActionName    string            `json:"action_name"`
	OldStatus     ApplicationStatus `json:"old_status"`
	NewStatus     ApplicationStatus `json:"new_status"`
	Handler       string            `json:"handler"`
	HandlerName   string            `json:"handler_name"`
	Opinion       string            `json:"opinion"`
	CreatedAt     time.Time         `json:"created_at"`
	ModuleType    ModuleType        `json:"module_type"`
}

type AuditRemark struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	Content       string    `json:"content"`
	CreatedBy     string    `json:"created_by"`
	CreatedByName string    `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
}

type ExceptionReason struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	Reason        string    `json:"reason"`
	ReasonType    string    `json:"reason_type"`
	CreatedBy     string    `json:"created_by"`
	CreatedByName string    `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	ModuleType    ModuleType `json:"module_type"`
	Resolved      bool      `json:"resolved"`
	ResolvedAt    *time.Time `json:"resolved_at"`
}

type BatchResultItem struct {
	ID        string `json:"id"`
	Success   bool   `json:"success"`
	Message   string `json:"message"`
}

type BatchProcessRequest struct {
	IDs     []string `json:"ids"`
	Action  string   `json:"action"`
	Opinion string   `json:"opinion"`
}

type BatchProcessResponse struct {
	Total   int               `json:"total"`
	Success int               `json:"success"`
	Failed  int               `json:"failed"`
	Results []BatchResultItem `json:"results"`
}

type ApiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type PaginationRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	Keyword  string `json:"keyword"`
	Status   string `json:"status"`
	Module   string `json:"module"`
	Warning  string `json:"warning"`
}

type PaginationResponse struct {
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
	List     interface{} `json:"list"`
}

type CreateApplicationRequest struct {
	ApplicationNo    string `json:"application_no"`
	TrademarkName    string `json:"trademark_name"`
	ApplicantName    string `json:"applicant_name"`
	ApplicantContact string `json:"applicant_contact"`
	Category         string `json:"category"`
	MaterialComplete bool   `json:"material_complete"`
}

type UpdateApplicationRequest struct {
	ID               string `json:"id"`
	TrademarkName    string `json:"trademark_name"`
	ApplicantName    string `json:"applicant_name"`
	ApplicantContact string `json:"applicant_contact"`
	Category         string `json:"category"`
	MaterialComplete bool   `json:"material_complete"`
	Version          int    `json:"version"`
}

type ActionRequest struct {
	Opinion          string `json:"opinion"`
	EvidenceComplete *bool  `json:"evidence_complete"`
	Version          int    `json:"version"`
}

type CorrectRequest struct {
	Opinion          string `json:"opinion"`
	MaterialComplete bool   `json:"material_complete"`
	EvidenceComplete bool   `json:"evidence_complete"`
	Version          int    `json:"version"`
	ExceptionReason  string `json:"exception_reason"`
}

type ReturnRequest struct {
	Opinion          string `json:"opinion"`
	Reason           string `json:"reason"`
	MaterialComplete *bool  `json:"material_complete"`
	EvidenceComplete *bool  `json:"evidence_complete"`
	ExceptionReason  string `json:"exception_reason"`
	Version          int    `json:"version"`
}

type UploadEvidenceRequest struct {
	Name         string `json:"name"`
	FileName     string `json:"file_name"`
	FileType     string `json:"file_type"`
	FileSize     int64  `json:"file_size"`
	Url          string `json:"url"`
	ModuleType   string `json:"module_type"`
	EvidenceType string `json:"evidence_type"`
	Version      int    `json:"version"`
}

type AddAuditRemarkRequest struct {
	Content string `json:"content"`
	Version int    `json:"version"`
}

type StatsResponse struct {
	Total            int64 `json:"total"`
	TotalApplication int64 `json:"total_application"`
	TotalCorrection  int64 `json:"total_correction"`
	TotalNotification int64 `json:"total_notification"`
	PendingAssign    int64 `json:"pending_assign"`
	Transferred      int64 `json:"transferred"`
	Visited          int64 `json:"visited"`
	Correction       int64 `json:"correction"`
	Returned         int64 `json:"returned"`
	Archived         int64 `json:"archived"`
	Normal           int64 `json:"normal"`
	Approaching      int64 `json:"approaching"`
	Overdue          int64 `json:"overdue"`
}

var RoleNames = map[Role]string{
	RoleRegistrar: "商标申请登记员",
	RoleAgent:     "商标申请审核主管",
	RoleDirector:  "知识产权代理所复核负责人",
}

var StatusNames = map[ApplicationStatus]string{
	StatusPendingAssign: "待分派",
	StatusTransferred:   "已转办",
	StatusVisited:       "已回访",
	StatusCorrection:    "待补正",
	StatusReturned:      "已退回",
	StatusArchived:      "已归档",
}

var WarningNames = map[WarningStatus]string{
	WarningNormal:      "正常",
	WarningApproaching: "临期",
	WarningOverdue:     "逾期",
}

var ActionNames = map[string]string{
	"create":   "创建申请",
	"assign":   "分派",
	"transfer": "转办",
	"visit":    "回访",
	"correct":  "补正",
	"return":   "退回",
	"review":   "复核",
	"archive":  "归档",
}

var ModuleNames = map[ModuleType]string{
	ModuleApplication:  "商标申请",
	ModuleCorrection:   "材料补正",
	ModuleNotification: "递交通知",
}
