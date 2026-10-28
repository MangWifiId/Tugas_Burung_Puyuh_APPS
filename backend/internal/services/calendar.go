package services

import (
	"errors"
	"strings"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
)

type CalendarService struct {
	db *gorm.DB
}

func NewCalendarService(db *gorm.DB) *CalendarService { return &CalendarService{db: db} }

type EventInput struct {
	Title        string      `json:"title"`
	EventDate    models.Date `json:"event_date"`
	EventType    string      `json:"event_type"`
	BatchID      *uint       `json:"batch_id"`
	Notes        string      `json:"notes"`
	Reminder     bool        `json:"reminder"`
	ReminderDays int         `json:"reminder_days"`
	Status       string      `json:"status"`
}

func (s *CalendarService) validate(input *EventInput) (*models.QuailBatch, error) {
	input.Title = strings.TrimSpace(input.Title)
	if input.Title == "" {
		return nil, apperr.BadRequest("judul kegiatan wajib diisi")
	}
	if input.EventDate.IsZero() {
		return nil, apperr.BadRequest("tanggal kegiatan wajib diisi")
	}
	if input.EventType == "" {
		input.EventType = "lainnya"
	}
	if input.Status == "" {
		input.Status = models.EventPlanned
	}
	if input.Status != models.EventPlanned && input.Status != models.EventDone && input.Status != models.EventCancelled {
		return nil, apperr.BadRequest("status kegiatan tidak valid")
	}
	if input.ReminderDays < 0 {
		input.ReminderDays = 0
	}
	input.Notes = strings.TrimSpace(input.Notes)

	if input.BatchID != nil {
		if *input.BatchID == 0 {
			input.BatchID = nil
			return nil, nil
		}
		batch, err := FindBatch(s.db, *input.BatchID)
		if err != nil {
			return nil, err
		}
		if input.EventDate.Before(batch.HatchDate) {
			return nil, apperr.BadRequest("tanggal kegiatan tidak boleh sebelum tanggal menetas kelompok")
		}
		return batch, nil
	}
	return nil, nil
}

func (s *CalendarService) fillAge(events []models.CalendarEvent) {
	for i := range events {
		if events[i].Batch == nil || events[i].Batch.HatchDate.IsZero() {
			continue
		}
		days := int(events[i].EventDate.Time().Sub(events[i].Batch.HatchDate.Time()).Hours() / 24)
		if days < 0 {
			days = 0
		}
		events[i].BatchAgeDays = &days
	}
}

func (s *CalendarService) List(from, to models.Date, batchID uint, eventType, status string) ([]models.CalendarEvent, error) {
	query := s.db.Preload("Batch").Where("event_date BETWEEN ? AND ?", from, to)
	if batchID != 0 {
		query = query.Where("batch_id = ?", batchID)
	}
	if eventType != "" && eventType != "all" {
		query = query.Where("event_type = ?", eventType)
	}
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	var events []models.CalendarEvent
	if err := query.Order("event_date ASC, id ASC").Find(&events).Error; err != nil {
		return nil, err
	}
	s.fillAge(events)
	return events, nil
}

func (s *CalendarService) Upcoming(days int, limit int) ([]models.CalendarEvent, error) {
	if days <= 0 {
		days = 7
	}
	today := models.DateToday()
	var events []models.CalendarEvent
	err := s.db.Preload("Batch").
		Where("event_date BETWEEN ? AND ? AND status = ?", today, today.AddDays(days), models.EventPlanned).
		Order("event_date ASC, id ASC").Limit(limit).Find(&events).Error
	if err != nil {
		return nil, err
	}
	s.fillAge(events)
	return events, nil
}

func (s *CalendarService) Get(id uint) (*models.CalendarEvent, error) {
	var event models.CalendarEvent
	if err := s.db.Preload("Batch").First(&event, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("kegiatan tidak ditemukan")
		}
		return nil, err
	}
	events := []models.CalendarEvent{event}
	s.fillAge(events)
	return &events[0], nil
}

func (s *CalendarService) Create(actor Actor, input EventInput) (*models.CalendarEvent, error) {
	if _, err := s.validate(&input); err != nil {
		return nil, err
	}
	event := models.CalendarEvent{
		Title: input.Title, EventDate: input.EventDate, EventType: input.EventType,
		BatchID: input.BatchID, Notes: input.Notes, Reminder: input.Reminder,
		ReminderDays: input.ReminderDays, Status: input.Status,
	}
	if err := s.db.Create(&event).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "create", "calendar", event.ID, "Menambah kegiatan "+event.Title)
	return s.Get(event.ID)
}

func (s *CalendarService) Update(actor Actor, id uint, input EventInput) (*models.CalendarEvent, error) {
	var event models.CalendarEvent
	if err := s.db.First(&event, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("kegiatan tidak ditemukan")
		}
		return nil, err
	}
	if _, err := s.validate(&input); err != nil {
		return nil, err
	}
	event.Title = input.Title
	event.EventDate = input.EventDate
	event.EventType = input.EventType
	event.BatchID = input.BatchID
	event.Notes = input.Notes
	event.Reminder = input.Reminder
	event.ReminderDays = input.ReminderDays
	event.Status = input.Status
	if err := s.db.Save(&event).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "update", "calendar", id, "Mengubah kegiatan "+event.Title)
	return s.Get(id)
}

func (s *CalendarService) Delete(actor Actor, id uint) error {
	var event models.CalendarEvent
	if err := s.db.First(&event, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperr.NotFound("kegiatan tidak ditemukan")
		}
		return err
	}
	if err := s.db.Delete(&event).Error; err != nil {
		return err
	}
	LogActivity(s.db, actor, "delete", "calendar", id, "Menghapus kegiatan "+event.Title)
	return nil
}
