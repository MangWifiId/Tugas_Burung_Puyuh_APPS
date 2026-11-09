package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"manajemen-puyuh/backend/internal/models"
	"manajemen-puyuh/backend/internal/services"
	"manajemen-puyuh/backend/internal/utils"
)

const (
	userContextKey   = "auth_user"
	tenantContextKey = "auth_tenant"
)

func Auth(secret string, authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			utils.Fail(c, http.StatusUnauthorized, "token autentikasi tidak ditemukan", nil)
			c.Abort()
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		claims, err := utils.ParseToken(secret, token)
		if err != nil {
			utils.Fail(c, http.StatusUnauthorized, "sesi berakhir, silakan login kembali", nil)
			c.Abort()
			return
		}
		user, err := authService.UserByID(claims.UserID)
		if err != nil {
			utils.Fail(c, http.StatusUnauthorized, "sesi tidak valid", nil)
			c.Abort()
			return
		}
		if user.TenantID == 0 {
			utils.Fail(c, http.StatusUnauthorized, "akun belum terhubung ke kandang", nil)
			c.Abort()
			return
		}
		c.Set(userContextKey, user)
		c.Set(tenantContextKey, user.TenantID)
		c.Next()
	}
}

func CurrentUser(c *gin.Context) *models.User {
	if value, ok := c.Get(userContextKey); ok {
		if user, ok := value.(*models.User); ok {
			return user
		}
	}
	return nil
}

// TenantID mengembalikan id kandang milik user yang sedang login.
func TenantID(c *gin.Context) uint {
	if value, ok := c.Get(tenantContextKey); ok {
		if id, ok := value.(uint); ok {
			return id
		}
	}
	return 0
}
