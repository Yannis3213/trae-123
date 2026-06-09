package main

import (
	"log"
	"vocational-school/database"
	"vocational-school/handlers"
	"vocational-school/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	if err := database.Init(); err != nil {
		log.Fatal("数据库初始化失败:", err)
	}
	if err := database.Seed(); err != nil {
		log.Fatal("Seed 数据初始化失败:", err)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3002", "http://127.0.0.1:3002"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	r.POST("/api/login", handlers.Login)

	auth := r.Group("/api")
	auth.Use(middleware.AuthMiddleware())
	{
		auth.GET("/me", handlers.GetCurrentUser)
		auth.GET("/users", handlers.ListUsers)
		auth.GET("/applications", handlers.ListApplications)
		auth.GET("/applications/:id", handlers.GetApplication)
		auth.POST("/applications/:id/process", handlers.ProcessApplication)
		auth.POST("/applications/batch", handlers.BatchProcess)
		auth.POST("/applications/:id/notes", handlers.AddAuditNote)
		auth.GET("/statistics", handlers.GetStatistics)
	}

	log.Println("服务器启动在 :8002")
	if err := r.Run(":8002"); err != nil {
		log.Fatal("服务器启动失败:", err)
	}
}
