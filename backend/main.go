package main

import (
	"fmt"
	"log"

	"aviation-ground-service/internal/config"
	"aviation-ground-service/internal/database"
	"aviation-ground-service/internal/handlers"
	"aviation-ground-service/internal/middleware"
	"aviation-ground-service/internal/models"
	"aviation-ground-service/internal/seed"

	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
)

func main() {
	db, err := database.Init(config.DBPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	if err := seed.SeedDemoData(db); err != nil {
		log.Printf("Warning: seed data error: %v", err)
	}

	e := echo.New()
	e.HideBanner = true

	e.Use(echoMiddleware.Logger())
	e.Use(echoMiddleware.Recover())
	e.Use(echoMiddleware.CORSWithConfig(middleware.CORSConfig()))

	authHandler := &handlers.AuthHandler{DB: db}
	recordHandler := &handlers.RecordHandler{DB: db}
	attachmentHandler := &handlers.AttachmentHandler{DB: db}
	auditHandler := &handlers.AuditHandler{DB: db}
	exceptionHandler := &handlers.ExceptionHandler{DB: db}
	warningHandler := &handlers.WarningHandler{DB: db}

	e.POST("/api/auth/login", authHandler.Login)

	api := e.Group("/api")
	api.Use(middleware.JWTMiddleware())

	api.GET("/auth/me", authHandler.Me)

	records := api.Group("/records")
	records.GET("", recordHandler.List)
	records.GET("/statistics", recordHandler.Statistics)
	records.POST("", recordHandler.Create, middleware.RoleAuth(models.RoleCheckinAgent))
	records.POST("/batch", recordHandler.BatchProcess)
	records.GET("/:id", recordHandler.GetDetail)
	records.PUT("/:id/process", recordHandler.Process)

	records.POST("/:id/attachments", attachmentHandler.Upload)
	records.GET("/:id/attachments", attachmentHandler.List)
	records.DELETE("/:id/attachments/:aid", attachmentHandler.Delete)

	records.GET("/:id/audit-notes", auditHandler.List)
	records.POST("/:id/audit-notes", auditHandler.Create)

	records.GET("/:id/exception-reasons", exceptionHandler.List)
	records.POST("/:id/exception-reasons", exceptionHandler.Create)

	api.GET("/warnings", warningHandler.List)

	fmt.Printf("航空地服-月底集中处理值机记录系统 后端服务启动于 http://localhost%s\n", config.BackendPort)
	e.Logger.Fatal(e.Start(config.BackendPort))
}
