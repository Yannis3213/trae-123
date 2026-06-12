package main

import (
	"log"
	"net/http"
	"trademark-system/internal/config"
	"trademark-system/internal/database"
	"trademark-system/internal/handlers"
	"trademark-system/internal/middleware"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := config.Load()

	db, err := database.InitDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	if err := database.SeedInitialData(db); err != nil {
		log.Printf("Warning: Failed to seed data: %v", err)
	}

	r := chi.NewRouter()

	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)
	r.Use(middleware.CORS(cfg.FrontendPort))
	r.Use(middleware.Auth())

	appHandler := handlers.NewApplicationHandler(db)
	correctionHandler := handlers.NewCorrectionHandler(db)
	notificationHandler := handlers.NewNotificationHandler(db)
	batchHandler := handlers.NewBatchHandler(db)

	r.Route("/api/applications", func(r chi.Router) {
		r.Get("/", appHandler.List)
		r.Post("/", appHandler.Create)
		r.Get("/{id}", appHandler.Get)
		r.With(middleware.VersionCheck(db)).Put("/{id}", appHandler.Update)
		r.With(middleware.VersionCheck(db)).Post("/{id}/assign", appHandler.Assign)
		r.With(middleware.VersionCheck(db)).Post("/{id}/transfer", appHandler.Transfer)
		r.With(middleware.VersionCheck(db)).Post("/{id}/visit", appHandler.Visit)
		r.With(middleware.VersionCheck(db)).Post("/{id}/correct", appHandler.Correct)
		r.With(middleware.VersionCheck(db)).Post("/{id}/return", appHandler.Return)
		r.With(middleware.VersionCheck(db)).Post("/{id}/review", appHandler.Review)
		r.Get("/{id}/audit", appHandler.GetAuditTrail)
		r.Post("/{id}/evidence", appHandler.UploadEvidence)
		r.Get("/stats", appHandler.GetStats)
	})

	r.Route("/api/corrections", func(r chi.Router) {
		r.Get("/", correctionHandler.List)
		r.With(middleware.VersionCheck(db)).Post("/{id}/submit", correctionHandler.Submit)
	})

	r.Route("/api/notifications", func(r chi.Router) {
		r.Get("/", notificationHandler.List)
		r.With(middleware.VersionCheck(db)).Post("/{id}/submit", notificationHandler.Submit)
	})

	r.Route("/api/batch", func(r chi.Router) {
		r.Post("/process", batchHandler.Process)
		r.Post("/advance", batchHandler.AdvanceOverdue)
	})

	r.Get("/api/roles", handlers.ListRoles)
	r.Get("/api/me", handlers.GetCurrentUser)
	r.Post("/api/switch-role", handlers.SwitchRole)

	log.Printf("Server starting on port %s...", cfg.BackendPort)
	log.Printf("Frontend allowed on port %s", cfg.FrontendPort)
	if err := http.ListenAndServe(":"+cfg.BackendPort, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
