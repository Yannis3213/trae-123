package seed

import (
	"fmt"
	"log"
	"time"

	"consultation-system/internal/config"
	"consultation-system/internal/models"
	"consultation-system/internal/repository"
)

func SeedDemoData() {
	users := []struct {
		user     models.User
		password string
	}{
		{
			user: models.User{
				Username:   "registrar1",
				RealName:   "张秘书",
				Role:       config.RoleRegistrar,
				Department: "内科",
			},
			password: "123456",
		},
		{
			user: models.User{
				Username:   "auditor1",
				RealName:   "李质控",
				Role:       config.RoleAuditor,
				Department: "质控科",
			},
			password: "123456",
		},
		{
			user: models.User{
				Username:   "reviewer1",
				RealName:   "王主任",
				Role:       config.RoleReviewer,
				Department: "医务部",
			},
			password: "123456",
		},
	}

	for _, u := range users {
		existing, _ := repository.GetUserByUsername(u.user.Username)
		if existing == nil {
			if err := repository.CreateUser(&u.user, u.password); err != nil {
				log.Printf("创建用户失败: %v", err)
			} else {
				log.Printf("创建演示用户: %s (%s)", u.user.Username, u.user.RealName)
			}
		}
	}

	regUser, _ := repository.GetUserByUsername("registrar1")
	audUser, _ := repository.GetUserByUsername("auditor1")
	revUser, _ := repository.GetUserByUsername("reviewer1")
	if regUser == nil || audUser == nil || revUser == nil {
		return
	}

	now := time.Now()

	demos := []struct {
		c              models.Consultation
		processRecords []models.ProcessRecord
		abnormals      []models.AbnormalRecord
		notes          []string
	}{
		{
			c: models.Consultation{
				PatientName:        "张三",
				PatientID:          "P001",
				Age:                55,
				Gender:             "男",
				Department:         "内科",
				AttendingPhysician: "陈医生",
				ConsultationType:   "科间会诊",
				ConsultationReason: "胸闷胸痛3天，疑似冠心病，需心内科会诊协助诊疗方案",
				ConsultationDept:   "心内科",
				RequestedDoctor:    "赵主任",
				Urgency:            config.UrgencyNormal,
				Status:             config.StatusPending,
				CurrentStage:       config.StageRegistration,
				CurrentHandler:     regUser.ID,
				Version:            1,
				EvidenceList:       "病历,心电图,心肌酶谱",
				CreatedBy:          regUser.ID,
				UpdatedBy:          regUser.ID,
				Deadline:           timePtr(now.Add(48 * time.Hour)),
			},
			processRecords: []models.ProcessRecord{
				{
					Stage:       config.StageRegistration,
					Action:      "create",
					ToStatus:    config.StatusPending,
					HandlerID:   regUser.ID,
					HandlerName: regUser.RealName,
					HandlerRole: regUser.Role,
					Remark:      "创建会诊申请单，患者胸痛原因待查",
					Version:     1,
				},
				{
					Stage:        config.StageRegistration,
					Action:       "create",
					FromStatus:   config.StatusPending,
					ToStatus:     config.StatusPending,
					HandlerID:    regUser.ID,
					HandlerName:  regUser.RealName,
					HandlerRole:  regUser.Role,
					Remark:       "补充心肌酶谱证据，完善登记信息",
					EvidenceUsed: "病历,心电图",
					Version:      1,
				},
			},
			notes: []string{"月底集中处理批次-1号", "患者医保身份已核验"},
		},
		{
			c: models.Consultation{
				PatientName:        "李四",
				PatientID:          "P002",
				Age:                42,
				Gender:             "女",
				Department:         "外科",
				AttendingPhysician: "刘医生",
				ConsultationType:   "紧急会诊",
				ConsultationReason: "术后第3天发热38.8℃，怀疑切口感染或肺部感染，需感染科会诊",
				ConsultationDept:   "感染科",
				RequestedDoctor:    "孙医生",
				Urgency:            config.UrgencyWarning,
				Status:             config.StatusAbnormal,
				CurrentStage:       config.StageVerification,
				CurrentHandler:     audUser.ID,
				Version:            2,
				EvidenceList:       "手术记录,血常规",
				CreatedBy:          regUser.ID,
				UpdatedBy:          audUser.ID,
				Deadline:           timePtr(now.Add(-2 * time.Hour)),
			},
			processRecords: []models.ProcessRecord{
				{
					Stage:       config.StageRegistration,
					Action:      "create",
					ToStatus:    config.StatusPending,
					HandlerID:   regUser.ID,
					HandlerName: regUser.RealName,
					HandlerRole: regUser.Role,
					Remark:      "紧急会诊申请：外科术后发热",
					Version:     1,
				},
				{
					Stage:        config.StageRegistration,
					Action:       "submit",
					FromStatus:   config.StatusPending,
					ToStatus:     config.StatusPending,
					HandlerID:    regUser.ID,
					HandlerName:  regUser.RealName,
					HandlerRole:  regUser.Role,
					Remark:       "登记员提交审核，材料齐全",
					EvidenceUsed: "手术记录,血常规",
					Version:      1,
				},
				{
					Stage:        config.StageVerification,
					Action:       "verify_fail",
					FromStatus:   config.StatusPending,
					ToStatus:     config.StatusAbnormal,
					HandlerID:    audUser.ID,
					HandlerName:  audUser.RealName,
					HandlerRole:  audUser.Role,
					Remark:       "核验异常：缺少体温单和胸片报告；异常：缺材料",
					EvidenceUsed: "手术记录,血常规",
					Version:      2,
				},
			},
			abnormals: []models.AbnormalRecord{
				{
					AbnormalType: "缺材料",
					Reason:       "缺少体温单和胸片报告，感染诊断依据不足，请登记员补充相关检查报告后重新提交",
					ReportedBy:   audUser.ID,
					IsResolved:   false,
				},
			},
			notes: []string{"紧急会诊注意24小时内完成，目前已超时2小时"},
		},
		{
			c: models.Consultation{
				PatientName:        "王五",
				PatientID:          "P003",
				Age:                68,
				Gender:             "男",
				Department:         "神经内科",
				AttendingPhysician: "周医生",
				ConsultationType:   "多学科会诊",
				ConsultationReason: "突发右侧肢体无力伴言语不清6小时，头CT未见出血，疑似急性缺血性脑卒中",
				ConsultationDept:   "放射科,神经外科",
				RequestedDoctor:    "钱主任,吴主任",
				Urgency:            config.UrgencyOverdue,
				Status:             config.StatusRechecked,
				CurrentStage:       config.StageReview,
				CurrentHandler:     "",
				Version:            4,
				EvidenceList:       "CT片,MRI报告,病历,凝血功能",
				CreatedBy:          regUser.ID,
				UpdatedBy:          audUser.ID,
				Deadline:           timePtr(now.Add(-48 * time.Hour)),
				ScheduleVerified:   true,
			},
			processRecords: []models.ProcessRecord{
				{
					Stage:       config.StageRegistration,
					Action:      "create",
					ToStatus:    config.StatusPending,
					HandlerID:   regUser.ID,
					HandlerName: regUser.RealName,
					HandlerRole: regUser.Role,
					Remark:      "创建多学科会诊申请：脑卒中待确诊",
					Version:     1,
				},
				{
					Stage:        config.StageRegistration,
					Action:       "submit",
					FromStatus:   config.StatusPending,
					ToStatus:     config.StatusPending,
					HandlerID:    regUser.ID,
					HandlerName:  regUser.RealName,
					HandlerRole:  regUser.Role,
					Remark:       "登记员提交多学科会诊审核",
					EvidenceUsed: "CT片,MRI报告,病历",
					Version:      1,
				},
				{
					Stage:        config.StageVerification,
					Action:       "mark_abnormal",
					FromStatus:   config.StatusPending,
					ToStatus:     config.StatusAbnormal,
					HandlerID:    audUser.ID,
					HandlerName:  audUser.RealName,
					HandlerRole:  audUser.Role,
					Remark:       "核验异常：超时；异常：缺少凝血功能检查，已逾期24小时",
					EvidenceUsed: "CT片,MRI报告",
					Version:      2,
				},
				{
					Stage:        config.StageRegistration,
					Action:       "correct",
					FromStatus:   config.StatusAbnormal,
					ToStatus:     config.StatusPending,
					HandlerID:    regUser.ID,
					HandlerName:  regUser.RealName,
					HandlerRole:  regUser.Role,
					Remark:       "补正说明：补充凝血功能报告后重新提交；超时节点责任：质控科李质控",
					EvidenceUsed: "CT片,MRI报告,病历,凝血功能",
					Version:      3,
				},
				{
					Stage:        config.StageVerification,
					Action:       "verify_pass",
					FromStatus:   config.StatusPending,
					ToStatus:     config.StatusRechecked,
					HandlerID:    audUser.ID,
					HandlerName:  audUser.RealName,
					HandlerRole:  audUser.Role,
					Remark:       "质控核验通过，排班、证据已核验；注意已逾期48小时，节点超时责任人：质控科李质控",
					EvidenceUsed: "CT片,MRI报告,病历,凝血功能",
					Version:      4,
				},
			},
			abnormals: []models.AbnormalRecord{
				{
					AbnormalType: "超时/逾期",
					Reason:       "多学科会诊节点超时48小时，节点责任人：质控科李质控。首次核验缺少凝血功能证据导致退回补正延误。",
					ReportedBy:   audUser.ID,
					IsResolved:   true,
					Resolution:   "登记员补正提交，质控已复核通过，流转至医务部",
				},
			},
			notes: []string{"超期48小时重点督办，月底集中处理逾期责任考核项", "多学科会诊排班已核验：放射科钱主任、神经外科吴主任均已确认参会"},
		},
		{
			c: models.Consultation{
				PatientName:        "赵六",
				PatientID:          "P004",
				Age:                30,
				Gender:             "女",
				Department:         "妇产科",
				AttendingPhysician: "郑医生",
				ConsultationType:   "科间会诊",
				ConsultationReason: "孕28周，血压150/100mmHg，尿蛋白(++)，诊断妊娠期高血压，需心内科评估心功能",
				ConsultationDept:   "心内科",
				RequestedDoctor:    "冯主任",
				Urgency:            config.UrgencyWarning,
				Status:             config.StatusPending,
				CurrentStage:       config.StageVerification,
				CurrentHandler:     "",
				Version:            1,
				EvidenceList:       "产检记录,血压监测,尿常规,心电图",
				CreatedBy:          regUser.ID,
				UpdatedBy:          regUser.ID,
				Deadline:           timePtr(now.Add(6 * time.Hour)),
			},
			processRecords: []models.ProcessRecord{
				{
					Stage:       config.StageRegistration,
					Action:      "create",
					ToStatus:    config.StatusPending,
					HandlerID:   regUser.ID,
					HandlerName: regUser.RealName,
					HandlerRole: regUser.Role,
					Remark:      "创建会诊申请：妊娠合并高血压",
					Version:     1,
				},
				{
					Stage:        config.StageRegistration,
					Action:       "submit",
					FromStatus:   config.StatusPending,
					ToStatus:     config.StatusPending,
					HandlerID:    regUser.ID,
					HandlerName:  regUser.RealName,
					HandlerRole:  regUser.Role,
					Remark:       "登记员提交审核，产检和血压监测资料齐全",
					EvidenceUsed: "产检记录,血压监测,尿常规",
					Version:      1,
				},
			},
			notes: []string{"临期预警：6小时内需完成质控核验"},
		},
	}

	for i, d := range demos {
		demoID := "demo-" + fmt.Sprint(i+1)
		existing, _ := repository.GetConsultationByID(demoID)
		if existing != nil {
			continue
		}
		d.c.ID = demoID
		if err := repository.CreateConsultation(&d.c); err != nil {
			log.Printf("创建演示会诊单失败 [%s]: %v", d.c.PatientName, err)
			continue
		}
		log.Printf("创建演示会诊单: %s (病案号: %s)", d.c.PatientName, d.c.PatientID)

		for _, pr := range d.processRecords {
			pr.ConsultationID = d.c.ID
			if pr.CreatedAt.IsZero() {
				pr.CreatedAt = now.Add(-time.Duration(10-i) * time.Hour)
			}
			if err := repository.CreateProcessRecord(&pr); err != nil {
				log.Printf("创建处理记录失败: %v", err)
			}
		}
		for _, ab := range d.abnormals {
			ab.ConsultationID = d.c.ID
			if ab.IsResolved {
				t := now.Add(-time.Duration(3+i) * time.Hour)
				ab.ResolvedAt = &t
			}
			if err := repository.CreateAbnormalRecord(&ab); err != nil {
				log.Printf("创建异常记录失败: %v", err)
			}
			if ab.IsResolved && ab.ID != "" {
				_ = repository.ResolveAbnormalRecord(ab.ID, ab.Resolution)
			}
		}
		for _, note := range d.notes {
			n := &models.AuditNote{
				ConsultationID: d.c.ID,
				Note:           note,
				CreatedBy:      revUser.RealName,
			}
			if err := repository.CreateAuditNote(n); err != nil {
				log.Printf("创建审计备注失败: %v", err)
			}
		}
	}

	log.Println("演示数据初始化完成（含处理记录、异常记录、审计备注）")
}

func timePtr(t time.Time) *time.Time {
	return &t
}
