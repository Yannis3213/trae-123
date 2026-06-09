package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"consultation-system/internal/config"
	"consultation-system/internal/models"
	"consultation-system/internal/repository"
)

type ProcessRequest struct {
	ConsultationID  string
	Action          string
	Remark          string
	EvidenceUsed    string
	ExpectedVersion int
	AbnormalType    string
	AbnormalReason  string
	HandlerID       string
	HandlerName     string
	HandlerRole     config.Role
}

type ProcessResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	ID      string `json:"id,omitempty"`
}

func calculateUrgency(deadline *time.Time) config.UrgencyLevel {
	if deadline == nil {
		return config.UrgencyNormal
	}
	now := time.Now()
	if now.After(*deadline) {
		return config.UrgencyOverdue
	}
	diff := deadline.Sub(now)
	if diff < 24*time.Hour {
		return config.UrgencyWarning
	}
	return config.UrgencyNormal
}

func canPerformAction(role config.Role, stage config.ProcessStage, action string) bool {
	switch role {
	case config.RoleRegistrar:
		if stage != config.StageRegistration {
			return false
		}
		return action == "submit" || action == "correct" || action == "withdraw"
	case config.RoleAuditor:
		if stage != config.StageVerification {
			return false
		}
		return action == "verify_pass" || action == "verify_fail" || action == "return" || action == "mark_abnormal"
	case config.RoleReviewer:
		if stage != config.StageReview {
			return false
		}
		return action == "review_pass" || action == "review_fail" || action == "archive" || action == "return"
	}
	return false
}

