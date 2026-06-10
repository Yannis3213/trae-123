package models

type User struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	Password    string `json:"-"`
	Role        string `json:"role"`
	DisplayName string `json:"display_name"`
}

type Application struct {
	ID              int64  `json:"id"`
	OrderNo         string `json:"order_no"`
	ProductName     string `json:"product_name"`
	ProductCount    int    `json:"product_count"`
	ExpectedDate    string `json:"expected_date"`
	AppointmentTime string `json:"appointment_time"`
	TemperatureZone string `json:"temperature_zone"`
	Status          string `json:"status"`
	CurrentStep     string `json:"current_step"`
	CreatorID       int64  `json:"creator_id"`
	HandlerID       int64  `json:"handler_id"`
	Version         int    `json:"version"`
	CorrectionNote  string `json:"correction_note"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
	CreatorName     string `json:"creator_name,omitempty"`
	HandlerName     string `json:"handler_name,omitempty"`
	ExpiryGroup     string `json:"expiry_group,omitempty"`
}

type Attachment struct {
	ID             int64  `json:"id"`
	ApplicationID  int64  `json:"application_id"`
	FileName       string `json:"file_name"`
	FileType       string `json:"file_type"`
	UploadedBy     int64  `json:"uploaded_by"`
	UploadedByName string `json:"uploaded_by_name,omitempty"`
	CreatedAt      string `json:"created_at"`
}

type ProcessingRecord struct {
	ID            int64  `json:"id"`
	ApplicationID int64  `json:"application_id"`
	OperatorID    int64  `json:"operator_id"`
	OperatorName  string `json:"operator_name,omitempty"`
	Action        string `json:"action"`
	FromStatus    string `json:"from_status"`
	ToStatus      string `json:"to_status"`
	Remark        string `json:"remark"`
	CreatedAt     string `json:"created_at"`
}

type AuditNote struct {
	ID            int64  `json:"id"`
	ApplicationID int64  `json:"application_id"`
	OperatorID    int64  `json:"operator_id"`
	OperatorName  string `json:"operator_name,omitempty"`
	Content       string `json:"content"`
	CreatedAt     string `json:"created_at"`
}

type ExceptionReason struct {
	ID            int64  `json:"id"`
	ApplicationID int64  `json:"application_id"`
	OperatorID    int64  `json:"operator_id"`
	OperatorName  string `json:"operator_name,omitempty"`
	ReasonType    string `json:"reason_type"`
	Description   string `json:"description"`
	CreatedAt     string `json:"created_at"`
}

type BatchRequest struct {
	IDs    []int64 `json:"ids"`
	Action string  `json:"action"`
	Remark string  `json:"remark"`
}

type BatchResultItem struct {
	ID      int64  `json:"id"`
	OrderNo string `json:"order_no"`
	Success bool   `json:"success"`
	Reason  string `json:"reason"`
}

type BatchResponse struct {
	Results []BatchResultItem `json:"results"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type SwitchRoleRequest struct {
	Role string `json:"role"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ApplicationQuery struct {
	Status      string `form:"status"`
	Role        string `form:"role"`
	ExpiryGroup string `form:"expiry_group"`
	Search      string `form:"search"`
}
