package middleware

import (
	"github.com/gin-gonic/gin"
	"insurance-system/config"
)

type UserContext struct {
	UserID   string
	UserName string
	Role     string
}

func RoleContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-Id")
		userName := c.GetHeader("X-User-Name")
		role := c.GetHeader("X-Role")

		if userID == "" {
			userID = "default_user"
		}
		if userName == "" {
			userName = "默认用户"
		}
		if role == "" || !config.ValidRoles[role] {
			role = config.RoleCustomerManager
		}

		c.Set("user_id", userID)
		c.Set("user_name", userName)
		c.Set("role", role)
		c.Next()
	}
}

func GetUserContext(c *gin.Context) UserContext {
	userID, _ := c.Get("user_id")
	userName, _ := c.Get("user_name")
	role, _ := c.Get("role")
	return UserContext{
		UserID:   userID.(string),
		UserName: userName.(string),
		Role:     role.(string),
	}
}
