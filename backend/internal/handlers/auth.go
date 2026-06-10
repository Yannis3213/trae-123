package handlers

import (
	"crypto/sha256"
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"aviation-ground-service/internal/config"
	"aviation-ground-service/internal/middleware"
	"aviation-ground-service/internal/models"

	"github.com/golang-jwt/jwt"
	"github.com/labstack/echo/v4"
)

type AuthHandler struct {
	DB *sql.DB
}

func HashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return fmt.Sprintf("%x", h)
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req models.LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求参数错误"})
	}

	if req.Username == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "用户名和密码不能为空"})
	}

	var user models.User
	query := "SELECT id, username, password_hash, role, name, created_at FROM users WHERE username = ?"
	err := h.DB.QueryRow(query, req.Username).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.Role, &user.Name, &user.CreatedAt,
	)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "用户名或密码错误"})
	}

	hashedPassword := HashPassword(req.Password)
	if user.PasswordHash != hashedPassword {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "用户名或密码错误"})
	}

	claims := &middleware.JWTClaims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		Name:     user.Name,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: time.Now().Add(24 * time.Hour).Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(config.JWTSecret))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "生成令牌失败"})
	}

	return c.JSON(http.StatusOK, models.LoginResponse{
		Token: tokenString,
		User:  user,
	})
}

func (h *AuthHandler) Me(c echo.Context) error {
	userID := middleware.GetUserID(c)

	var user models.User
	query := "SELECT id, username, password_hash, role, name, created_at FROM users WHERE id = ?"
	err := h.DB.QueryRow(query, userID).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.Role, &user.Name, &user.CreatedAt,
	)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "用户不存在"})
	}

	return c.JSON(http.StatusOK, user)
}
