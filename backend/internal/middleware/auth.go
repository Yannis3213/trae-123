package middleware

import (
	"context"
	"net/http"
	"trademark-system/internal/models"
)

type contextKey string

const (
	UserContextKey contextKey = "user"
)

var users = map[string]models.User{
	"registrar": {
		ID:       "registrar",
		Name:     "李登记",
		Role:     models.RoleRegistrar,
		RoleName: models.RoleNames[models.RoleRegistrar],
	},
	"agent": {
		ID:       "agent",
		Name:     "王代理",
		Role:     models.RoleAgent,
		RoleName: models.RoleNames[models.RoleAgent],
	},
	"director": {
		ID:       "director",
		Name:     "张所长",
		Role:     models.RoleDirector,
		RoleName: models.RoleNames[models.RoleDirector],
	},
}

func Auth() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole := r.Header.Get("X-User-Role")
			if userRole == "" {
				userRole = "registrar"
			}

			user, ok := users[userRole]
			if !ok {
				user = users["registrar"]
			}

			ctx := context.WithValue(r.Context(), UserContextKey, &user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetCurrentUser(ctx context.Context) *models.User {
	user, ok := ctx.Value(UserContextKey).(*models.User)
	if !ok {
		u := users["registrar"]
		return &u
	}
	return user
}

func CheckRole(allowedRoles ...models.Role) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := GetCurrentUser(r.Context())
			allowed := false
			for _, role := range allowedRoles {
				if user.Role == role {
					allowed = true
					break
				}
			}
			if !allowed {
				http.Error(w, `{"code":403,"message":"权限不足，当前角色无法执行此操作"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
