package handlers

import (
	"database/sql"
	"net/http"

	"coldchain/models"

	"github.com/gin-gonic/gin"
)

var DB *sql.DB

func SetDB(db *sql.DB) {
	DB = db
}

func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	var user models.User
	err := DB.QueryRow(
		"SELECT id, username, password, role, display_name FROM users WHERE username = ?",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.Password, &user.Role, &user.DisplayName)

	if err != nil {
		c.JSON(http.StatusUnauthorized, models.APIError{Code: "AUTH_FAILED", Message: "用户名或密码错误"})
		return
	}

	if user.Password != req.Password {
		c.JSON(http.StatusUnauthorized, models.APIError{Code: "AUTH_FAILED", Message: "用户名或密码错误"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": models.User{
			ID:          user.ID,
			Username:    user.Username,
			Role:        user.Role,
			DisplayName: user.DisplayName,
		},
	})
}

func GetCurrentUser(c *gin.Context) {
	userID, _ := c.Get("userID")

	var user models.User
	err := DB.QueryRow(
		"SELECT id, username, role, display_name FROM users WHERE id = ?",
		userID,
	).Scan(&user.ID, &user.Username, &user.Role, &user.DisplayName)

	if err != nil {
		c.JSON(http.StatusNotFound, models.APIError{Code: "USER_NOT_FOUND", Message: "用户不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func SwitchRole(c *gin.Context) {
	var req models.SwitchRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_REQUEST", Message: "请求参数无效"})
		return
	}

	validRoles := map[string]bool{
		"warehouse_clerk":   true,
		"temp_supervisor":   true,
		"warehouse_manager": true,
	}

	if !validRoles[req.Role] {
		c.JSON(http.StatusBadRequest, models.APIError{Code: "INVALID_ROLE", Message: "无效的角色: " + req.Role})
		return
	}

	userID, _ := c.Get("userID")
	_, err := DB.Exec("UPDATE users SET role = ? WHERE id = ?", req.Role, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIError{Code: "DB_ERROR", Message: "更新角色失败"})
		return
	}

	var user models.User
	DB.QueryRow(
		"SELECT id, username, role, display_name FROM users WHERE id = ?",
		userID,
	).Scan(&user.ID, &user.Username, &user.Role, &user.DisplayName)

	c.JSON(http.StatusOK, gin.H{"user": user})
}
