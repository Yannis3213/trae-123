package middleware

import (
	"strings"
	"time"

	"consultation-system/internal/config"
	"consultation-system/internal/models"
	"consultation-system/internal/repository"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID   string      `json:"user_id"`
	Username string      `json:"username"`
	RealName string      `json:"real_name"`
	Role     config.Role `json:"role"`
	jwt.RegisteredClaims
}

func GenerateToken(user *models.User) (string, error) {
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		RealName: user.RealName,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(config.TokenExpireHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.JWTSecret))
}

func AuthRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "未提供认证令牌"})
		}
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "认证令牌格式错误"})
		}
		tokenStr := parts[1]
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(config.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "认证令牌无效或已过期"})
		}
		c.Locals("user_id", claims.UserID)
		c.Locals("username", claims.Username)
		c.Locals("real_name", claims.RealName)
		c.Locals("role", claims.Role)
		return c.Next()
	}
}

func RoleRequired(roles ...config.Role) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userRole, ok := c.Locals("role").(config.Role)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "无效的用户角色"})
		}
		for _, r := range roles {
			if r == userRole {
				return c.Next()
			}
		}
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "权限不足"})
	}
}

func GetCurrentUser(c *fiber.Ctx) *models.User {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return nil
	}
	user, err := repository.GetUserByID(userID)
	if err != nil {
		return nil
	}
	return user
}

func GetUserRole(c *fiber.Ctx) config.Role {
	role, _ := c.Locals("role").(config.Role)
	return role
}
