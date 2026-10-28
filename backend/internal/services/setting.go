package services

import (
	"errors"
	"strings"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
)

type SettingService struct {
	db *gorm.DB
}

func NewSettingService(db *gorm.DB) *SettingService { return &SettingService{db: db} }

func (s *SettingService) List() ([]models.AppSetting, error) {
	var settings []models.AppSetting
	err := s.db.Order("group_name ASC, id ASC").Find(&settings).Error
	return settings, err
}

func (s *SettingService) Update(actor Actor, values map[string]string) ([]models.AppSetting, error) {
	if len(values) == 0 {
		return nil, apperr.BadRequest("tidak ada pengaturan yang diubah")
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		for key, value := range values {
			key = strings.TrimSpace(key)
			if key == "" {
				continue
			}
			var setting models.AppSetting
			if err := tx.Where("key = ?", key).First(&setting).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return apperr.BadRequest("pengaturan tidak dikenal: " + key)
				}
				return err
			}
			if key == "farm_name" && strings.TrimSpace(value) == "" {
				return apperr.BadRequest("nama usaha tidak boleh kosong")
			}
			if key == "warning_enabled" {
				value = strings.ToLower(strings.TrimSpace(value))
				if value != "true" && value != "false" {
					return apperr.BadRequest("nilai warning_enabled harus true atau false")
				}
			}
			if err := tx.Model(&setting).Update("value", value).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "update", "settings", 0, "Memperbarui pengaturan aplikasi")
	return s.List()
}

type ActivityService struct {
	db *gorm.DB
}

func NewActivityService(db *gorm.DB) *ActivityService { return &ActivityService{db: db} }

func (s *ActivityService) List(page, limit int) ([]models.ActivityLog, int64, error) {
	var total int64
	if err := s.db.Model(&models.ActivityLog{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var activities []models.ActivityLog
	err := s.db.Order("created_at DESC, id DESC").
		Offset((page - 1) * limit).Limit(limit).Find(&activities).Error
	return activities, total, err
}
