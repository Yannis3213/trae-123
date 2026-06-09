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

	if regUser == nil || audUser == nil {
		return
	}

	demoConsultations := []models.Consultation{
		{
			PatientName:        "张三",
			PatientID:          "P001",
			Age:                55,
			Gender:             "男",
			Department:         "内科",
			AttendingPhysician: "陈医生",
			ConsultationType:   "科间会诊",
			ConsultationReason: "胸闷胸痛3天，疑似冠心病",
			ConsultationDept:   "心内科",
			RequestedDoctor:    "赵主任",
			Urgency:            config.UrgencyNormal,
			Status:             config.StatusPending,
			CurrentStage:       config.StageRegistration,
			CurrentHandler:     regUser.ID,
			EvidenceList:       "病历,心电图",
			CreatedBy:          regUser.ID,
			UpdatedBy:          regUser.ID,
		},
		{
			PatientName:        "李四",
			PatientID:          "P002",
			Age:                42,
			Gender:             "女",
			Department:         "外科",
			AttendingPhysician: "刘医生",
			ConsultationType:   "紧急会诊",
			ConsultationReason: "术后发热，怀疑感染",
			ConsultationDept:   "感染科",
			RequestedDoctor:    "孙医生",
			Urgency:            config.UrgencyWarning,
			Status:             config.StatusAbnormal,
			CurrentStage:       config.StageVerification,
			CurrentHandler:     audUser.ID,
			EvidenceList:       "手术记录,血常规",
			CreatedBy:          regUser.ID,
			UpdatedBy:          regUser.ID,
		},
		{
			PatientName:        "王五",
			PatientID:          "P003",
			Age:                68,
			Gender:             "男",
			Department:         "神经内科",
			AttendingPhysician: "周医生",
			ConsultationType:   "多学科会诊",
			ConsultationReason: "脑卒中待确诊",
			ConsultationDept:   "放射科,神经外科",
			RequestedDoctor:    "钱主任,吴主任",
			Urgency:            config.UrgencyOverdue,
			Status:             config.StatusRechecked,
			CurrentStage:       config.StageReview,
			EvidenceList:       "CT片,MRI报告,病历",
			CreatedBy:          regUser.ID,
			UpdatedBy:          audUser.ID,
		},
		{
			PatientName:        "赵六",
			PatientID:          "P004",
			Age:                30,
			Gender:             "女",
			Department:         "妇产科",
			AttendingPhysician: "郑医生",
			ConsultationType:   "科间会诊",
			ConsultationReason: "妊娠期高血压",
			ConsultationDept:   "心内科",
			RequestedDoctor:    "冯主任",
			Urgency:            config.UrgencyWarning,
			Status:             config.StatusPending,
			CurrentStage:       config.StageVerification,
			CurrentHandler:     audUser.ID,
			EvidenceList:       "产检记录,血压监测",
			CreatedBy:          regUser.ID,
			UpdatedBy:          regUser.ID,
		},
	}

	now := time.Now()
	demoConsultations[1].Deadline = timePtr(now.Add(-2 * time.Hour))
	demoConsultations[2].Deadline = timePtr(now.Add(-48 * time.Hour))
	demoConsultations[3].Deadline = timePtr(now.Add(6 * time.Hour))
	demoConsultations[0].Deadline = timePtr(now.Add(48 * time.Hour))

	for i := range demoConsultations {
		existing, _ := repository.GetConsultationByID("demo-" + fmt.Sprint(i+1))
		if existing == nil {
			if err := repository.CreateConsultation(&demoConsultations[i]); err != nil {
				log.Printf("创建演示会诊单失败: %v", err)
			} else {
				log.Printf("创建演示会诊单: %s", demoConsultations[i].PatientName)
			}
		}
	}

	log.Println("演示数据初始化完成")
}

func timePtr(t time.Time) *time.Time {
	return &t
}
