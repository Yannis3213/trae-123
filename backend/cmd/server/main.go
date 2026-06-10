package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"workshop-system/internal/config"
	"workshop-system/internal/database"
	customMiddleware "workshop-system/internal/middleware"
	"workshop-system/internal/handlers"
	"workshop-system/internal/models"
)

func main() {
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if err := database.Init(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(customMiddleware.CORSMiddleware())

	h := handlers.NewHandler()

	r.Post("/api/auth/login", h.Login)

	r.Group(func(r chi.Router) {
		r.Use(customMiddleware.AuthMiddleware)

		r.Get("/api/user/me", h.GetCurrentUser)
		r.Get("/api/statistics", h.GetStatistics)

		r.Route("/api/workorders", func(r chi.Router) {
			r.Get("/", h.GetWorkOrderList)
			r.Post("/", customMiddleware.RoleMiddleware(models.RoleRegistrar)(http.HandlerFunc(h.CreateWorkOrder)).ServeHTTP)
			r.Post("/batch", h.BatchProcessWorkOrders)

			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", h.GetWorkOrderDetail)
				r.Post("/process", h.ProcessWorkOrder)
				r.Post("/notes", h.AddAuditNote)
			})
		})
	})

	addr := fmt.Sprintf(":%d", config.AppConfig.BackendPort)
	log.Printf("Server starting on port %d...", config.AppConfig.BackendPort)
	log.Printf("Frontend URL: http://localhost:%d", config.AppConfig.FrontendPort)
	log.Printf("API Base URL: http://localhost:%d/api", config.AppConfig.BackendPort)
	log.Fatal(http.ListenAndServe(addr, r))
}
