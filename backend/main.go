package main

import (
	"fmt"
	"log"
	"os"
	"insurance-system/config"
	"insurance-system/database"
	"insurance-system/handlers"
	"insurance-system/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

const Port = ":8001"

func main() {
	if err := os.MkdirAll("./data", 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	if err := database.InitDB("./data/insurance.db"); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	if err := database.Migrate(); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	if err := database.SeedData(); err != nil {
		log.Fatalf("Failed to seed data: %v", err)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3001", "http://127.0.0.1:3001"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Role", "X-User-Id", "X-User-Name"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	r.Use(middleware.RoleContext())

	api := r.Group("/api")
	{
		api.GET("/health", handlers.HealthCheck)
		api.GET("/dashboard/stats", handlers.GetDashboardStats)
		api.GET("/warnings", handlers.GetWarnings)

		orders := api.Group("/patrol-orders")
		{
			orders.GET("", handlers.ListPatrolOrders)
			orders.GET("/:id", handlers.GetPatrolOrder)
			orders.POST("", handlers.CreatePatrolOrder)
			orders.PUT("/:id", handlers.UpdatePatrolOrder)
			orders.POST("/:id/action", handlers.ActionPatrolOrder)
			orders.POST("/batch-action", handlers.BatchActionPatrolOrders)
			orders.GET("/:id/history", handlers.GetPatrolOrderHistory)
		}

		attachments := api.Group("/attachments")
		{
			attachments.GET("", handlers.ListAttachments)
			attachments.POST("", handlers.CreateAttachment)
			attachments.DELETE("/:id", handlers.DeleteAttachment)
		}
	}

	fmt.Printf("Backend server starting on http://localhost%s\n", Port)
	if err := r.Run(Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
