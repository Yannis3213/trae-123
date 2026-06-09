package main

import (
	"log"

	"consultation-system/internal/config"
	"consultation-system/internal/handlers"
	"consultation-system/internal/middleware"
	"consultation-system/internal/repository"
	"consultation-system/internal/seed"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	if err := repository.InitDB(); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	seed.SeedDemoData()

	app := fiber.New(fiber.Config{
		AppName: "会诊申请单月底集中处理系统",
	})

	app.Use(recover.New())
	app.Use(logger.New())

	app.Use(cors.New(cors.Config{
		AllowOrigins:     config.CORSAllowOrigin,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS,PATCH",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true,
	}))

	api := app.Group("/api")

	api.Post("/auth/login", handlers.Login)

	auth := api.Group("")
	auth.Use(middleware.AuthRequired())

	auth.Get("/auth/me", handlers.GetMe)
	auth.Get("/users", handlers.ListUsers)

	auth.Post("/consultations", middleware.RoleRequired(config.RoleRegistrar), handlers.CreateConsultation)
	auth.Get("/consultations", handlers.ListConsultations)
	auth.Get("/consultations/:id", handlers.GetConsultation)
	auth.Put("/consultations/:id", middleware.RoleRequired(config.RoleRegistrar), handlers.UpdateConsultation)
	auth.Post("/consultations/:id/process", handlers.ProcessAction)
	auth.Post("/consultations/batch", handlers.BatchProcess)
	auth.Post("/consultations/:id/notes", handlers.AddAuditNote)
	auth.Post("/consultations/:id/attachments", handlers.AddAttachment)

	auth.Get("/statistics", handlers.GetStatistics)
	auth.Get("/ledger", handlers.GetLedger)
	auth.Get("/warnings", handlers.GetWarningList)

	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "consultation-system",
			"port":    config.ServerPort,
		})
	})

	log.Printf("服务器启动于端口 %s", config.ServerPort)
	log.Printf("CORS 允许来源: %s", config.CORSAllowOrigin)
	if err := app.Listen(":" + config.ServerPort); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}
