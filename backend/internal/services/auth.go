package services

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/config"
	"manajemen-puyuh/backend/internal/models"
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

	token, expiresAt, err := utils.GenerateToken(s.cfg.JWTSecret, user.ID, user.Role, s.cfg.JWTExpiry)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	user.LastLoginAt = &now
	_ = s.db.Model(&user).Update("last_login_at", now).Error
	LogActivity(s.db, Actor{ID: user.ID, Name: user.Name}, "login", "auth", user.ID, "Masuk ke aplikasi")
	return &LoginResult{Token: token, ExpiresAt: expiresAt, User: user}, nil
}

func (s *AuthService) Register(input RegisterInput) (*LoginResult, error) {
	name := strings.TrimSpace(input.Name)
	email := strings.ToLower(strings.TrimSpace(input.Email))

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

	role := models.RoleOwner
	var existing int64
	if err := s.db.Model(&models.User{}).Count(&existing).Error; err != nil {
		return nil, err
	}
	if existing > 0 {
		role = models.RoleStaff
	}

	user := models.User{
		Name:         name,
		Email:        email,
		PasswordHash: hash,
		Role:         role,
	}
	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}

	token, expiresAt, err := utils.GenerateToken(s.cfg.JWTSecret, user.ID, user.Role, s.cfg.JWTExpiry)
	if err != nil {
		return nil, err
	}

	LogActivity(s.db, Actor{ID: user.ID, Name: user.Name}, "register", "auth", user.ID, "Mendaftar akun baru")
	return &LoginResult{Token: token, ExpiresAt: expiresAt, User: user}, nil
}

func (s *AuthService) Logout(userID uint) {
	if user, err := s.UserByID(userID); err == nil {
		LogActivity(s.db, Actor{ID: user.ID, Name: user.Name}, "logout", "auth", user.ID, "Keluar dari aplikasi")
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
	LogActivity(s.db, Actor{ID: user.ID, Name: user.Name}, "update", "auth", user.ID, "Mengubah kata sandi")
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
