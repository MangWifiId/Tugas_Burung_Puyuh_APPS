package services

import (
	"errors"
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/config"
	"manajemen-puyuh/backend/internal/models"
	"manajemen-puyuh/backend/internal/utils"
)

func newAuthTestService(t *testing.T) (*AuthService, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "auth-test.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("gagal membuka database uji: %v", err)
	}
	if err := db.AutoMigrate(&models.Tenant{}, &models.User{}, &models.ActivityLog{}); err != nil {
		t.Fatalf("gagal migrasi database uji: %v", err)
	}
	if sqlDB, err := db.DB(); err == nil {
		t.Cleanup(func() { _ = sqlDB.Close() })
	}
	cfg := &config.Config{JWTSecret: "rahasia-uji", JWTExpiry: time.Hour}
	return NewAuthService(db, cfg, nil), db
}

func TestVerifyEmailMengaktifkanAkun(t *testing.T) {
	service, db := newAuthTestService(t)

	token, hash, err := newVerificationToken()
	if err != nil {
		t.Fatalf("gagal membuat token: %v", err)
	}
	expires := time.Now().Add(time.Hour)
	user := models.User{
		TenantID:                   1,
		Name:                       "Pengguna Uji",
		Email:                      "uji@test.local",
		PasswordHash:               "tidak-dipakai",
		Role:                       models.RoleOwner,
		EmailVerificationTokenHash: hash,
		EmailVerificationExpiresAt: &expires,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("gagal membuat pengguna: %v", err)
	}

	verified, err := service.VerifyEmail(token)
	if err != nil {
		t.Fatalf("verifikasi gagal: %v", err)
	}
	if !verified.EmailVerified || verified.EmailVerifiedAt == nil {
		t.Fatalf("pengguna seharusnya sudah terverifikasi: %+v", verified)
	}

	var stored models.User
	if err := db.First(&stored, user.ID).Error; err != nil {
		t.Fatalf("gagal membaca pengguna: %v", err)
	}
	if !stored.EmailVerified {
		t.Fatal("kolom email_verified seharusnya true")
	}
	if stored.EmailVerificationTokenHash != "" || stored.EmailVerificationExpiresAt != nil {
		t.Fatal("token verifikasi seharusnya dibersihkan setelah dipakai")
	}

	if _, err := service.VerifyEmail(token); err == nil {
		t.Fatal("token yang sudah dipakai seharusnya ditolak")
	}
}

func TestVerifyEmailMenolakTokenKedaluwarsa(t *testing.T) {
	service, db := newAuthTestService(t)

	token, hash, err := newVerificationToken()
	if err != nil {
		t.Fatalf("gagal membuat token: %v", err)
	}
	expired := time.Now().Add(-time.Minute)
	user := models.User{
		TenantID:                   1,
		Name:                       "Pengguna Uji",
		Email:                      "kedaluwarsa@test.local",
		PasswordHash:               "tidak-dipakai",
		Role:                       models.RoleOwner,
		EmailVerificationTokenHash: hash,
		EmailVerificationExpiresAt: &expired,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("gagal membuat pengguna: %v", err)
	}

	_, err = service.VerifyEmail(token)
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Status != http.StatusBadRequest {
		t.Fatalf("token kedaluwarsa seharusnya ditolak dengan 400, didapat: %v", err)
	}
}

func TestLoginMenolakEmailBelumDiverifikasi(t *testing.T) {
	service, db := newAuthTestService(t)

	password := "rahasia12345"
	hash, err := utils.HashPassword(password)
	if err != nil {
		t.Fatalf("gagal membuat hash: %v", err)
	}
	user := models.User{
		TenantID:     1,
		Name:         "Pengguna Uji",
		Email:        "belum@test.local",
		PasswordHash: hash,
		Role:         models.RoleOwner,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("gagal membuat pengguna: %v", err)
	}

	_, err = service.Login(LoginInput{Email: user.Email, Password: password})
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Status != http.StatusForbidden {
		t.Fatalf("login pengguna belum terverifikasi seharusnya 403, didapat: %v", err)
	}

	if err := db.Model(&user).UpdateColumns(map[string]any{
		"email_verified":    true,
		"email_verified_at": time.Now(),
	}).Error; err != nil {
		t.Fatalf("gagal menandai terverifikasi: %v", err)
	}

	result, err := service.Login(LoginInput{Email: user.Email, Password: password})
	if err != nil {
		t.Fatalf("login pengguna terverifikasi gagal: %v", err)
	}
	if result.Token == "" {
		t.Fatal("token login seharusnya terisi")
	}
}
