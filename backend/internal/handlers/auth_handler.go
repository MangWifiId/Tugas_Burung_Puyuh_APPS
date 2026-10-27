package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

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

var (
	errRegistrationDisabled = errors.New("registrasi publik dinonaktifkan")
	errEmailAlreadyExists   = errors.New("email sudah terdaftar")
)

// getActiveFarm mengambil peternakan aktif pertama.
// Model User saat ini belum memiliki relasi langsung ke Farm.
func getActiveFarm(db *gorm.DB) (*models.Farm, error) {
	var farm models.Farm

	err := db.Where("is_active = ?", true).
		Order("created_at ASC").
		First(&farm).Error

	if err != nil {
		return nil, err
	}

	return &farm, nil
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Format data login tidak valid")
		return
	}

	// PostgreSQL menjadi jalur utama jika koneksi tersedia.
	// JSON tetap digunakan untuk pengembangan lokal dan pengujian.
	if database.DB == nil {
		h.loginJSON(c, req)
		return
	}

	db := database.DB
	email := strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	err := db.Where("LOWER(email) = ?", email).
		Where("is_active = ?", true).
		First(&user).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.Unauthorized(c, "Email atau kata sandi tidak sesuai")
		return
	}
	if err != nil {
		response.InternalServerError(c, "Gagal membaca data pengguna")
		return
	}

	if user.PasswordHash == "" ||
		bcrypt.CompareHashAndPassword(
			[]byte(user.PasswordHash),
			[]byte(req.Password),
		) != nil {
		response.Unauthorized(c, "Email atau kata sandi tidak sesuai")
		return
	}

	farm, err := getActiveFarm(db)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		response.InternalServerError(c, "Gagal membaca data peternakan")
		return
	}

	var farmID *uuid.UUID
	if farm != nil {
		farmID = &farm.ID
	}

	token, err := auth.GenerateToken(
		user.ID,
		user.Email,
		user.Role,
		farmID,
		h.cfg.JWTSecret,
		h.cfg.JWTExpiresHours,
	)
	if err != nil {
		response.InternalServerError(c, "Gagal membuat token otentikasi")
		return
	}

	response.JSON(c, http.StatusOK, "Login berhasil", gin.H{
		"token": token,
		"user": gin.H{
			"id":      user.ID,
			"name":    user.Name,
			"email":   user.Email,
			"role":    user.Role,
			"farm_id": farmID,
		},
	})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(
			c,
			"Data registrasi tidak lengkap atau password kurang dari 6 karakter",
		)
		return
	}

	if database.DB == nil {
		h.registerJSON(c, req)
		return
	}

	db := database.DB
	email := strings.ToLower(strings.TrimSpace(req.Email))
	name := strings.TrimSpace(req.Name)

	if name == "" {
		response.ValidationError(c, "Nama wajib diisi")
		return
	}

	var newUser models.User
	var farmID *uuid.UUID

	err := db.Transaction(func(tx *gorm.DB) error {
		var userCount int64
		if err := tx.Model(&models.User{}).Count(&userCount).Error; err != nil {
			return err
		}

		if userCount > 0 && !h.cfg.AllowRegistration {
			return errRegistrationDisabled
		}

		var existing models.User
		err := tx.Where("LOWER(email) = ?", email).
			First(&existing).Error

		if err == nil {
			return errEmailAlreadyExists
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		hash, err := bcrypt.GenerateFromPassword(
			[]byte(req.Password),
			bcrypt.DefaultCost,
		)
		if err != nil {
			return err
		}

		now := time.Now().UTC()
		newUser = models.User{
			BaseUUIDModel: models.BaseUUIDModel{
				ID:        uuid.New(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			Name:         name,
			Email:        email,
			PasswordHash: string(hash),
			Role:         "owner",
			IsActive:     true,
		}

		if err := tx.Create(&newUser).Error; err != nil {
			return err
		}

		farm, err := getActiveFarm(tx)
		if err == nil {
			farmID = &farm.ID
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		return nil
	})

	if errors.Is(err, errRegistrationDisabled) {
		response.Forbidden(
			c,
			"Registrasi publik dinonaktifkan. Hubungi pemilik peternakan untuk membuat akun.",
		)
		return
	}
	if errors.Is(err, errEmailAlreadyExists) {
		response.Conflict(c, "Email sudah terdaftar dalam sistem")
		return
	}
	if err != nil {
		response.InternalServerError(c, "Registrasi gagal disimpan, silakan coba lagi")
		return
	}

	token, err := auth.GenerateToken(
		newUser.ID,
		newUser.Email,
		newUser.Role,
		farmID,
		h.cfg.JWTSecret,
		h.cfg.JWTExpiresHours,
	)
	if err != nil {
		response.InternalServerError(
			c,
			"Akun berhasil dibuat tetapi token gagal dibuat; silakan login",
		)
		return
	}

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

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		response.Unauthorized(c, "Identitas pengguna tidak valid")
		return
	}

	if database.DB == nil {
		h.meJSON(c, userID)
		return
	}

	db := database.DB

	var user models.User
	err := db.Where("id = ?", userID).
		Where("is_active = ?", true).
		First(&user).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.NotFound(c, "Data pengguna tidak ditemukan")
		return
	}
	if err != nil {
		response.InternalServerError(c, "Gagal membaca profil pengguna")
		return
	}

	farm, err := getActiveFarm(db)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		response.InternalServerError(c, "Gagal membaca data peternakan")
		return
	}

	response.JSON(c, http.StatusOK, "Profil pengguna", gin.H{
		"id":    user.ID,
		"name":  user.Name,
		"email": user.Email,
		"role":  user.Role,
		"farm":  farm,
	})
}

