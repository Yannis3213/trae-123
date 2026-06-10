package services

import (
	"errors"
	"fmt"
	"time"

	"aviation-ground-service/internal/models"
)

type ValidationErrorType string

const (
	ErrTypeVersion      ValidationErrorType = "version"
	ErrTypeRole         ValidationErrorType = "role"
	ErrTypeStatus       ValidationErrorType = "status"
	ErrTypeEvidence     ValidationErrorType = "evidence"
	ErrTypeDeadline     ValidationErrorType = "deadline"
	ErrTypeReturnReason ValidationErrorType = "return_reason"
)

type ValidationError struct {
	Type    ValidationErrorType
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

func NewValidationError(errType ValidationErrorType, message string) *ValidationError {
	return &ValidationError{
		Type:    errType,
		Message: message,
	}
}

var (
	ErrVersionConflict = errors.New("版本冲突，记录已被修改，请刷新后重试")
)

var validTransitions = map[models.ProcessAction]struct {
	RequiredRole   models.UserRole
	RequiredStatus models.RecordStatus
	NewStatus      models.RecordStatus
	NewHandlerRole models.UserRole
}{
	models.ActionSubmit: {
		RequiredRole:   models.RoleCheckinAgent,
		RequiredStatus: models.StatusDraft,
		NewStatus:      models.StatusPendingReview,
		NewHandlerRole: models.RoleBaggageSupervisor,
	},
	models.ActionCorrect: {
		RequiredRole:   models.RoleCheckinAgent,
		RequiredStatus: models.StatusReturned,
		NewStatus:      models.StatusPendingReview,
		NewHandlerRole: models.RoleBaggageSupervisor,
	},
	models.ActionApprove: {
		RequiredRole:   models.RoleBaggageSupervisor,
		RequiredStatus: models.StatusPendingReview,
		NewStatus:      models.StatusApproved,
		NewHandlerRole: models.RoleStationManager,
	},
	models.ActionReturn: {
		RequiredRole:   models.RoleBaggageSupervisor,
		RequiredStatus: models.StatusPendingReview,
		NewStatus:      models.StatusReturned,
		NewHandlerRole: models.RoleCheckinAgent,
	},
	models.ActionConfirmSync: {
		RequiredRole:   models.RoleStationManager,
		RequiredStatus: models.StatusApproved,
		NewStatus:      models.StatusSynced,
		NewHandlerRole: models.RoleStationManager,
	},
}

type ValidationContext struct {
	UserRole           models.UserRole
	CurrentHandlerRole models.UserRole
	CurrentStatus      models.RecordStatus
	Action             models.ProcessAction
	RequestVersion     int
	RecordVersion      int
	Deadline           string
	Attachments        []models.Attachment
	Comment            string
}

type AvailableAction struct {
	Action  models.ProcessAction
	Label   string
	Enabled bool
	Reason  string
}

func ValidateAll(ctx *ValidationContext) *ValidationError {
	if err := ValidateVersion(ctx.RequestVersion, ctx.RecordVersion); err != nil {
		return err
	}
	if err := ValidateTransition(ctx.UserRole, ctx.CurrentHandlerRole, ctx.CurrentStatus, ctx.Action); err != nil {
		return err
	}
	if err := ValidateEvidence(ctx.Action, ctx.Attachments); err != nil {
		return err
	}
	if err := ValidateDeadline(ctx.Deadline, ctx.CurrentHandlerRole, ctx.Action); err != nil {
		return err
	}
	if err := ValidateReturnReason(ctx.Action, ctx.Comment); err != nil {
		return err
	}
	return nil
}

func ValidateVersion(requestVersion, recordVersion int) *ValidationError {
	if requestVersion != recordVersion {
		return NewValidationError(ErrTypeVersion,
			fmt.Sprintf("版本冲突：当前版本 v%d，您提交的是 v%d，请刷新后重试", recordVersion, requestVersion))
	}
	return nil
}

func ValidateTransition(userRole models.UserRole, currentHandlerRole models.UserRole, currentStatus models.RecordStatus, action models.ProcessAction) *ValidationError {
	transition, ok := validTransitions[action]
	if !ok {
		return NewValidationError(ErrTypeStatus, "无效的操作类型")
	}

	if userRole != transition.RequiredRole {
		roleLabel := GetRoleLabel(userRole)
		requiredLabel := GetRoleLabel(transition.RequiredRole)
		return NewValidationError(ErrTypeRole,
			fmt.Sprintf("角色越权：您是%s，此操作需要%s角色", roleLabel, requiredLabel))
	}

	if userRole != currentHandlerRole {
		roleLabel := GetRoleLabel(userRole)
		handlerLabel := GetRoleLabel(currentHandlerRole)
		return NewValidationError(ErrTypeRole,
			fmt.Sprintf("角色越权：当前处理人是%s，您是%s，无权处理此记录", handlerLabel, roleLabel))
	}

	if currentStatus != transition.RequiredStatus {
		statusLabel := GetStatusLabel(currentStatus)
		requiredLabel := GetStatusLabel(transition.RequiredStatus)
		return NewValidationError(ErrTypeStatus,
			fmt.Sprintf("状态冲突：当前状态是%s，此操作需要%s状态", statusLabel, requiredLabel))
	}

	return nil
}

func ValidateEvidence(action models.ProcessAction, attachments []models.Attachment) *ValidationError {
	typeSet := make(map[models.AttachmentType]bool)
	for _, a := range attachments {
		typeSet[a.Type] = true
	}

	switch action {
	case models.ActionApprove:
		if !typeSet[models.AttachCheckinEvidence] {
			return NewValidationError(ErrTypeEvidence, "缺少证据：审核通过需要【旅客值机证据】")
		}
		if !typeSet[models.AttachBaggageEvidence] {
			return NewValidationError(ErrTypeEvidence, "缺少证据：审核通过需要【行李托运证据】")
		}
	case models.ActionConfirmSync:
		if !typeSet[models.AttachCheckinEvidence] {
			return NewValidationError(ErrTypeEvidence, "缺少证据：确认同步需要【旅客值机证据】")
		}
		if !typeSet[models.AttachBaggageEvidence] {
			return NewValidationError(ErrTypeEvidence, "缺少证据：确认同步需要【行李托运证据】")
		}
		if !typeSet[models.AttachExceptionEvidence] {
			return NewValidationError(ErrTypeEvidence, "缺少证据：确认同步需要【异常交接证据】")
		}
	}

	return nil
}

func ValidateDeadline(deadline string, currentHandlerRole models.UserRole, action models.ProcessAction) *ValidationError {
	if action == models.ActionReturn {
		return nil
	}

	warningType := CheckDeadline(deadline)
	if warningType != "overdue" {
		return nil
	}

	roleLabel := GetRoleLabel(currentHandlerRole)
	return NewValidationError(ErrTypeDeadline,
		fmt.Sprintf("已逾期：该记录的处理责任人是%s，截止时间已过，禁止%s操作", roleLabel, GetActionLabel(action)))
}

func ValidateReturnReason(action models.ProcessAction, comment string) *ValidationError {
	if action == models.ActionReturn && comment == "" {
		return NewValidationError(ErrTypeReturnReason, "退回补正必须填写原因")
	}
	return nil
}

func CheckDeadline(deadline string) string {
	t, err := time.Parse("2006-01-02 15:04:05", deadline)
	if err != nil {
		return "overdue"
	}

	now := time.Now()
	hoursLeft := t.Sub(now).Hours()

	if hoursLeft > 72 {
		return "normal"
	}
	if hoursLeft > 24 {
		return "approaching"
	}
	return "overdue"
}

func GetDeadlineInfo(deadline string) (string, string, int) {
	t, err := time.Parse("2006-01-02 15:04:05", deadline)
	if err != nil {
		return "overdue", "截止时间格式错误", 0
	}

	now := time.Now()
	diff := t.Sub(now)
	hoursLeft := diff.Hours()

	var warningType string
	var label string

	if hoursLeft > 72 {
		warningType = "normal"
		days := int(hoursLeft / 24)
		label = fmt.Sprintf("正常，剩余约%d天", days)
	} else if hoursLeft > 24 {
		warningType = "approaching"
		days := int(hoursLeft / 24)
		hours := int(hoursLeft) % 24
		if days > 0 {
			label = fmt.Sprintf("临期，剩余约%d天%d小时", days, hours)
		} else {
			label = fmt.Sprintf("临期，剩余约%d小时", hours)
		}
	} else {
		warningType = "overdue"
		overdueHours := -int(hoursLeft)
		if overdueHours >= 24 {
			days := overdueHours / 24
			label = fmt.Sprintf("已逾期约%d天", days)
		} else {
			label = fmt.Sprintf("已逾期约%d小时", overdueHours)
		}
	}

	return warningType, label, int(hoursLeft)
}

func GetAvailableActions(userRole models.UserRole, currentHandlerRole models.UserRole, currentStatus models.RecordStatus, deadline string, attachments []models.Attachment) []AvailableAction {
	var actions []AvailableAction

	possibleActions := []models.ProcessAction{
		models.ActionSubmit,
		models.ActionCorrect,
		models.ActionApprove,
		models.ActionReturn,
		models.ActionConfirmSync,
	}

	for _, action := range possibleActions {
		aa := AvailableAction{
			Action: action,
			Label:  GetActionLabel(action),
		}

		ctx := &ValidationContext{
			UserRole:           userRole,
			CurrentHandlerRole: currentHandlerRole,
			CurrentStatus:      currentStatus,
			Action:             action,
			RequestVersion:     0,
			RecordVersion:      0,
			Deadline:           deadline,
			Attachments:        attachments,
			Comment:            "dummy",
		}

		verr := ValidateTransition(ctx.UserRole, ctx.CurrentHandlerRole, ctx.CurrentStatus, ctx.Action)
		if verr != nil {
			continue
		}

		aa.Enabled = true
		verr = ValidateEvidence(ctx.Action, ctx.Attachments)
		if verr != nil {
			aa.Enabled = false
			aa.Reason = verr.Message
		}

		verr = ValidateDeadline(ctx.Deadline, ctx.CurrentHandlerRole, ctx.Action)
		if verr != nil {
			aa.Enabled = false
			if aa.Reason != "" {
				aa.Reason += "；" + verr.Message
			} else {
				aa.Reason = verr.Message
			}
		}

		actions = append(actions, aa)
	}

	return actions
}

func GetNextState(action models.ProcessAction) (models.RecordStatus, models.UserRole) {
	transition, ok := validTransitions[action]
	if !ok {
		return "", ""
	}
	return transition.NewStatus, transition.NewHandlerRole
}

func GetRoleLabel(role models.UserRole) string {
	switch role {
	case models.RoleCheckinAgent:
		return "值机员"
	case models.RoleBaggageSupervisor:
		return "行李主管"
	case models.RoleStationManager:
		return "站点经理"
	default:
		return string(role)
	}
}

func GetStatusLabel(status models.RecordStatus) string {
	switch status {
	case models.StatusDraft:
		return "草稿"
	case models.StatusPendingReview:
		return "待审核"
	case models.StatusApproved:
		return "审核通过"
	case models.StatusSynced:
		return "已同步"
	case models.StatusReturned:
		return "退回补正"
	default:
		return string(status)
	}
}

func GetActionLabel(action models.ProcessAction) string {
	switch action {
	case models.ActionSubmit:
		return "提交审核"
	case models.ActionCorrect:
		return "补正提交"
	case models.ActionApprove:
		return "审核通过"
	case models.ActionReturn:
		return "退回补正"
	case models.ActionConfirmSync:
		return "确认同步"
	case models.ActionReject:
		return "驳回"
	default:
		return string(action)
	}
}
