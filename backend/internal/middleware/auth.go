package middleware

import (
	"context"
	"fire-hazard-system/internal/models"
	"net/http"
	"strings"
)

type contextKey string

const UserContextKey contextKey = "user"

func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("X-User-ID")
		userRole := r.Header.Get("X-User-Role")
		userName := r.Header.Get("X-User-Name")

		if userID == "" || userRole == "" {
			userID = "default_clerk"
			userRole = string(models.RoleClerk)
			userName = "默认消防文员"
		}

		roleNameMap := map[string]string{
			string(models.RoleClerk):        "消防文员",
			string(models.RoleSupervisor):   "防火监督员",
			string(models.RoleStationChief): "站点负责人",
		}

		user := &models.User{
			ID:       userID,
			Name:     userName,
			Role:     models.Role(userRole),
			RoleName: roleNameMap[userRole],
		}

		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetUser(ctx context.Context) *models.User {
	user, ok := ctx.Value(UserContextKey).(*models.User)
	if !ok {
		return &models.User{
			ID:       "default_clerk",
			Name:     "默认消防文员",
			Role:     models.RoleClerk,
			RoleName: "消防文员",
		}
	}
	return user
}

func RequireRoles(roles ...models.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := GetUser(r.Context())
			for _, role := range roles {
				if user.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}
			http.Error(w, `{"success":false,"message":"权限不足，当前角色无权执行此操作"}`, http.StatusForbidden)
		})
	}
}

func NormalizeRole(role string) models.Role {
	switch strings.ToLower(role) {
	case "fire_clerk", "clerk":
		return models.RoleClerk
	case "fire_supervisor", "supervisor":
		return models.RoleSupervisor
	case "station_chief", "chief":
		return models.RoleStationChief
	default:
		return models.RoleClerk
	}
}
