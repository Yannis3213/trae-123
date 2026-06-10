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

	"coldchain/database"
	"coldchain/handlers"
	"coldchain/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := database.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	handlers.SetDB(database.DB)

	r := gin.Default()
	r.Use(middleware.CORS())

	api := r.Group("/api")

	api.POST("/auth/login", handlers.Login)

	auth := api.Group("")
	auth.Use(middleware.RequireAuth())
	{
		auth.GET("/auth/me", handlers.GetCurrentUser)
		auth.POST("/auth/switch-role", handlers.SwitchRole)

		auth.GET("/applications", handlers.ListApplications)
		auth.POST("/applications", handlers.CreateApplication)
		auth.GET("/applications/:id", handlers.GetApplication)
		auth.PUT("/applications/:id", handlers.UpdateApplication)
		auth.POST("/applications/:id/submit", handlers.SubmitApplication)
		auth.POST("/applications/:id/allocate", handlers.AllocateApplication)
		auth.POST("/applications/:id/confirm", handlers.ConfirmApplication)
		auth.POST("/applications/:id/return", handlers.ReturnApplication)
		auth.POST("/applications/:id/correct", handlers.CorrectApplication)
		auth.GET("/applications/:id/records", handlers.GetRecords)
		auth.GET("/applications/:id/audit-notes", handlers.GetAuditNotes)
		auth.POST("/applications/:id/audit-notes", handlers.AddAuditNote)
		auth.GET("/applications/:id/exceptions", handlers.GetExceptions)
		auth.GET("/applications/:id/attachments", handlers.GetAttachments)
		auth.POST("/applications/:id/attachments", handlers.AddAttachment)

		auth.POST("/batch/process", handlers.BatchProcess)
		auth.POST("/batch/advance-overdue", handlers.BatchAdvanceOverdue)

		auth.GET("/stats/summary", handlers.GetSummary)
		auth.GET("/stats/expiry-warnings", handlers.GetExpiryWarnings)
	}

	srv := &http.Server{
		Addr:    ":8004",
		Handler: r,
	}

	go func() {
		fmt.Println("Server starting on :8004")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	fmt.Println("Server exited")
}
