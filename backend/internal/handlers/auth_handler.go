package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"quail-management/backend/internal/auth"
	"quail-management/backend/internal/config"
	"quail-management/backend/internal/database"
	"quail-management/backend/internal/models"
	"quail-management/backend/internal/response"
)

type AuthHandler struct {
	cfg *config.Config
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{cfg: cfg}
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	FarmName string `json:"farm_name"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Format data login tidak valid")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	db := database.DBInstance
	db.RLock()

	var foundUser *models.User
	for _, u := range db.Users {
		if strings.EqualFold(u.Email, email) && u.IsActive {
			userCopy := u
			foundUser = &userCopy
			break
		}
	}
	db.RUnlock()

	if foundUser == nil || foundUser.PasswordHash == "" {
		response.Unauthorized(c, "Email atau kata sandi tidak sesuai")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(foundUser.PasswordHash), []byte(req.Password)); err != nil {
		response.Unauthorized(c, "Email atau kata sandi tidak sesuai")
		return
	}

	var farmID *uuid.UUID
	db.RLock()
	if len(db.Farms) > 0 {
		fID := db.Farms[0].ID
		farmID = &fID
	}
	db.RUnlock()

	token, err := auth.GenerateToken(foundUser.ID, foundUser.Email, foundUser.Role, farmID, h.cfg.JWTSecret, h.cfg.JWTExpiresHours)
	if err != nil {
		response.InternalServerError(c, "Gagal membuat token otentikasi")
		return
	}

	response.JSON(c, http.StatusOK, "Login berhasil", gin.H{
		"token": token,
		"user": gin.H{
			"id":      foundUser.ID,
			"name":    foundUser.Name,
			"email":   foundUser.Email,
			"role":    foundUser.Role,
			"farm_id": farmID,
		},
	})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data registrasi tidak lengkap atau password kurang dari 6 karakter")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	// Registrasi publik hanya diizinkan untuk instalasi baru atau jika
	// ALLOW_REGISTRATION=true. Mencegah siapa pun membuat akun owner.
	if len(db.Users) > 0 && !h.cfg.AllowRegistration {
		response.Forbidden(c, "Registrasi publik dinonaktifkan. Hubungi pemilik peternakan untuk membuat akun.")
		return
	}

	for _, u := range db.Users {
		if strings.EqualFold(u.Email, email) {
			response.Conflict(c, "Email sudah terdaftar dalam sistem")
			return
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.InternalServerError(c, "Gagal mengenkripsi kata sandi")
		return
	}

	now := time.Now().UTC()
	newUser := models.User{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		Name:          strings.TrimSpace(req.Name),
		Email:         email,
		PasswordHash:  string(hash),
		Role:          "owner",
		IsActive:      true,
	}
	db.Users = append(db.Users, newUser)

	var farmID *uuid.UUID
	if len(db.Farms) > 0 {
		fID := db.Farms[0].ID
		farmID = &fID
	}

	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Registrasi gagal disimpan, silakan coba lagi")
		return
	}

	token, _ := auth.GenerateToken(newUser.ID, newUser.Email, newUser.Role, farmID, h.cfg.JWTSecret, h.cfg.JWTExpiresHours)

	response.JSON(c, http.StatusCreated, "Registrasi berhasil", gin.H{
		"token": token,
		"user": gin.H{
			"id":      newUser.ID,
			"name":    newUser.Name,
			"email":   newUser.Email,
			"role":    newUser.Role,
			"farm_id": farmID,
		},
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		response.Unauthorized(c, "Pengguna belum terotentikasi")
		return
	}
	userID := userIDVal.(uuid.UUID)

	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	for _, u := range db.Users {
		if u.ID == userID {
			var currentFarm *models.Farm
			if len(db.Farms) > 0 {
				f := db.Farms[0]
				currentFarm = &f
			}
			response.JSON(c, http.StatusOK, "Profil pengguna", gin.H{
				"id":    u.ID,
				"name":  u.Name,
				"email": u.Email,
				"role":  u.Role,
				"farm":  currentFarm,
			})
			return
		}
	}

	response.NotFound(c, "Data pengguna tidak ditemukan")
}
