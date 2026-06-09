package config

const (
	ServerPort       = "8001"
	JWTSecret        = "consultation-system-secret-key-2024"
	TokenExpireHours = 24
	CORSAllowOrigin  = "http://localhost:3001"
	SQLitePath       = "./data/consultation.db"
)

type Role string

const (
	RoleRegistrar Role = "registrar"
	RoleAuditor   Role = "auditor"
	RoleReviewer  Role = "reviewer"
)

type ConsultationStatus string

const (
	StatusPending   ConsultationStatus = "pending"
	StatusAbnormal  ConsultationStatus = "abnormal"
	StatusRechecked ConsultationStatus = "rechecked"
	StatusArchived  ConsultationStatus = "archived"
)

type ProcessStage string

const (
	StageRegistration ProcessStage = "registration"
	StageVerification ProcessStage = "verification"
	StageReview       ProcessStage = "review"
)

type UrgencyLevel string

const (
	UrgencyNormal  UrgencyLevel = "normal"
	UrgencyWarning UrgencyLevel = "warning"
	UrgencyOverdue UrgencyLevel = "overdue"
)
