package middleware

import (
	"net/http"
	"strings"

	"water-biz-backend/internal/auth"
)

type CORSOptions struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	ExposedHeaders   []string
	AllowCredentials bool
	MaxAge           int
}

func CORS(opts CORSOptions) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			allowed := false
			for _, o := range opts.AllowedOrigins {
				if o == origin {
					allowed = true
					break
				}
			}

			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}

			if opts.AllowCredentials {
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}

			if len(opts.AllowedMethods) > 0 {
				w.Header().Set("Access-Control-Allow-Methods", strings.Join(opts.AllowedMethods, ", "))
			}

			if len(opts.AllowedHeaders) > 0 {
				w.Header().Set("Access-Control-Allow-Headers", strings.Join(opts.AllowedHeaders, ", "))
			}

			if len(opts.ExposedHeaders) > 0 {
				w.Header().Set("Access-Control-Expose-Headers", strings.Join(opts.ExposedHeaders, ", "))
			}

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"Unauthorized","message":"未提供认证令牌"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, `{"error":"Unauthorized","message":"认证令牌格式错误"}`, http.StatusUnauthorized)
			return
		}

		tokenStr := parts[1]
		user, err := auth.ValidateToken(tokenStr)
		if err != nil {
			http.Error(w, `{"error":"Unauthorized","message":"认证令牌无效或已过期"}`, http.StatusUnauthorized)
			return
		}

		r = auth.SetUserContext(r, user)
		next.ServeHTTP(w, r)
	}
}
