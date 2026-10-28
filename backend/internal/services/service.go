package services

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
)

type Actor struct {
	ID   uint
	Name string
}

type Service struct {
	DB *gorm.DB
}

func New(db *gorm.DB) *Service { return &Service{DB: db} }

func LogActivity(db *gorm.DB, actor Actor, action, entity string, entityID uint, description string) {
	if utf8.RuneCountInString(description) > 480 {
		runes := []rune(description)
		description = string(runes[:480]) + "..."
	}
	entry := models.ActivityLog{
		Action:      action,
		Entity:      entity,
		EntityID:    entityID,
		Description: description,
		UserName:    actor.Name,
	}
	if actor.ID != 0 {
		entry.UserID = &actor.ID
	}
	_ = db.Create(&entry).Error
}

func ValidateRecordDate(date models.Date, label string) error {
	if date.IsZero() {
		return apperr.BadRequest(label + " wajib diisi")
	}
	if date.After(models.DateToday()) {
		return apperr.BadRequest(label + " tidak boleh melebihi hari ini")
	}
	return nil
}

func ValidatePositive(value int, label string) error {
	if value <= 0 {
		return apperr.BadRequest(label + " harus lebih besar dari 0")
	}
	return nil
}

func ParseGroupBy(value string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "day", "harian":
		return "day", nil
	case "week", "mingguan":
		return "week", nil
	case "month", "bulanan":
		return "month", nil
	default:
		return "", apperr.BadRequest("group_by harus day, week, atau month")
	}
}

// PeriodKey mengubah tanggal menjadi kunci periode untuk agregasi laporan.
func PeriodKey(date models.Date, groupBy string) (key string, label string) {
	t := date.Time()
	switch groupBy {
	case "week":
		year, week := t.ISOWeek()
		start := t.AddDate(0, 0, -int((t.Weekday()+6)%7))
		return fmt.Sprintf("%d-W%02d", year, week), start.Format("02 Jan 2006")
	case "month":
		return t.Format("2006-01"), t.Format("Jan 2006")
	default:
		return date.String(), date.Time().Format("02 Jan")
	}
}
