package middleware

import (
	"context"
	"net/http"
	"strings"

	"pharmacy-nearexpiry/internal/database"
	"pharmacy-nearexpiry/internal/models"
)

type contextKey string

const UserContextKey contextKey = "user"

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("X-User-ID")
		if userID == "" {
			userID = r.URL.Query().Get("user_id")
		}

		if userID == "" {
			http.Error(w, `{"error":"未授权，请先登录"}`, http.StatusUnauthorized)
			return
		}

		var user models.User
		err := database.DB.QueryRow(
			"SELECT id, username, name, role, store FROM users WHERE id = ? OR username = ?",
			userID, userID,
		).Scan(&user.ID, &user.Username, &user.Name, &user.Role, &user.Store)

		if err != nil {
			http.Error(w, `{"error":"用户不存在"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, &user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetUserFromContext(ctx context.Context) *models.User {
	user, ok := ctx.Value(UserContextKey).(*models.User)
	if !ok {
		return nil
	}
	return user
}

func RoleMiddleware(allowedRoles ...models.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := GetUserFromContext(r.Context())
			if user == nil {
				http.Error(w, `{"error":"未授权"}`, http.StatusUnauthorized)
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
				http.Error(w, `{"error":"权限不足"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func GetClientIP(r *http.Request) string {
	xForwarded := r.Header.Get("X-Forwarded-For")
	if xForwarded != "" {
		ips := strings.Split(xForwarded, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}
	return r.RemoteAddr
}
