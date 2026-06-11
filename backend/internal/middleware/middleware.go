package middleware

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"live-selection-backend/internal/model"
)

type tokenClaims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	Name     string `json:"name"`
	Exp      int64  `json:"exp"`
}

func GenerateToken(user *model.User) (string, error) {
	location, _ := time.LoadLocation("Asia/Shanghai")
	now := time.Now().In(location)
	claims := tokenClaims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		Name:     user.Name,
		Exp:      now.Add(24 * time.Hour).Unix(),
	}
	data, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	return "tk_" + string(data), nil
}

func parseToken(tokenStr string) (*tokenClaims, error) {
	if !strings.HasPrefix(tokenStr, "tk_") {
		return nil, nil
	}
	payload := strings.TrimPrefix(tokenStr, "tk_")
	var claims tokenClaims
	if err := json.Unmarshal([]byte(payload), &claims); err != nil {
		return nil, err
	}

	location, _ := time.LoadLocation("Asia/Shanghai")
	now := time.Now().In(location)
	if claims.Exp > 0 && claims.Exp < now.Unix() {
		return nil, nil
	}

	return &claims, nil
}

func CORS() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			origin := c.Request().Header.Get("Origin")
			allowedOrigins := []string{
				"http://localhost:3004",
			}
			
			allowed := false
			for _, o := range allowedOrigins {
				if o == origin {
					allowed = true
					break
				}
			}
			
			if allowed {
				c.Response().Header().Set("Access-Control-Allow-Origin", origin)
				c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				c.Response().Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				c.Response().Header().Set("Access-Control-Allow-Credentials", "true")
			}

			if c.Request().Method == "OPTIONS" {
				return c.NoContent(http.StatusNoContent)
			}

			return next(c)
		}
	}
}

func AuthMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return c.JSON(http.StatusUnauthorized, model.Response{
					Code:    401,
					Message: "未提供认证令牌",
					Data:    nil,
				})
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if !(len(parts) == 2 && parts[0] == "Bearer") {
				return c.JSON(http.StatusUnauthorized, model.Response{
					Code:    401,
					Message: "认证令牌格式错误",
					Data:    nil,
				})
			}

			tokenStr := parts[1]
			claims, err := parseToken(tokenStr)
			if err != nil || claims == nil {
				return c.JSON(http.StatusUnauthorized, model.Response{
					Code:    401,
					Message: "认证令牌无效或已过期",
					Data:    nil,
				})
			}

			c.Set("user_id", claims.UserID)
			c.Set("username", claims.Username)
			c.Set("role", claims.Role)
			c.Set("name", claims.Name)

			return next(c)
		}
	}
}

func GetCurrentUser(c echo.Context) *model.User {
	userID, _ := c.Get("user_id").(int64)
	username, _ := c.Get("username").(string)
	role, _ := c.Get("role").(string)
	name, _ := c.Get("name").(string)

	if userID == 0 {
		return nil
	}

	return &model.User{
		ID:       userID,
		Username: username,
		Role:     role,
		Name:     name,
	}
}
