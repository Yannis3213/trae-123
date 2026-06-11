package main

import (
	"fmt"
	"log"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"live-selection-backend/internal/db"
	"live-selection-backend/internal/handler"
	mw "live-selection-backend/internal/middleware"
)

func main() {
	dbPath := "./data/live_selection.db"

	if err := db.InitDB(dbPath); err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}
	defer db.CloseDB()

	fmt.Println("数据库初始化成功")

	e := echo.New()

	e.Use(mw.CORS())
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	api := e.Group("/api")

	auth := api.Group("/auth")
	{
		auth.POST("/login", handler.Login)
		auth.GET("/current", handler.GetCurrentUser, mw.AuthMiddleware())
	}

	orders := api.Group("/orders", mw.AuthMiddleware())
	{
		orders.GET("", handler.GetOrderList)
		orders.GET("/:id", handler.GetOrderDetail)
		orders.POST("", handler.CreateOrder)
		orders.PUT("/:id/submit", handler.SubmitOrder)
		orders.PUT("/:id/audit", handler.AuditOrder)
		orders.PUT("/:id/review", handler.ReviewOrder)
		orders.PUT("/:id/supplement", handler.SupplementOrder)
		orders.PUT("/:id/process-module", handler.ProcessModule)
		orders.POST("/batch-process", handler.BatchProcess)
		orders.GET("/:id/audit-trail", handler.GetAuditTrail)
		orders.POST("/:id/attachments", handler.UploadAttachment)
	}

	api.GET("/overdue-queue", handler.GetOverdueQueue, mw.AuthMiddleware())
	api.POST("/orders/batch-overdue-push", handler.BatchOverduePush, mw.AuthMiddleware())

	port := ":8004"
	fmt.Printf("服务器启动在端口 %s\n", port)
	fmt.Println("演示账号:")
	fmt.Println("  registrar / 123456 - 直播选品登记员")
	fmt.Println("  auditor   / 123456 - 直播选品审核主管")
	fmt.Println("  reviewer  / 123456 - 直播电商团队复核负责人")

	if err := e.Start(port); err != nil {
		log.Fatalf("启动服务器失败: %v", err)
	}
}
