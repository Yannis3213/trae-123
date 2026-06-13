package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	dbpkg "pharmacy-nearexpiry/internal/database"
	"pharmacy-nearexpiry/internal/handlers"
	mw "pharmacy-nearexpiry/internal/middleware"
	"pharmacy-nearexpiry/internal/seed"
)

func main() {
	dataDir := "./data"
	if len(os.Args) > 1 {
		dataDir = os.Args[1]
	}
	dataDir, _ = filepath.Abs(dataDir)

	port := "8106"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}

	frontendURL := "http://localhost:3106"
	if envURL := os.Getenv("FRONTEND_URL"); envURL != "" {
		frontendURL = envURL
	}

	if err := dbpkg.InitDB(dataDir); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	if err := seed.Seed(); err != nil {
		log.Fatalf("Failed to seed database: %v", err)
	}

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{frontendURL, "http://localhost:3106"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-User-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/api/health", handlers.HealthCheck)

	r.Route("/api", func(r chi.Router) {
		r.Use(mw.AuthMiddleware)

		r.Get("/users/me", handlers.GetCurrentUser)
		r.Get("/users", handlers.ListUsers)

		r.Get("/stats", handlers.GetStats)

		r.Route("/orders", func(r chi.Router) {
			r.Get("/", handlers.ListOrders)
			r.Post("/", handlers.CreateOrder)

			r.Get("/{id}", handlers.GetOrderDetail)
			r.Post("/{id}/process", handlers.ProcessOrder)
			r.Post("/{id}/audit-notes", handlers.AddAuditNote)
			r.Post("/{id}/attachments", handlers.UploadAttachment)
		})

		r.Post("/batch-process", handlers.BatchProcess)
	})

	log.Printf("🚀 Server starting on port %s", port)
	log.Printf("📊 Data directory: %s", dataDir)
	log.Printf("🌐 Frontend URL: %s", frontendURL)
	log.Printf("🔑 Demo accounts:")
	log.Printf("   - 门店店员: clerk01 / 朝阳大药房")
	log.Printf("   - 门店店员: clerk02 / 海淀大药房")
	log.Printf("   - 执业药师: pharm01 / 朝阳大药房")
	log.Printf("   - 执业药师: pharm02 / 海淀大药房")
	log.Printf("   - 区域经理: manager01 / 华北区域")

	log.Fatal(http.ListenAndServe(":"+port, r))
}