func validateEvidence(c *models.Consultation, evidenceUsed string, stage config.ProcessStage) error {
	if evidenceUsed == "" {
		return errors.New("必须提供处理证据")
	}
	evidenceList := strings.Split(c.EvidenceList, ",")
	usedList := strings.Split(evidenceUsed, ",")
	for _, used := range usedList {
		used = strings.TrimSpace(used)
		if used == "" {
			continue
		}
		found := false
		for _, avail := range evidenceList {
			if strings.TrimSpace(avail) == used {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("证据 %s 不在已登记的证据列表中", used)
		}
	}
	return nil
}

func ProcessConsultation(req ProcessRequest) (*ProcessResult, error) {
	c, err := repository.GetConsultationByID(req.ConsultationID)
	if err != nil {
		return &ProcessResult{Success: false, Message: "会诊申请单不存在"}, err
	}

	if c.IsArchived {
		return &ProcessResult{Success: false, Message: "该单据已归档，无法操作"}, nil
	}

	if c.Version != req.ExpectedVersion {
		return &ProcessResult{Success: false, Message: fmt.Sprintf("版本冲突：当前版本为 %d，您基于 %d 操作，请刷新后重试", c.Version, req.ExpectedVersion)}, nil
	}

	if !canPerformAction(req.HandlerRole, c.CurrentStage, req.Action) {
		return &ProcessResult{Success: false, Message: fmt.Sprintf("当前角色无权限在 %s 阶段执行 %s 操作", c.CurrentStage, req.Action)}, nil
	}

	fromStatus := c.Status
	record := &models.ProcessRecord{
		ConsultationID: c.ID,
		Stage:          c.CurrentStage,
		Action:         req.Action,
		FromStatus:     fromStatus,
		HandlerID:      req.HandlerID,
		HandlerName:    req.HandlerName,
		HandlerRole:    req.HandlerRole,
		Remark:         req.Remark,
		EvidenceUsed:   req.EvidenceUsed,
		Version:        c.Version,
	}

	switch req.Action {
	case "submit":
		if err := validateEvidence(c, req.EvidenceUsed, config.StageRegistration); err != nil {
			return &ProcessResult{Success: false, Message: err.Error()}, nil
		}
		c.Status = config.StatusPending
		c.CurrentStage = config.StageVerification
		c.CurrentHandler = ""
		c.Urgency = calculateUrgency(c.Deadline)
		record.ToStatus = config.StatusPending

	case "correct":
		if err := validateEvidence(c, req.EvidenceUsed, config.StageRegistration); err != nil {
			return &ProcessResult{Success: false, Message: err.Error()}, nil
		}
		c.Status = config.StatusPending
		c.CurrentStage = config.StageVerification
		c.Urgency = calculateUrgency(c.Deadline)
		record.ToStatus = config.StatusPending
		if req.AbnormalReason != "" {
			abnormal := &models.AbnormalRecord{
				ConsultationID: c.ID,
				AbnormalType:   req.AbnormalType,
				Reason:         "补正说明: " + req.AbnormalReason,
				ReportedBy:     req.HandlerID,
			}
			if err := repository.CreateAbnormalRecord(abnormal); err != nil {
				return nil, err
			}
		}

	case "withdraw":
		return &ProcessResult{Success: false, Message: "撤回功能暂未开放"}, nil

	case "verify_pass":
		if err := validateEvidence(c, req.EvidenceUsed, config.StageVerification); err != nil {
			return &ProcessResult{Success: false, Message: err.Error()}, nil
		}
		c.Status = config.StatusRechecked
		c.CurrentStage = config.StageReview
		c.CurrentHandler = ""
		c.ScheduleVerified = true
		record.ToStatus = config.StatusRechecked

	case "verify_fail", "mark_abnormal":
		if req.AbnormalReason == "" {
			return &ProcessResult{Success: false, Message: "标记异常必须填写异常原因"}, nil
		}
		c.Status = config.StatusAbnormal
		abnormal := &models.AbnormalRecord{
			ConsultationID: c.ID,
			AbnormalType:   req.AbnormalType,
			Reason:         req.AbnormalReason,
			ReportedBy:     req.HandlerID,
		}
		if err := repository.CreateAbnormalRecord(abnormal); err != nil {
			return nil, err
		}
		record.ToStatus = config.StatusAbnormal

	case "return":
		if req.AbnormalReason == "" {
			return &ProcessResult{Success: false, Message: "退回必须填写退回原因"}, nil
		}
		c.Status = config.StatusAbnormal
		c.CurrentStage = config.StageRegistration
		abnormal := &models.AbnormalRecord{
			ConsultationID: c.ID,
			AbnormalType:   "退回补正",
			Reason:         req.AbnormalReason,
			ReportedBy:     req.HandlerID,
		}
		if err := repository.CreateAbnormalRecord(abnormal); err != nil {
			return nil, err
		}
		record.ToStatus = config.StatusAbnormal

	case "review_pass":
		if err := validateEvidence(c, req.EvidenceUsed, config.StageReview); err != nil {
			return &ProcessResult{Success: false, Message: err.Error()}, nil
		}
		c.Status = config.StatusRechecked
		c.FeedbackVerified = true
		record.ToStatus = config.StatusRechecked

	case "review_fail":
		if req.AbnormalReason == "" {
			return &ProcessResult{Success: false, Message: "复核不通过必须填写原因"}, nil
		}
		c.Status = config.StatusAbnormal
		c.CurrentStage = config.StageVerification
		abnormal := &models.AbnormalRecord{
			ConsultationID: c.ID,
			AbnormalType:   "复核不通过",
			Reason:         req.AbnormalReason,
			ReportedBy:     req.HandlerID,
		}
		if err := repository.CreateAbnormalRecord(abnormal); err != nil {
			return nil, err
		}
		record.ToStatus = config.StatusAbnormal

	case "archive":
		if c.Status != config.StatusRechecked {
			return &ProcessResult{Success: false, Message: "只有已复查状态才能归档"}, nil
		}
		if err := validateEvidence(c, req.EvidenceUsed, config.StageReview); err != nil {
			return &ProcessResult{Success: false, Message: err.Error()}, nil
		}
		c.Status = config.StatusArchived
		c.IsArchived = true
		c.FeedbackVerified = true
		record.ToStatus = config.StatusArchived
	}

	c.UpdatedBy = req.HandlerID

	updated, err := repository.UpdateConsultation(c, req.ExpectedVersion)
	if err != nil {
		return nil, err
	}
	if !updated {
		return &ProcessResult{Success: false, Message: "版本冲突，请刷新后重试"}, nil
	}

	if err := repository.CreateProcessRecord(record); err != nil {
		return nil, err
	}

	return &ProcessResult{Success: true, Message: "操作成功", ID: c.ID}, nil
}

type BatchProcessRequest struct {
	IDs              []string       `json:"ids"`
	Action           string         `json:"action"`
	Remark           string         `json:"remark"`
	EvidenceUsed     string         `json:"evidence_used"`
	ExpectedVersions map[string]int `json:"expected_versions"`
	AbnormalType     string         `json:"abnormal_type"`
	AbnormalReason   string         `json:"abnormal_reason"`
}

func BatchProcess(req BatchProcessRequest, handlerID, handlerName string, handlerRole config.Role) []ProcessResult {
	results := make([]ProcessResult, 0, len(req.IDs))
	for _, id := range req.IDs {
		version, ok := req.ExpectedVersions[id]
		if !ok {
			version = 1
		}
		procReq := ProcessRequest{
			ConsultationID:  id,
			Action:          req.Action,
			Remark:          req.Remark,
			EvidenceUsed:    req.EvidenceUsed,
			ExpectedVersion: version,
			AbnormalType:    req.AbnormalType,
			AbnormalReason:  req.AbnormalReason,
			HandlerID:       handlerID,
			HandlerName:     handlerName,
			HandlerRole:     handlerRole,
		}
		result, _ := ProcessConsultation(procReq)
		if result == nil {
			result = &ProcessResult{Success: false, Message: "处理失败", ID: id}
		}
		results = append(results, *result)
	}
	return results
}
