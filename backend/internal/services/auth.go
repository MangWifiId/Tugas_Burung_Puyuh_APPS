package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/config"
	"manajemen-puyuh/backend/internal/database"
	"manajemen-puyuh/backend/internal/models"
	"manajemen-puyuh/backend/internal/tenancy"
	"manajemen-puyuh/backend/internal/utils"
)

type AuthService struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAuthService(db *gorm.DB, cfg *config.Config) *AuthService {
	return &AuthService{db: db, cfg: cfg}
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RegisterInput struct {
	Name     string `json:"name" binding:"required,max=120"`
	FarmName string `json:"farm_name" binding:"max=160"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

type LoginResult struct {
	Token     string      `json:"token"`
	ExpiresAt time.Time   `json:"expires_at"`
	User      models.User `json:"user"`
}

func (s *AuthService) Login(input LoginInput) (*LoginResult, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	var user models.User
	if err := s.db.Where("LOWER(email) = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.Unauthorized("email atau kata sandi salah")
		}
		return nil, err
	}
	if !utils.CheckPassword(user.PasswordHash, input.Password) {
		return nil, apperr.Unauthorized("email atau kata sandi salah")
	}
	if user.TenantID == 0 {
		return nil, apperr.Unauthorized("akun belum terhubung ke kandang")
	}

	token, expiresAt, err := utils.GenerateToken(s.cfg.JWTSecret, user.ID, user.TenantID, user.Role, s.cfg.JWTExpiry)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	user.LastLoginAt = &now
	_ = s.db.Model(&user).Update("last_login_at", now).Error
	LogActivity(tenantDB(s.db, user.TenantID), Actor{ID: user.ID, Name: user.Name}, "login", "auth", user.ID, "Masuk ke aplikasi")
	return &LoginResult{Token: token, ExpiresAt: expiresAt, User: user}, nil
}

func (s *AuthService) Register(input RegisterInput) (*LoginResult, error) {
	name := strings.TrimSpace(input.Name)
	email := strings.ToLower(strings.TrimSpace(input.Email))
	farmName := strings.TrimSpace(input.FarmName)
	if farmName == "" {
		farmName = name
	}

	var count int64
	if err := s.db.Model(&models.User{}).Where("LOWER(email) = ?", email).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, apperr.Conflict("email sudah digunakan")
	}

	hash, err := utils.HashPassword(input.Password)
	if err != nil {
		return nil, err
	}

	var user models.User
	err = s.db.Transaction(func(tx *gorm.DB) error {
		slug, err := uniqueSlug(tx, farmName)
		if err != nil {
			return err
		}
		tenant := models.Tenant{Name: farmName, Slug: slug}
		if err := tx.Create(&tenant).Error; err != nil {
			return err
		}
		user = models.User{
			TenantID:     tenant.ID,
			Name:         name,
			Email:        email,
			PasswordHash: hash,
			Role:         models.RoleOwner,
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		if err := database.SeedTenant(tx, tenant.ID); err != nil {
			return err
		}
		scoped := tenancy.WithTenant(tx, context.Background(), tenant.ID)
		for key, value := range map[string]string{
			"farm_name":  farmName,
			"owner_name": name,
		} {
			if err := scoped.Model(&models.AppSetting{}).Where("key = ?", key).
				Update("value", value).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	token, expiresAt, err := utils.GenerateToken(s.cfg.JWTSecret, user.ID, user.TenantID, user.Role, s.cfg.JWTExpiry)
	if err != nil {
		return nil, err
	}

	LogActivity(tenantDB(s.db, user.TenantID), Actor{ID: user.ID, Name: user.Name}, "register", "auth", user.ID, "Mendaftar akun baru")
	return &LoginResult{Token: token, ExpiresAt: expiresAt, User: user}, nil
}

func tenantDB(db *gorm.DB, tenantID uint) *gorm.DB {
	return tenancy.WithTenant(db, context.Background(), tenantID)
}

func uniqueSlug(tx *gorm.DB, name string) (string, error) {
	base := slugify(name)
	if base == "" {
		base = "kandang"
	}
	candidate := base
	for i := 2; i < 1000; i++ {
		var count int64
		if err := tx.Model(&models.Tenant{}).Where("slug = ?", candidate).Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s-%d", base, i)
	}
	return "", fmt.Errorf("tidak dapat membuat slug unik")
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	lastDash := false
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			builder.WriteRune(r)
			lastDash = false
		default:
			if !lastDash && builder.Len() > 0 {
				builder.WriteByte('-')
				lastDash = true
			}
		}
	}
	return strings.Trim(builder.String(), "-")
}

func (s *AuthService) Logout(userID uint) {
	if user, err := s.UserByID(userID); err == nil {
		LogActivity(tenantDB(s.db, user.TenantID), Actor{ID: user.ID, Name: user.Name}, "logout", "auth", user.ID, "Keluar dari aplikasi")
	}
}

func (s *AuthService) UserByID(id uint) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.Unauthorized("sesi tidak valid")
		}
		return nil, err
	}
	return &user, nil
}

type ChangePasswordInput struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

func (s *AuthService) ChangePassword(userID uint, input ChangePasswordInput) error {
	user, err := s.UserByID(userID)
	if err != nil {
		return err
	}
	if !utils.CheckPassword(user.PasswordHash, input.CurrentPassword) {
		return apperr.BadRequest("kata sandi saat ini tidak sesuai")
	}
	if input.CurrentPassword == input.NewPassword {
		return apperr.BadRequest("kata sandi baru harus berbeda dari kata sandi lama")
	}
	hash, err := utils.HashPassword(input.NewPassword)
	if err != nil {
		return err
	}
	if err := s.db.Model(user).Update("password_hash", hash).Error; err != nil {
		return err
	}
	LogActivity(tenantDB(s.db, user.TenantID), Actor{ID: user.ID, Name: user.Name}, "update", "auth", user.ID, "Mengubah kata sandi")
	return nil
}

type UpdateProfileInput struct {
	Name  string `json:"name" binding:"required,max=120"`
	Email string `json:"email" binding:"required,email"`
}

func (s *AuthService) UpdateProfile(userID uint, input UpdateProfileInput) (*models.User, error) {
	user, err := s.UserByID(userID)
	if err != nil {
		return nil, err
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	var duplicate int64
	if err := s.db.Model(&models.User{}).Where("LOWER(email) = ? AND id <> ?", email, userID).Count(&duplicate).Error; err != nil {
		return nil, err
	}
	if duplicate > 0 {
		return nil, apperr.Conflict("email sudah digunakan")
	}
	user.Name = strings.TrimSpace(input.Name)
	user.Email = email
	if err := s.db.Save(user).Error; err != nil {
		return nil, err
	}
	return user, nil
}
