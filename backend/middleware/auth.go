package middleware

import (
	"net/http"
	"strconv"

	"coldchain/models"

	"github.com/gin-gonic/gin"
)

func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.GetHeader("X-User-ID")
		role := c.GetHeader("X-Role")

		if userIDStr == "" || role == "" {
			c.JSON(http.StatusUnauthorized, models.APIError{
				Code:    "UNAUTHORIZED",
				Message: "缺少认证信息",
			})
			c.Abort()
			return
		}

		userID, err := strconv.ParseInt(userIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.APIError{
				Code:    "UNAUTHORIZED",
				Message: "无效的用户ID",
			})
			c.Abort()
			return
		}

		c.Set("userID", userID)
		c.Set("role", role)
		c.Next()
	}
}

func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		roleStr, ok := role.(string)
		if !ok {
			c.JSON(http.StatusForbidden, models.APIError{
				Code:    "ROLE_FORBIDDEN",
				Message: "无效的角色信息",
			})
			c.Abort()
			return
		}

		for _, r := range roles {
			if roleStr == r {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, models.APIError{
			Code:    "ROLE_FORBIDDEN",
			Message: "当前角色[" + roleStr + "]无权访问此接口",
		})
		c.Abort()
	}
}
