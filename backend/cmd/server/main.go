package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"hr-onboarding/internal/database"
	"hr-onboarding/internal/handlers"
	appMiddleware "hr-onboarding/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

const (
	defaultPort   = "8005"
	defaultDBPath = "data/onboarding.db"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = defaultDBPath
	}

	if err := database.Init(dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	if err := database.Seed(); err != nil {
		log.Fatalf("Failed to seed database: %v", err)
	}

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3005", "http://127.0.0.1:3005"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	authHandler := handlers.NewAuthHandler()
	orderHandler := handlers.NewOrderHandler()

	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/login", authHandler.Login)

		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.AuthMiddleware)

			r.Get("/auth/me", authHandler.Me)

			r.Route("/orders", func(r chi.Router) {
				r.Post("/", orderHandler.Create)
				r.Get("/", orderHandler.List)
				r.Get("/{id}", orderHandler.Get)
				r.Post("/{id}/process", orderHandler.Process)
				r.Post("/{id}/attachments", orderHandler.AddAttachment)
				r.Post("/batch", orderHandler.BatchProcess)
				r.Post("/{id}/audit-notes", orderHandler.AddAuditNote)
			})

			r.Get("/meta", getMeta)
		})
	})

	log.Printf("Server starting on port %s...", port)
	log.Printf("Database path: %s", dbPath)
	log.Printf("CORS allowed: http://localhost:3005")
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func getMeta(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"roles": []map[string]string{
			{"id": "registrar", "name": "入职办理登记员"},
			{"id": "auditor", "name": "入职办理审核主管"},
			{"id": "reviewer", "name": "企业人事共享中心复核负责人"},
		},
		"statuses": []map[string]string{
			{"id": "pending", "name": "待派发"},
			{"id": "processing", "name": "处理中"},
			{"id": "returned", "name": "退回补正"},
			{"id": "completed", "name": "已完成"},
			{"id": "closed", "name": "已关闭"},
		},
		"nodes": []map[string]string{
			{"id": "docs", "name": "入职资料"},
			{"id": "contract", "name": "合同签署"},
			{"id": "account", "name": "账号开通"},
		},
		"actions": []map[string]string{
			{"id": "submit", "name": "提交"},
			{"id": "claim", "name": "认领"},
			{"id": "approve", "name": "通过"},
			{"id": "return", "name": "退回"},
			{"id": "close", "name": "关闭"},
		},
		"warnings": []map[string]string{
			{"id": "normal", "name": "正常"},
			{"id": "near", "name": "临期"},
			{"id": "overdue", "name": "逾期"},
		},
	})
}