// loginJSON mempertahankan autentikasi JSON untuk pengembangan lokal.
func (h *AuthHandler) loginJSON(c *gin.Context, req LoginRequest) {
	db := database.DBInstance
	if db == nil {
		response.InternalServerError(c, "Database tidak tersedia")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	db.RLock()

	var user *models.User
	for _, u := range db.Users {
		if strings.EqualFold(u.Email, email) && u.IsActive {
			copyUser := u
			user = &copyUser
			break
		}
	}

	var farmID *uuid.UUID
	if len(db.Farms) > 0 {
		id := db.Farms[0].ID
		farmID = &id
	}

	db.RUnlock()

	if user == nil || user.PasswordHash == "" ||
		bcrypt.CompareHashAndPassword(
			[]byte(user.PasswordHash),
			[]byte(req.Password),
		) != nil {
		response.Unauthorized(c, "Email atau kata sandi tidak sesuai")
		return
	}

	token, err := auth.GenerateToken(
		user.ID,
		user.Email,
		user.Role,
		farmID,
		h.cfg.JWTSecret,
		h.cfg.JWTExpiresHours,
	)
	if err != nil {
		response.InternalServerError(c, "Gagal membuat token otentikasi")
		return
	}

	response.JSON(c, http.StatusOK, "Login berhasil", gin.H{
		"token": token,
		"user": gin.H{
			"id":      user.ID,
			"name":    user.Name,
			"email":   user.Email,
			"role":    user.Role,
			"farm_id": farmID,
		},
	})
}

// registerJSON mempertahankan registrasi JSON untuk pengembangan lokal.
func (h *AuthHandler) registerJSON(c *gin.Context, req RegisterRequest) {
	db := database.DBInstance
	if db == nil {
		response.InternalServerError(c, "Database tidak tersedia")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	name := strings.TrimSpace(req.Name)

	if name == "" {
		response.ValidationError(c, "Nama wajib diisi")
		return
	}

	db.Lock()
	defer db.Unlock()

	if len(db.Users) > 0 && !h.cfg.AllowRegistration {
		response.Forbidden(
			c,
			"Registrasi publik dinonaktifkan. Hubungi pemilik peternakan untuk membuat akun.",
		)
		return
	}

	for _, u := range db.Users {
		if strings.EqualFold(u.Email, email) {
			response.Conflict(c, "Email sudah terdaftar dalam sistem")
			return
		}
	}

	hash, err := bcrypt.GenerateFromPassword(
		[]byte(req.Password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		response.InternalServerError(c, "Gagal mengenkripsi kata sandi")
		return
	}

	now := time.Now().UTC()
	user := models.User{
		BaseUUIDModel: models.BaseUUIDModel{
			ID:        uuid.New(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		Name:         name,
		Email:        email,
		PasswordHash: string(hash),
		Role:         "owner",
		IsActive:     true,
	}

	db.Users = append(db.Users, user)

	var farmID *uuid.UUID
	if len(db.Farms) > 0 {
		id := db.Farms[0].ID
		farmID = &id
	}

	if err := db.Persist(); err != nil {
		response.InternalServerError(
			c,
			"Registrasi gagal disimpan, silakan coba lagi",
		)
		return
	}

	token, err := auth.GenerateToken(
		user.ID,
		user.Email,
		user.Role,
		farmID,
		h.cfg.JWTSecret,
		h.cfg.JWTExpiresHours,
	)
	if err != nil {
		response.InternalServerError(c, "Gagal membuat token otentikasi")
		return
	}

	response.JSON(c, http.StatusCreated, "Registrasi berhasil", gin.H{
		"token": token,
		"user": gin.H{
			"id":      user.ID,
			"name":    user.Name,
			"email":   user.Email,
			"role":    user.Role,
			"farm_id": farmID,
		},
	})
}

// meJSON mengambil profil dari JSON untuk pengembangan lokal.
func (h *AuthHandler) meJSON(c *gin.Context, userID uuid.UUID) {
	db := database.DBInstance
	if db == nil {
		response.InternalServerError(c, "Database tidak tersedia")
		return
	}

	db.RLock()
	defer db.RUnlock()

	for _, user := range db.Users {
		if user.ID == userID {
			var farm *models.Farm
			if len(db.Farms) > 0 {
				copyFarm := db.Farms[0]
				farm = &copyFarm
			}

			response.JSON(c, http.StatusOK, "Profil pengguna", gin.H{
				"id":    user.ID,
				"name":  user.Name,
				"email": user.Email,
				"role":  user.Role,
				"farm":  farm,
			})
			return
		}
	}

	response.NotFound(c, "Data pengguna tidak ditemukan")
}
