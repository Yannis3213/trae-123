package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RoleMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetHeader("X-Role")
		userID := c.GetHeader("X-User-Id")
		userName := c.GetHeader("X-User-Name")

		if role == "" || userID == "" || userName == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    40101,
				"message": "缺少角色信息",
			})
			c.Abort()
			return
		}

		c.Set("role", role)
		c.Set("userID", userID)
		c.Set("userName", userName)
		c.Next()
	}
}

func GetRole(c *gin.Context) string {
	v, _ := c.Get("role")
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func GetUserID(c *gin.Context) string {
	v, _ := c.Get("userID")
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func GetUserName(c *gin.Context) string {
	v, _ := c.Get("userName")
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
