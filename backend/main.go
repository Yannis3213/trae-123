package main

import (
	"log"

	"cross-border-order-system/internal/config"
	"cross-border-order-system/internal/database"
	"cross-border-order-system/internal/handlers"
	"cross-border-order-system/internal/middleware"
	"cross-border-order-system/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	cfg := config.Load()
	database.Init(cfg)

	app := fiber.New(fiber.Config{
		AppName: "Cross-Border Order System",
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.FrontendURL,
		AllowMethods:     "GET,POST,PUT,DELETE,PATCH,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true,
	}))

	authHandler := handlers.NewAuthHandler(cfg)
	orderHandler := handlers.NewOrderHandler()

	api := app.Group("/api")

	api.Post("/auth/login", authHandler.Login)

	protected := api.Group("")
	protected.Use(middleware.AuthRequired(cfg))

	protected.Get("/auth/me", authHandler.Me)
	protected.Get("/users", authHandler.ListUsers)

	orders := protected.Group("/orders")
	orders.Get("", orderHandler.ListOrders)
	orders.Get("/statistics", orderHandler.GetStatistics)
	orders.Get("/:id", orderHandler.GetOrder)
	orders.Post("/:id/action/:action", middleware.RequireRole(models.RoleOpsSpecialist, models.RoleWarehouseMgr, models.RoleShopOwner), orderHandler.SubmitOrder)
	orders.Post("/batch", middleware.RequireRole(models.RoleOpsSpecialist, models.RoleWarehouseMgr, models.RoleShopOwner), orderHandler.BatchProcess)
	orders.Post("/:id/audit-notes", orderHandler.AddAuditNote)
	orders.Post("/:id/attachments", orderHandler.UploadAttachment)

	log.Printf("Server starting on port %s", cfg.BackendPort)
	log.Printf("Frontend URL: %s", cfg.FrontendURL)
	log.Fatal(app.Listen(":" + cfg.BackendPort))
}
