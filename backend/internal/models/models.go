package models

type UserRole string

const (
	RoleCheckinAgent      UserRole = "checkin_agent"
	RoleBaggageSupervisor UserRole = "baggage_supervisor"
	RoleStationManager    UserRole = "station_manager"
)

type RecordStatus string

const (
	StatusDraft         RecordStatus = "draft"
	StatusPendingReview RecordStatus = "pending_review"
	StatusApproved      RecordStatus = "approved"
	StatusSynced        RecordStatus = "synced"
	StatusReturned      RecordStatus = "returned"
)

type AttachmentType string

const (
	AttachCheckinEvidence   AttachmentType = "checkin_evidence"
	AttachBaggageEvidence   AttachmentType = "baggage_evidence"
	AttachExceptionEvidence AttachmentType = "exception_evidence"
)

type ProcessAction string

const (
	ActionSubmit      ProcessAction = "submit"
	ActionApprove     ProcessAction = "approve"
	ActionReject      ProcessAction = "reject"
	ActionReturn      ProcessAction = "return"
	ActionConfirmSync ProcessAction = "confirm_sync"
	ActionCorrect     ProcessAction = "correct"
)

type User struct {
	ID           int64    `json:"id" db:"id"`
	Username     string   `json:"username" db:"username"`
	PasswordHash string   `json:"-" db:"password_hash"`
	Role         UserRole `json:"role" db:"role"`
	Name         string   `json:"name" db:"name"`
	CreatedAt    string   `json:"created_at" db:"created_at"`
}

type CheckinRecord struct {
	ID                 int64        `json:"id" db:"id"`
	FlightNo           string       `json:"flight_no" db:"flight_no"`
	PassengerName      string       `json:"passenger_name" db:"passenger_name"`
	PassengerID        string       `json:"passenger_id" db:"passenger_id"`
	SeatNo             string       `json:"seat_no" db:"seat_no"`
	CheckinTime        string       `json:"checkin_time" db:"checkin_time"`
	Status             RecordStatus `json:"status" db:"status"`
	Version            int          `json:"version" db:"version"`
	Deadline           string       `json:"deadline" db:"deadline"`
	CreatedBy          int64        `json:"created_by" db:"created_by"`
	CurrentHandlerRole UserRole     `json:"current_handler_role" db:"current_handler_role"`
	ReturnReason       string       `json:"return_reason" db:"return_reason"`
	Scenario           string       `json:"scenario" db:"scenario"`
	CreatedAt          string       `json:"created_at" db:"created_at"`
	UpdatedAt          string       `json:"updated_at" db:"updated_at"`
}

type Attachment struct {
	ID         int64          `json:"id" db:"id"`
	RecordID   int64          `json:"record_id" db:"record_id"`
	Type       AttachmentType `json:"type" db:"type"`
	FileName   string         `json:"file_name" db:"file_name"`
	FilePath   string         `json:"file_path" db:"file_path"`
	UploadedBy int64          `json:"uploaded_by" db:"uploaded_by"`
	CreatedAt  string         `json:"created_at" db:"created_at"`
}

type ProcessingRecord struct {
	ID          int64         `json:"id" db:"id"`
	RecordID    int64         `json:"record_id" db:"record_id"`
	HandlerID   int64         `json:"handler_id" db:"handler_id"`
	HandlerRole UserRole      `json:"handler_role" db:"handler_role"`
	Action      ProcessAction `json:"action" db:"action"`
	Comment     string        `json:"comment" db:"comment"`
	CreatedAt   string        `json:"created_at" db:"created_at"`
}

type AuditNote struct {
	ID        int64  `json:"id" db:"id"`
	RecordID  int64  `json:"record_id" db:"record_id"`
	HandlerID int64  `json:"handler_id" db:"handler_id"`
	Note      string `json:"note" db:"note"`
	CreatedAt string `json:"created_at" db:"created_at"`
}

type ExceptionReason struct {
	ID          int64  `json:"id" db:"id"`
	RecordID    int64  `json:"record_id" db:"record_id"`
	ReasonType  string `json:"reason_type" db:"reason_type"`
	Description string `json:"description" db:"description"`
	CreatedBy   int64  `json:"created_by" db:"created_by"`
	CreatedAt   string `json:"created_at" db:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateRecordRequest struct {
	FlightNo      string `json:"flight_no"`
	PassengerName string `json:"passenger_name"`
	PassengerID   string `json:"passenger_id"`
	SeatNo        string `json:"seat_no"`
	CheckinTime   string `json:"checkin_time"`
	Deadline      string `json:"deadline"`
}

type ProcessRecordRequest struct {
	Action  ProcessAction `json:"action"`
	Comment string        `json:"comment"`
	Version int           `json:"version"`
}

type BatchProcessRequest struct {
	RecordIDs     []int64       `json:"record_ids"`
	Action        ProcessAction `json:"action"`
	Comment       string        `json:"comment"`
	Version       int           `json:"version"`
	RecordVersion map[int64]int `json:"record_versions"`
}

type BatchProcessResult struct {
	RecordID      int64  `json:"record_id"`
	Success       bool   `json:"success"`
	Message       string `json:"message"`
	ErrorType     string `json:"error_type"`
	FlightNo      string `json:"flight_no"`
	PassengerName string `json:"passenger_name"`
}

type AvailableAction struct {
	Action  ProcessAction `json:"action"`
	Label   string        `json:"label"`
	Enabled bool          `json:"enabled"`
	Reason  string        `json:"reason"`
}

type DeadlineInfo struct {
	WarningType string `json:"warning_type"`
	Label       string `json:"label"`
	HoursLeft   int    `json:"hours_left"`
}

type RecordDetail struct {
	CheckinRecord
	Attachments       []Attachment       `json:"attachments"`
	ProcessingRecords []ProcessingRecord `json:"processing_records"`
	AuditNotes        []AuditNote        `json:"audit_notes"`
	ExceptionReasons  []ExceptionReason  `json:"exception_reasons"`
	CreatorName       string             `json:"creator_name"`
	AvailableActions  []AvailableAction  `json:"available_actions"`
	DeadlineInfo      DeadlineInfo       `json:"deadline_info"`
}

type RecordListQuery struct {
	Status             string `query:"status"`
	CurrentHandlerRole string `query:"current_handler_role"`
	FlightNo           string `query:"flight_no"`
	PassengerName      string `query:"passenger_name"`
	Page               int    `query:"page"`
	PageSize           int    `query:"page_size"`
	WarningType        string `query:"warning_type"`
}
