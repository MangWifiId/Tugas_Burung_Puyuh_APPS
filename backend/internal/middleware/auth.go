package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"quail-management/backend/internal/auth"
	"quail-management/backend/internal/response"
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "Header otentikasi tidak ditemukan")
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			response.Unauthorized(c, "Format token harus: Bearer <token>")
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims, err := auth.ValidateToken(tokenString, jwtSecret)
		if err != nil {
			response.Unauthorized(c, "Token tidak valid atau telah kedaluwarsa")
			c.Abort()
			return
		}

		// Simpan informasi pengguna ke dalam konteks Gin
		c.Set("userID", claims.UserID)
		c.Set("userEmail", claims.Email)
		c.Set("userRole", claims.Role)
		if claims.FarmID != nil {
			c.Set("farmID", *claims.FarmID)
		}

		c.Next()
	}
}
