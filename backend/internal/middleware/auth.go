package middleware

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"hr-onboarding/internal/database"
	"hr-onboarding/internal/models"
)

type contextKey string

const UserContextKey contextKey = "user"

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeError(w, 401, "未授权", "缺少 Authorization 头")
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			writeError(w, 401, "未授权", "Authorization 格式错误，应为 Bearer <token>")
			return
		}

		token := parts[1]
		user, err := parseToken(token)
		if err != nil {
			writeError(w, 401, "未授权", "Token 无效或已过期")
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RoleMiddleware(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserContextKey).(*models.User)
			if !ok {
				writeError(w, 401, "未授权", "用户信息缺失")
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
				writeError(w, 403, "权限不足", "当前角色 "+user.Role+" 无此操作权限")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func GetCurrentUser(r *http.Request) *models.User {
	user, _ := r.Context().Value(UserContextKey).(*models.User)
	return user
}

func GenerateToken(user *models.User) (string, error) {
	payload := map[string]interface{}{
		"user_id": user.ID,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(data), nil
}

func parseToken(token string) (*models.User, error) {
	data, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return nil, err
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}

	exp := int64(payload["exp"].(float64))
	if time.Now().Unix() > exp {
		return nil, &tokenError{"token expired"}
	}

	userID := payload["user_id"].(string)
	user, err := database.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	return user, nil
}

type tokenError struct {
	msg string
}

func (e *tokenError) Error() string { return e.msg }

func writeError(w http.ResponseWriter, code int, message, detail string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(models.ApiError{
		Code:    code,
		Message: message,
		Detail:  detail,
	})
}
