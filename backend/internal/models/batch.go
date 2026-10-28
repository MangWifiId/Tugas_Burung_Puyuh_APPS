package models

import "time"

const (
	BatchStatusActive   = "active"
	BatchStatusInactive = "inactive"
)

type QuailBatch struct {
	ID                  uint      `gorm:"primaryKey" json:"id"`
	Name                string    `gorm:"size:120;not null" json:"name"`
	HatchDate           Date      `gorm:"type:date;not null;index" json:"hatch_date"`
	EntryDate           *Date     `gorm:"type:date" json:"entry_date,omitempty"`
	InitialPopulation   int       `gorm:"not null" json:"initial_population"`
	ProductionStartDate *Date     `gorm:"type:date" json:"production_start_date,omitempty"`
	Status              string    `gorm:"size:20;not null;default:active;index" json:"status"`
	Notes               string    `gorm:"size:1000" json:"notes"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type PopulationAdjustment struct {
	ID         uint        `gorm:"primaryKey" json:"id"`
	BatchID    uint        `gorm:"not null;index" json:"batch_id"`
	Batch      *QuailBatch `gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"batch,omitempty"`
	AdjustDate Date        `gorm:"type:date;not null;index" json:"adjust_date"`
	Type       string      `gorm:"size:20;not null" json:"type"` // reduction | addition
	Quantity   int         `gorm:"not null" json:"quantity"`
	Reason     string      `gorm:"size:120" json:"reason"`
	Notes      string      `gorm:"size:1000" json:"notes"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
}

const (
	AdjustmentReduction = "reduction"
	AdjustmentAddition  = "addition"
)

// BatchStats adalah hasil perhitungan populasi, tidak disimpan di database.
type BatchStats struct {
	QuailBatch
	CurrentPopulation int     `json:"current_population"`
	TotalMortality    int     `json:"total_mortality"`
	TotalReduction    int     `json:"total_reduction"`
	TotalAddition     int     `json:"total_addition"`
	AgeDays           int     `json:"age_days"`
	AgeWeeks          int     `json:"age_weeks"`
	AgeStage          string  `json:"age_stage"`
	MortalityRate     float64 `json:"mortality_rate"`

	// Ringkasan produksi terbaru untuk perbandingan dengan standar umur.
	RecentEggs           int     `json:"recent_eggs"`
	Productivity         float64 `json:"productivity"`
	Productivity7d       float64 `json:"productivity_7d"`
	StandardProductivity float64 `json:"standard_productivity"`
	ProductivityGap      float64 `json:"productivity_gap"`
	ProductionTrend      float64 `json:"production_trend"`
	ProductivityStatus   string  `json:"productivity_status"`
	LastProductionDate   *Date   `json:"last_production_date,omitempty"`
}
