package middleware

import (
	"database/sql"
	"net/http"
	"strconv"

	"coldchain/models"

	"github.com/gin-gonic/gin"
)

var DB *sql.DB

func SetDB(db *sql.DB) {
	DB = db
}

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

		var dbRole string
		err = DB.QueryRow("SELECT role FROM users WHERE id = ?", userID).Scan(&dbRole)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.APIError{
				Code:    "UNAUTHORIZED",
				Message: "用户不存在",
			})
			c.Abort()
			return
		}

		if dbRole != role {
			c.JSON(http.StatusForbidden, models.APIError{
				Code:    "ROLE_MISMATCH",
				Message: "角色与用户身份不匹配，请重新登录",
			})
			c.Abort()
			return
		}

		c.Set("userID", userID)
		c.Set("role", dbRole)
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
