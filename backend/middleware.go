package main

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte("repair-platform-secret-2025")

func JWTMiddleware(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(401).JSON(APIResponse{
			Code:    -1,
			Message: "缺少认证令牌",
		})
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenStr == authHeader {
		tokenStr = authHeader
	}

	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return c.Status(401).JSON(APIResponse{
			Code:    -1,
			Message: "无效的认证令牌",
		})
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return c.Status(401).JSON(APIResponse{
			Code:    -1,
			Message: "无效的令牌声明",
		})
	}

	userID := 0
	if v, ok := claims["user_id"]; ok {
		switch val := v.(type) {
		case float64:
			userID = int(val)
		case int:
			userID = val
		}
	}

	username, _ := claims["username"].(string)
	role, _ := claims["role"].(string)

	c.Locals("userId", userID)
	c.Locals("username", username)
	c.Locals("role", role)

	return c.Next()
}
