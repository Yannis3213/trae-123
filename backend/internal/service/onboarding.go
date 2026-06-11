package service

import (
	"errors"
	"fmt"
	"time"

	"hr-onboarding/internal/database"
	"hr-onboarding/internal/models"
)

var (
	ErrInvalidVersion    = errors.New("版本冲突")
	ErrInvalidStatus     = errors.New("状态不匹配")
	ErrInvalidRole       = errors.New("角色无权操作")
	ErrMissingAttachment = errors.New("缺少必填附件")
	ErrAlreadyProcessed  = errors.New("单据已被处理")
)

type ProcessValidation struct {
	Valid  bool
	Reason string
	Code   int
}

func ValidateProcess(order *models.OnboardingOrder, user *models.User, req *models.ProcessRequest, action string) ProcessValidation {
	if order.Version != req.Version {
		return ProcessValidation{
			Valid:  false,
			Reason: fmt.Sprintf("版本冲突：当前版本 %d，提交版本 %d，请刷新后重试", order.Version, req.Version),
			Code:   409,
		}
	}

	if order.Status == models.StatusClosed || order.Status == models.StatusCompleted {
		return ProcessValidation{
			Valid:  false,
			Reason: fmt.Sprintf("状态冲突：单据当前状态为 %s，无法进行 %s 操作", StatusName(order.Status), action),
			Code:   409,
		}
	}

	if order.CurrentRole != user.Role {
		return ProcessValidation{
			Valid:  false,
			Reason: fmt.Sprintf("权限不足：当前处理角色应为 %s，您的角色是 %s", roleName(order.CurrentRole), roleName(user.Role)),
			Code:   403,
		}
	}

	switch action {
	case "claim":
		if order.HandlerID != "" && order.HandlerID != user.ID {
			return ProcessValidation{
				Valid:  false,
				Reason: fmt.Sprintf("单据已被 %s 认领，无法重复认领", order.HandlerName),
				Code:   409,
			}
		}
	case "approve", "return", "close":
		if order.HandlerID == "" {
			return ProcessValidation{
				Valid:  false,
				Reason: "单据未被认领，请先认领后再操作",
				Code:   400,
			}
		}
		if order.HandlerID != user.ID {
			return ProcessValidation{
				Valid:  false,
				Reason: fmt.Sprintf("单据由 %s 负责，您无权操作", order.HandlerName),
				Code:   403,
			}
		}
	case "submit":
		if order.Status != models.StatusPending && order.Status != models.StatusReturned {
			return ProcessValidation{
				Valid:  false,
				Reason: fmt.Sprintf("状态冲突：当前状态为 %s，无法提交", StatusName(order.Status)),
				Code:   409,
			}
		}
	}

	if action == "approve" || action == "submit" {
		if missing := checkMissingAttachments(order.ID, order.CurrentNode); len(missing) > 0 {
			return ProcessValidation{
				Valid:  false,
				Reason: fmt.Sprintf("缺少必填附件：%s", formatMissingAttachments(missing)),
				Code:   400,
			}
		}
	}

	return ProcessValidation{Valid: true}
}

func checkMissingAttachments(orderID, node string) []string {
	required := database.GetRequiredAttachmentTypes(node)
	attachments, err := database.GetAttachmentsByOrder(orderID)
	if err != nil {
		return required
	}

	has := make(map[string]bool)
	for _, a := range attachments {
		if a.Node == node {
			has[a.Type] = true
		}
	}

	var missing []string
	for _, r := range required {
		if !has[r] {
			missing = append(missing, attachmentTypeName(r))
		}
	}
	return missing
}

func attachmentTypeName(typ string) string {
	names := map[string]string{
		"id_card":          "身份证",
		"diploma":          "学历证书",
		"resignation_cert": "离职证明",
		"offer":            "Offer Letter",
		"contract":         "劳动合同",
		"system_access":    "系统权限开通单",
		"email_account":    "邮箱账号开通单",
	}
	if n, ok := names[typ]; ok {
		return n
	}
	return typ
}

func formatMissingAttachments(types []string) string {
	result := ""
	for i, t := range types {
		if i > 0 {
			result += "、"
		}
		result += t
	}
	return result
}

func roleName(role string) string {
	names := map[string]string{
		models.RoleRegistrar: "入职办理登记员",
		models.RoleAuditor:   "入职办理审核主管",
		models.RoleReviewer:  "企业人事共享中心复核负责人",
	}
	if n, ok := names[role]; ok {
		return n
	}
	return role
}

