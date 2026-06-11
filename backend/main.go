package main

import (
	"encoding/json"
	"fire-hazard-system/internal/db"
	"fire-hazard-system/internal/handlers"
	"fire-hazard-system/internal/middleware"
	"fire-hazard-system/internal/models"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
)

const (
	BackendPort  = 8108
	FrontendPort = 3108
)

func seedData() {
	var count int
	db.DB.QueryRow("SELECT COUNT(*) FROM fire_hazards").Scan(&count)
	if count > 0 {
		return
	}

	now := time.Now()
	seedDataList := []struct {
		hazardNo    string
		title       string
		description string
		location    string
		priority    models.Priority
		responsible string
		handler     string
		status      models.HazardStatus
		deadline    time.Time
		tags        []string
	}{
		{
			"XFYH-20260601-0001",
			"消防站一楼消防栓压力不足",
			"经检测一楼东侧消防栓出水压力低于标准值，可能影响灭火效果",
			"消防站一楼东侧",
			models.PriorityHigh,
			"张三",
			"消防文员",
			models.StatusPendingAssign,
			now.AddDate(0, 0, 5),
			[]string{"设备故障"},
		},
		{
			"XFYH-20260601-0002",
			"应急照明灯故障",
			"二楼走廊应急照明灯具不亮，需更换电池或维修线路",
			"消防站二楼走廊",
			models.PriorityMedium,
			"李四",
			"防火监督员",
			models.StatusRectifying,
			now.AddDate(0, 0, 2),
			[]string{"电气隐患"},
		},
		{
			"XFYH-20260601-0003",
			"疏散通道堆放杂物",
			"检查发现西南侧疏散通道堆放训练器材，影响紧急疏散",
			"消防站西南侧疏散通道",
			models.PriorityUrgent,
			"王五",
			"站点负责人",
			models.StatusRechecking,
			now.AddDate(0, 0, -1),
			[]string{"通道堵塞", "已逾期"},
		},
		{
			"XFYH-20260601-0004",
			"灭火器即将过期",
			"检查发现有8具干粉灭火器将在15日内过期",
			"全楼层各区域",
			models.PriorityMedium,
			"赵六",
			"消防文员",
			models.StatusTransferred,
			now.AddDate(0, 0, 10),
			[]string{"器材过期"},
		},
		{
			"XFYH-20260601-0005",
			"消防报警系统误报频发",
			"近一周火灾自动报警系统出现多次误报，需排查线路和探头",
			"全站报警系统",
			models.PriorityHigh,
			"孙七",
			"防火监督员",
			models.StatusReturned,
			now.AddDate(0, 0, 1),
			[]string{"系统故障", "已退回"},
		},
		{
			"XFYH-20260601-0006",
			"防火门闭门器损坏",
			"三楼楼梯间防火门闭门器损坏，无法自动闭合",
			"消防站三楼楼梯间",
			models.PriorityLow,
			"周八",
			"站点负责人",
			models.StatusRevisited,
			now.AddDate(0, 0, 3),
			[]string{},
		},
	}

	tagsJSON := "[]"
	for _, s := range seedDataList {
		tj, _ := json.Marshal(s.tags)
		if len(s.tags) > 0 {
			tagsJSON = string(tj)
		} else {
			tagsJSON = "[]"
		}
		wl := "normal"
		diff := s.deadline.Sub(now)
		if diff < 0 {
			wl = "overdue"
		} else if diff.Hours() < 72 {
			wl = "near_due"
		}
		db.DB.Exec(`INSERT INTO fire_hazards 
			(hazard_no, title, description, location, priority, responsible, current_handler, status, deadline, warning_level, abnormal_tags, created_by)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '系统初始化')`,
			s.hazardNo, s.title, s.description, s.location, s.priority, s.responsible,
			s.handler, s.status, s.deadline, wl, tagsJSON)
	}
}

func main() {
	if err := db.InitDB(); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	seedData()

	r := chi.NewRouter()

	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(middleware.CORS())
	r.Use(middleware.Auth)

	h := handlers.NewHandler()

	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","service":"fire-hazard-system","port":%d,"frontend_port":%d}`, BackendPort, FrontendPort)
	})

	r.Get("/api/user/current", h.GetCurrentUser)
	r.Get("/api/stats", h.GetStats)

	r.Route("/api/hazards", func(r chi.Router) {
		r.Get("/", h.ListHazards)
		r.Post("/", h.CreateHazard)
		r.Post("/batch", h.BatchProcess)

		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", h.GetHazard)
			r.Post("/process", h.ProcessHazard)
			r.Post("/audit", h.AddAuditNote)
			r.Post("/abnormal", h.AddAbnormalReason)
			r.Post("/attachments", h.AddAttachment)
		})
		r.Delete("/attachments/{id}", h.DeleteAttachment)
	})

	addr := fmt.Sprintf(":%d", BackendPort)
	log.Printf("消防救援站月底集中处理消防隐患单系统 - 后端服务启动中")
	log.Printf("监听端口: %d", BackendPort)
	log.Printf("前端地址: http://localhost:%d", FrontendPort)
	log.Printf("API 地址: http://localhost:%d/api", BackendPort)
	log.Printf("服务就绪，开始处理请求...")
	log.Fatal(http.ListenAndServe(addr, r))
}
