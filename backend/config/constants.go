package config

const (
	RoleCustomerManager = "customer_manager"
	RoleUnderwriter     = "underwriter"
	RoleBusinessOwner   = "business_owner"

	StatusPending      = "待审核"
	StatusApproved     = "审核通过"
	StatusSynced       = "已同步"
	StatusRejected     = "审核退回"
	StatusSupplement   = "待补正"
	StatusCompleted    = "已归档"

	ActionSubmit       = "submit"
	ActionApprove      = "approve"
	ActionReject       = "reject"
	ActionSupplement   = "supplement"
	ActionResubmit     = "resubmit"
	ActionSync         = "sync"
	ActionArchive      = "archive"
)

const (
	WarningNormal   = "normal"
	WarningApproaching = "approaching"
	WarningOverdue  = "overdue"

	ApproachingDays = 3

	EvidenceApplicationForm = "application_form"
	EvidenceIdCard          = "id_card"
	EvidenceIncome          = "income"
	EvidencePolicyConfirm   = "policy_confirm"
)

var RequiredEvidenceByAction = map[string][]string{
	ActionApprove: {EvidenceApplicationForm, EvidenceIdCard, EvidenceIncome},
	ActionSync:    {EvidencePolicyConfirm},
}

var EvidenceCategoryNames = map[string]string{
	EvidenceApplicationForm: "投保单",
	EvidenceIdCard:          "身份证明",
	EvidenceIncome:          "收入证明",
	EvidencePolicyConfirm:   "出单确认书",
}

var ValidRoles = map[string]bool{
	RoleCustomerManager: true,
	RoleUnderwriter:     true,
	RoleBusinessOwner:   true,
}

var RoleNames = map[string]string{
	RoleCustomerManager: "客户经理",
	RoleUnderwriter:     "核保专员",
	RoleBusinessOwner:   "业务负责人",
}

var StatusFlow = map[string][]string{
	StatusPending:    {StatusApproved, StatusRejected, StatusSupplement},
	StatusSupplement: {StatusPending, StatusRejected},
	StatusApproved:   {StatusSynced, StatusCompleted, StatusRejected},
	StatusSynced:     {StatusCompleted},
	StatusRejected:   {},
	StatusCompleted:  {},
}

var RoleActionPermissions = map[string]map[string]bool{
	RoleCustomerManager: {
		ActionSubmit:     true,
		ActionSupplement: true,
		ActionResubmit:   true,
	},
	RoleUnderwriter: {
		ActionApprove: true,
		ActionReject:  true,
	},
	RoleBusinessOwner: {
		ActionSync:    true,
		ActionArchive: true,
	},
}
