package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"prescription-flow/internal/models"
)

type contextKey string

const UserContextKey contextKey = "current_user"

type CurrentUser struct {
	Username string
	Name     string
	Role     models.Role
}

func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		xUser := r.Header.Get("X-User")
		xRole := r.Header.Get("X-Role")
		xName := r.Header.Get("X-Name")

		if xUser == "" || xRole == "" {
			if r.URL.Path == "/api/users" || r.URL.Path == "/api/health" {
				next.ServeHTTP(w, r)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(models.ApiError{Code: 401, Message: "未授权，请提供用户身份"})
			return
		}

		user := &CurrentUser{
			Username: xUser,
			Role:     models.Role(strings.ToLower(xRole)),
			Name:     xName,
		}
		if user.Name == "" {
			user.Name = xUser
		}

		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetCurrentUser(r *http.Request) *CurrentUser {
	user, ok := r.Context().Value(UserContextKey).(*CurrentUser)
	if !ok {
		return nil
	}
	return user
}

func RequireRoles(allowedRoles ...models.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := GetCurrentUser(r)
			if user == nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(models.ApiError{Code: 401, Message: "未授权"})
				return
			}

			allowed := false
			for _, role := range allowedRoles {
				if user.Role == role {
					allowed = true
					break
				}
			}

			if !allowed {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				json.NewEncoder(w).Encode(models.ApiError{Code: 403, Message: "当前角色无权限执行此操作"})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
