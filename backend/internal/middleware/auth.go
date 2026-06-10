package middleware

import (
	"net/http"
	"strings"

	"aviation-ground-service/internal/config"
	"aviation-ground-service/internal/models"

	"github.com/golang-jwt/jwt"
	"github.com/labstack/echo/v4"
)

type JWTClaims struct {
	UserID   int64          `json:"user_id"`
	Username string         `json:"username"`
	Role     models.UserRole `json:"role"`
	Name     string         `json:"name"`
	jwt.StandardClaims
}

func JWTMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "缺少认证令牌"})
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "认证令牌格式错误"})
			}

			token, err := jwt.ParseWithClaims(parts[1], &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
				return []byte(config.JWTSecret), nil
			})

			if err != nil || !token.Valid {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "无效的认证令牌"})
			}

			claims, ok := token.Claims.(*JWTClaims)
			if !ok {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "无效的令牌声明"})
			}

			c.Set("user_id", claims.UserID)
			c.Set("username", claims.Username)
			c.Set("role", claims.Role)
			c.Set("name", claims.Name)

			return next(c)
		}
	}
}

func RoleAuth(allowedRoles ...models.UserRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			role, ok := c.Get("role").(models.UserRole)
			if !ok {
				return c.JSON(http.StatusForbidden, map[string]string{"error": "无法获取用户角色"})
			}

			for _, allowed := range allowedRoles {
				if role == allowed {
					return next(c)
				}
			}

			return c.JSON(http.StatusForbidden, map[string]string{"error": "无权访问该资源"})
		}
	}
}

func GetUserID(c echo.Context) int64 {
	id, _ := c.Get("user_id").(int64)
	return id
}

func GetUserRole(c echo.Context) models.UserRole {
	role, _ := c.Get("role").(models.UserRole)
	return role
}

func GetUsername(c echo.Context) string {
	name, _ := c.Get("name").(string)
	return name
}
