package handlers

import (
	"net/http"

	"consultation-system/internal/config"
	"consultation-system/internal/middleware"
	"consultation-system/internal/models"
	"consultation-system/internal/repository"

	"github.com/gofiber/fiber/v2"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

func Login(c *fiber.Ctx) error {
	req := &LoginRequest{}
	if err := c.BodyParser(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数错误"})
	}
	if req.Username == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "用户名和密码不能为空"})
	}
	user, err := repository.GetUserByUsername(req.Username)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "用户名或密码错误"})
	}
	if !repository.VerifyPassword(user, req.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "用户名或密码错误"})
	}
	token, err := middleware.GenerateToken(user)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "生成令牌失败"})
	}
	return c.JSON(LoginResponse{Token: token, User: user})
}

func GetMe(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "未登录"})
	}
	return c.JSON(user)
}

func ListUsers(c *fiber.Ctx) error {
	users, err := repository.GetAllUsers()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"users": users, "roles": []config.Role{config.RoleRegistrar, config.RoleAuditor, config.RoleReviewer}})
}
