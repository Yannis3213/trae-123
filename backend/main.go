package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"trae-123-4/backend/config"
	"trae-123-4/backend/database"
	"trae-123-4/backend/handlers"
	"trae-123-4/backend/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	config.LoadConfig()

	if err := database.InitDB(config.AppConfig.DBPath); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	defer database.CloseDB()

	if err := database.SeedData(); err != nil {
		log.Printf("种子数据初始化失败: %v", err)
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowOrigin := config.GetAllowOrigin()
		if origin == allowOrigin || origin == "" {
			c.Header("Access-Control-Allow-Origin", allowOrigin)
		} else {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, X-Role, X-User-Id, X-User-Name")
		c.Header("Access-Control-Allow-Credentials", "true")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	r.Static("/uploads", "./uploads")

	api := r.Group("/api")
	api.Use(middleware.RoleMiddleware())
	{
		api.GET("/applications", handlers.ListApplications)
		api.GET("/applications/:id", handlers.GetApplication)
		api.POST("/applications", handlers.CreateApplication)
		api.PUT("/applications/:id", handlers.UpdateApplication)
		api.POST("/applications/:id/process", handlers.ProcessApplication)
		api.POST("/applications/batch", handlers.BatchProcess)
		api.GET("/applications/:id/audit", handlers.GetAuditLogs)
		api.POST("/applications/:id/attachments", handlers.UploadAttachment)
		api.GET("/export", handlers.ExportCSV)
		api.GET("/expiry-warnings", handlers.GetExpiryWarnings)
		api.GET("/statistics", handlers.GetStatistics)
	}

	port := config.GetBackendPort()
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	go func() {
		fmt.Printf("后端服务启动在端口 %s\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("服务启动失败: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println("正在关闭服务...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("服务关闭异常: %v", err)
	}
	fmt.Println("服务已优雅关闭")
}
