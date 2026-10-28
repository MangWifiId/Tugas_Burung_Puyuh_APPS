package models

import "time"

type FeedReceipt struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ReceivedDate Date      `gorm:"type:date;not null;index" json:"received_date"`
	FeedType     string    `gorm:"size:80;not null;default:layer" json:"feed_type"`
	Sacks        float64   `gorm:"not null" json:"sacks"`
	PricePerSack float64   `gorm:"not null" json:"price_per_sack"`
	Notes        string    `gorm:"size:1000" json:"notes"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (f FeedReceipt) TotalPrice() float64 { return float64(f.Sacks) * f.PricePerSack }

type FeedPriceHistory struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	FeedType      string    `gorm:"size:80;not null;index" json:"feed_type"`
	PricePerSack  float64   `gorm:"not null" json:"price_per_sack"`
	EffectiveDate Date      `gorm:"type:date;not null;index" json:"effective_date"`
	FeedReceiptID *uint     `gorm:"index" json:"feed_receipt_id,omitempty"`
	Notes         string    `gorm:"size:500" json:"notes"`
	CreatedAt     time.Time `json:"created_at"`
}
