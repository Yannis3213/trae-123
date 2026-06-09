package main

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	appMiddleware "prescription-flow/internal/middleware"
	"prescription-flow/internal/db"
	"prescription-flow/internal/handlers"
	"prescription-flow/internal/models"
)

const Port = "8003"

func main() {
	if err := db.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.GetDB().Close()

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3003", "http://127.0.0.1:3003"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"*", "X-User", "X-Role", "X-Name", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(appMiddleware.Auth)

	handler := handlers.NewFlowHandler()

	r.Get("/api/health", handler.HealthCheck)
	r.Get("/api/users", handler.GetUsers)
	r.Get("/api/statistics", handler.GetStatistics)

	r.Route("/api/flows", func(r chi.Router) {
		r.Get("/", handler.ListFlows)
		r.Post("/", appMiddleware.RequireRoles(
			models.RoleRegistrar, models.RoleAssistant,
		)(http.HandlerFunc(handler.CreateFlow)))

		r.Get("/{id}", handler.GetFlow)
		r.Post("/{id}/process", http.HandlerFunc(handler.ProcessFlow))
		r.Get("/{id}/records", handler.GetProcessRecords)
		r.Get("/{id}/abnormal", handler.GetAbnormalReasons)
		r.Get("/{id}/audit", handler.GetAuditNotes)
	})

	r.Post("/api/flows/batch", http.HandlerFunc(handler.BatchProcess))

	log.Printf("Server starting on port %s...", Port)
	log.Printf("API base: http://localhost:%s/api", Port)
	if err := http.ListenAndServe(":"+Port, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
