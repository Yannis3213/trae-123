package middleware

import (
	"net/http"

	"github.com/go-chi/cors"
)

func CORS(frontendPort string) func(next http.Handler) http.Handler {
	return cors.Handler(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:" + frontendPort,
			"http://127.0.0.1:" + frontendPort,
		},
		AllowedMethods: []string{
			"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH",
		},
		AllowedHeaders: []string{
			"Accept", "Authorization", "Content-Type", "X-CSRF-Token",
			"X-User-Role", "X-User-ID", "X-If-Match", "X-Version",
		},
		ExposedHeaders: []string{
			"Link", "X-Version",
		},
		AllowCredentials: true,
		MaxAge:           300,
	})
}