func ProcessOrder(order *models.OnboardingOrder, user *models.User, action, remark string) error {
	fromStatus := order.Status
	fromNode := order.CurrentNode
	exceptionType := ""

	var toStatus, toNode, toRole string
	var handlerID, handlerName string

	switch action {
	case "submit":
		toStatus = models.StatusProcessing
		if order.Status == models.StatusReturned && order.CurrentNode != models.NodeDocs {
			toNode = order.CurrentNode
			toRole = nodeRole(order.CurrentNode)
		} else {
			toNode = nextNode(order.CurrentNode)
			toRole = nextRole(order.CurrentNode)
		}
		handlerID = ""
		handlerName = ""
	case "claim":
		toStatus = models.StatusProcessing
		toNode = order.CurrentNode
		toRole = user.Role
		handlerID = user.ID
		handlerName = user.Name
	case "approve":
		if isLastNode(order.CurrentNode) {
			toStatus = models.StatusCompleted
			toNode = order.CurrentNode
			toRole = ""
			handlerID = ""
			handlerName = ""
		} else {
			toStatus = models.StatusProcessing
			toNode = nextNode(order.CurrentNode)
			toRole = nextRole(order.CurrentNode)
			handlerID = ""
			handlerName = ""
		}
	case "return":
		toStatus = models.StatusReturned
		toNode = order.CurrentNode
		toRole = models.RoleRegistrar
		handlerID = order.RegistrarID
		handlerName = order.RegistrarName
		exceptionType = "returned"
	case "close":
		toStatus = models.StatusClosed
		toNode = order.CurrentNode
		toRole = ""
		handlerID = ""
		handlerName = ""
	}

	order.Status = toStatus
	order.CurrentNode = toNode
	order.CurrentRole = toRole
	order.HandlerID = handlerID
	order.HandlerName = handlerName
	order.Version += 1

	if isOverdue(order.DueDate) || isNearDue(order.DueDate) {
		order.IsException = true
		if exceptionType == "" {
			exceptionType = "overdue"
		}
	}

	if err := database.UpdateOrder(order); err != nil {
		return err
	}

	record := &models.ProcessRecord{
		OrderID:       order.ID,
		Node:          fromNode,
		Action:        action,
		OperatorID:    user.ID,
		OperatorName:  user.Name,
		OperatorRole:  user.Role,
		FromStatus:    fromStatus,
		ToStatus:      toStatus,
		FromNode:      fromNode,
		ToNode:        toNode,
		Remark:        remark,
		ExceptionType: exceptionType,
	}
	if err := database.CreateProcessRecord(record); err != nil {
		return err
	}

	statusLabels := map[string]string{
		models.StatusPending:    "待派发",
		models.StatusProcessing: "处理中",
		models.StatusReturned:   "处理中",
		models.StatusCompleted:  "已关闭",
		models.StatusClosed:     "已关闭",
	}

	actionLabels := map[string]string{
		"submit":  "提交",
		"claim":   "认领",
		"approve": "通过",
		"return":  "退回",
		"close":   "关闭",
	}

	note := &models.AuditNote{
		OrderID:       order.ID,
		StatusLabel:   statusLabels[toStatus],
		Content:       fmt.Sprintf("%s操作：%s；备注：%s", roleName(user.Role), actionLabels[action], remark),
		CreatedBy:     user.ID,
		CreatedByName: user.Name,
	}
	if err := database.CreateAuditNote(note); err != nil {
		return err
	}

	return nil
}

func nextNode(current string) string {
	switch current {
	case models.NodeDocs:
		return models.NodeContract
	case models.NodeContract:
		return models.NodeAccount
	default:
		return current
	}
}

func nextRole(currentNode string) string {
	switch currentNode {
	case models.NodeDocs:
		return models.RoleAuditor
	case models.NodeContract:
		return models.RoleReviewer
	case models.NodeAccount:
		return models.RoleReviewer
	default:
		return models.RoleRegistrar
	}
}

func isLastNode(node string) bool {
	return node == models.NodeAccount
}

func nodeRole(node string) string {
	switch node {
	case models.NodeDocs:
		return models.RoleRegistrar
	case models.NodeContract:
		return models.RoleAuditor
	case models.NodeAccount:
		return models.RoleReviewer
	default:
		return models.RoleRegistrar
	}
}

func isOverdue(dueDate time.Time) bool {
	return time.Now().After(dueDate)
}

func isNearDue(dueDate time.Time) bool {
	return time.Until(dueDate) < 3*24*time.Hour && time.Until(dueDate) > 0
}

func CalcWarningLevel(dueDate time.Time) string {
	diff := time.Until(dueDate)
	if diff < 0 {
		return models.WarningOverdue
	}
	if diff < 3*24*time.Hour {
		return models.WarningNear
	}
	return models.WarningNormal
}

func RoleName(role string) string {
	return roleName(role)
}

func NodeName(node string) string {
	names := map[string]string{
		models.NodeDocs:     "入职资料",
		models.NodeContract: "合同签署",
		models.NodeAccount:  "账号开通",
	}
	if n, ok := names[node]; ok {
		return n
	}
	return node
}

func StatusName(status string) string {
	names := map[string]string{
		models.StatusPending:    "待派发",
		models.StatusProcessing: "处理中",
		models.StatusReturned:   "退回补正",
		models.StatusCompleted:  "已完成",
		models.StatusClosed:     "已关闭",
	}
	if n, ok := names[status]; ok {
		return n
	}
	return status
}
