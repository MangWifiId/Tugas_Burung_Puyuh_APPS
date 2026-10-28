package models

import "time"

const (
	PickupPending  = "pending"
	PickupInvoiced = "invoiced"
)

type EggPickup struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	PickupDate   Date      `gorm:"type:date;not null;index" json:"pickup_date"`
	EggCount     int       `gorm:"not null" json:"egg_count"`
	PricePerUnit *float64  `json:"price_per_unit,omitempty"`
	Status       string    `gorm:"size:20;not null;default:pending;index" json:"status"`
	Notes        string    `gorm:"size:1000" json:"notes"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type SalesNote struct {
	ID            uint        `gorm:"primaryKey" json:"id"`
	NoteNumber    string      `gorm:"size:80;uniqueIndex;not null" json:"note_number"`
	NoteDate      Date        `gorm:"type:date;not null;index" json:"note_date"`
	PeriodStart   *Date       `gorm:"type:date" json:"period_start,omitempty"`
	PeriodEnd     *Date       `gorm:"type:date" json:"period_end,omitempty"`
	TotalEggs     int         `json:"total_eggs"`
	TotalAmount   float64     `gorm:"not null" json:"total_amount"`
	FeedDeduction float64     `json:"feed_deduction"`
	Notes         string      `gorm:"size:1000" json:"notes"`
	Pickups       []EggPickup `gorm:"many2many:sales_note_pickups" json:"pickups,omitempty"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}
