package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"consultation-system/internal/config"
	"consultation-system/internal/middleware"
	"consultation-system/internal/models"
	"consultation-system/internal/repository"
	"consultation-system/internal/service"

	"github.com/gofiber/fiber/v2"
)

func CreateConsultation(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "未登录"})
	}
	if user.Role != config.RoleRegistrar {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "只有登记员可以创建会诊申请单"})
	}

	body := &models.Consultation{}
	if err := c.BodyParser(body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数错误: " + err.Error()})
	}

	if body.PatientName == "" || body.PatientID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "患者姓名和病案号必填"})
	}
	if body.ConsultationReason == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "会诊申请原因必填"})
	}
	if body.EvidenceList == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "必须登记至少一项证据材料"})
	}

	body.CreatedBy = user.ID
	body.UpdatedBy = user.ID
	body.CurrentHandler = user.ID

	if err := repository.CreateConsultation(body); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "创建失败: " + err.Error()})
	}

	record := &models.ProcessRecord{
		ConsultationID: body.ID,
		Stage:          config.StageRegistration,
		Action:         "create",
		FromStatus:     "",
		ToStatus:       body.Status,
		HandlerID:      user.ID,
		HandlerName:    user.RealName,
		HandlerRole:    user.Role,
		Remark:         "创建会诊申请单",
		Version:        1,
	}
	_ = repository.CreateProcessRecord(record)

	return c.Status(http.StatusCreated).JSON(body)
}

func GetConsultation(c *fiber.Ctx) error {
	id := c.Params("id")
	consultation, err := repository.GetConsultationByID(id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "会诊申请单不存在"})
	}

	records, _ := repository.GetProcessRecords(id)
	abnormals, _ := repository.GetAbnormalRecords(id)
	attachments, _ := repository.GetAttachments(id)
	auditNotes, _ := repository.GetAuditNotes(id)

	return c.JSON(fiber.Map{
		"consultation":     consultation,
		"process_records":  records,
		"abnormal_records": abnormals,
		"attachments":      attachments,
		"audit_notes":      auditNotes,
	})
}

func ListConsultations(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filter := repository.ConsultationFilter{
		Status:        config.ConsultationStatus(c.Query("status")),
		Stage:         config.ProcessStage(c.Query("stage")),
		Urgency:       config.UrgencyLevel(c.Query("urgency")),
		Department:    c.Query("department"),
		PatientID:     c.Query("patient_id"),
		SearchKeyword: c.Query("keyword"),
	}

	if user.Role == config.RoleRegistrar {
		filter.CreatedBy = user.ID
	} else if user.Role == config.RoleAuditor {
		if stage := c.Query("stage"); stage == "" {
			filter.Stage = config.StageVerification
		}
	}

	isArchivedStr := c.Query("is_archived")
	if isArchivedStr == "true" {
		b := true
		filter.IsArchived = &b
	} else if isArchivedStr == "false" {
		b := false
		filter.IsArchived = &b
	}

	list, total, err := repository.ListConsultations(filter, page, pageSize)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"list":      list,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func UpdateConsultation(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	consultation, err := repository.GetConsultationByID(id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "会诊申请单不存在"})
	}
	if consultation.IsArchived {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "已归档单据不能修改"})
	}
	if consultation.CurrentStage != config.StageRegistration {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "当前阶段不允许修改基本信息"})
	}
	if consultation.CreatedBy != user.ID && user.Role != config.RoleRegistrar {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "只能修改自己创建的单据"})
	}

	body := &models.Consultation{}
	if err := c.BodyParser(body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数错误"})
	}
	version, _ := strconv.Atoi(c.Query("version", "1"))

	consultation.PatientName = body.PatientName
	consultation.PatientID = body.PatientID
	consultation.Age = body.Age
	consultation.Gender = body.Gender
	consultation.Department = body.Department
	consultation.AttendingPhysician = body.AttendingPhysician
	consultation.ConsultationType = body.ConsultationType
	consultation.ConsultationReason = body.ConsultationReason
	consultation.ConsultationDept = body.ConsultationDept
	consultation.RequestedDoctor = body.RequestedDoctor
	consultation.AppointmentTime = body.AppointmentTime
	consultation.Deadline = body.Deadline
	consultation.EvidenceList = body.EvidenceList
	consultation.UpdatedBy = user.ID

	updated, err := repository.UpdateConsultation(consultation, version)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "更新失败"})
	}
	if !updated {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "版本冲突，请刷新后重试"})
	}
	return c.JSON(consultation)
}

