package models

import "time"

const (
	EventPlanned   = "planned"
	EventDone      = "done"
	EventCancelled = "cancelled"
)

type CalendarEvent struct {
	ID           uint        `gorm:"primaryKey" json:"id"`
	Title        string      `gorm:"size:160;not null" json:"title"`
	EventDate    Date        `gorm:"type:date;not null;index" json:"event_date"`
	EventType    string      `gorm:"size:50;not null;default:lainnya;index" json:"event_type"`
	BatchID      *uint       `gorm:"index" json:"batch_id,omitempty"`
	Batch        *QuailBatch `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"batch,omitempty"`
	Notes        string      `gorm:"size:1000" json:"notes"`
	Reminder     bool        `gorm:"not null;default:true" json:"reminder"`
	ReminderDays int         `gorm:"not null;default:1" json:"reminder_days"`
	Status       string      `gorm:"size:20;not null;default:planned;index" json:"status"`
	BatchAgeDays *int        `gorm:"-" json:"batch_age_days,omitempty"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}
