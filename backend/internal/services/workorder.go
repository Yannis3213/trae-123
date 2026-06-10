package services

import (
	"errors"
	"time"

	"aviation-ground-service/internal/models"
)

var (
	ErrInvalidTransition    = errors.New("无效的状态转换")
	ErrWrongRole            = errors.New("当前角色无权执行此操作")
	ErrMissingEvidence      = errors.New("缺少必要的证据附件")
	ErrReturnReasonRequired = errors.New("退回补正必须填写原因")
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

func ValidateTransition(userRole models.UserRole, currentHandlerRole models.UserRole, currentStatus models.RecordStatus, action models.ProcessAction) error {
	transition, ok := validTransitions[action]
	if !ok {
		return ErrInvalidTransition
	}

	if userRole != transition.RequiredRole {
		return ErrWrongRole
	}

	if userRole != currentHandlerRole {
		return ErrWrongRole
	}

	if currentStatus != transition.RequiredStatus {
		return ErrInvalidTransition
	}

	return nil
}

func ValidateEvidence(action models.ProcessAction, attachments []models.Attachment) error {
	typeSet := make(map[models.AttachmentType]bool)
	for _, a := range attachments {
		typeSet[a.Type] = true
	}

	switch action {
	case models.ActionApprove:
		if !typeSet[models.AttachCheckinEvidence] {
			return errors.New("审核通过需要旅客值机证据")
		}
		if !typeSet[models.AttachBaggageEvidence] {
			return errors.New("审核通过需要行李托运证据")
		}
	case models.ActionConfirmSync:
		if !typeSet[models.AttachCheckinEvidence] {
			return errors.New("确认同步需要旅客值机证据")
		}
		if !typeSet[models.AttachBaggageEvidence] {
			return errors.New("确认同步需要行李托运证据")
		}
		if !typeSet[models.AttachExceptionEvidence] {
			return errors.New("确认同步需要异常交接证据")
		}
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

func GetNextState(action models.ProcessAction) (models.RecordStatus, models.UserRole) {
	transition, ok := validTransitions[action]
	if !ok {
		return "", ""
	}
	return transition.NewStatus, transition.NewHandlerRole
}