type ProcessActionRequest struct {
	Action          string `json:"action"`
	Remark          string `json:"remark"`
	EvidenceUsed    string `json:"evidence_used"`
	ExpectedVersion int    `json:"expected_version"`
	AbnormalType    string `json:"abnormal_type"`
	AbnormalReason  string `json:"abnormal_reason"`
}

func ProcessAction(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	req := &ProcessActionRequest{}
	if err := c.BodyParser(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数错误"})
	}
	if req.Action == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "必须指定操作类型"})
	}

	procReq := service.ProcessRequest{
		ConsultationID:  id,
		Action:          req.Action,
		Remark:          req.Remark,
		EvidenceUsed:    req.EvidenceUsed,
		ExpectedVersion: req.ExpectedVersion,
		AbnormalType:    req.AbnormalType,
		AbnormalReason:  req.AbnormalReason,
		HandlerID:       user.ID,
		HandlerName:     user.RealName,
		HandlerRole:     user.Role,
	}
	result, err := service.ProcessConsultation(procReq)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if !result.Success {
		return c.Status(fiber.StatusBadRequest).JSON(result)
	}
	return c.JSON(result)
}

func BatchProcess(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	req := &service.BatchProcessRequest{}
	if err := c.BodyParser(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数错误"})
	}
	if len(req.IDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请选择要处理的单据"})
	}
	if req.Action == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "必须指定操作类型"})
	}

	results := service.BatchProcess(*req, user.ID, user.RealName, user.Role)
	successCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		}
	}
	return c.JSON(fiber.Map{
		"total":         len(results),
		"success_count": successCount,
		"fail_count":    len(results) - successCount,
		"details":       results,
	})
}

func AddAuditNote(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	body := struct {
		Note string `json:"note"`
	}{}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数错误"})
	}
	if strings.TrimSpace(body.Note) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "备注内容不能为空"})
	}

	note := &models.AuditNote{
		ConsultationID: id,
		Note:           body.Note,
		CreatedBy:      user.RealName,
	}
	if err := repository.CreateAuditNote(note); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "添加备注失败"})
	}
	return c.JSON(note)
}

func AddAttachment(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	body := &models.Attachment{}
	if err := c.BodyParser(body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数错误"})
	}
	if body.FileName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "文件名不能为空"})
	}

	body.ConsultationID = id
	body.UploadedBy = user.RealName

	if err := repository.CreateAttachment(body); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "添加附件失败"})
	}
	return c.JSON(body)
}

func GetStatistics(c *fiber.Ctx) error {
	stats, err := repository.GetStatistics()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(stats)
}

func GetLedger(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "50"))

	b := true
	filter := repository.ConsultationFilter{
		IsArchived:    &b,
		SearchKeyword: c.Query("keyword"),
		PatientID:     c.Query("patient_id"),
	}

	list, total, err := repository.ListConsultations(filter, page, pageSize)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	ledgerList := make([]fiber.Map, 0, len(list))
	for _, item := range list {
		records, _ := repository.GetProcessRecords(item.ID)
		abnormals, _ := repository.GetAbnormalRecords(item.ID)
		ledgerList = append(ledgerList, fiber.Map{
			"consultation":      item,
			"process_count":     len(records),
			"abnormal_count":    len(abnormals),
			"schedule_verified": item.ScheduleVerified,
			"feedback_verified": item.FeedbackVerified,
		})
	}

	return c.JSON(fiber.Map{
		"list":      ledgerList,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func GetWarningList(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))
	urgency := c.Query("urgency")

	bFalse := false
	filter := repository.ConsultationFilter{
		IsArchived: &bFalse,
	}
	if urgency != "" {
		filter.Urgency = config.UrgencyLevel(urgency)
	}

	list, total, err := repository.ListConsultations(filter, page, pageSize)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	normalList := []models.Consultation{}
	warningList := []models.Consultation{}
	overdueList := []models.Consultation{}
	for _, item := range list {
		switch item.Urgency {
		case config.UrgencyOverdue:
			overdueList = append(overdueList, item)
		case config.UrgencyWarning:
			warningList = append(warningList, item)
		default:
			normalList = append(normalList, item)
		}
	}

	return c.JSON(fiber.Map{
		"total":         total,
		"normal_list":   normalList,
		"warning_list":  warningList,
		"overdue_list":  overdueList,
		"normal_count":  len(normalList),
		"warning_count": len(warningList),
		"overdue_count": len(overdueList),
	})
}
