package models

import "time"

type EggProduction struct {
	ID             uint        `gorm:"primaryKey" json:"id"`
	BatchID        *uint       `gorm:"index" json:"batch_id,omitempty"`
	Batch          *QuailBatch `gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"batch,omitempty"`
	ProductionDate Date        `gorm:"type:date;not null;index" json:"production_date"`
	EggCount       int         `gorm:"not null" json:"egg_count"`
	Notes          string      `gorm:"size:1000" json:"notes"`
	CreatedBy      *uint       `json:"created_by,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type MortalityRecord struct {
	ID         uint        `gorm:"primaryKey" json:"id"`
	BatchID    uint        `gorm:"not null;index" json:"batch_id"`
	Batch      *QuailBatch `gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"batch,omitempty"`
	RecordDate Date        `gorm:"type:date;not null;index" json:"record_date"`
	Count      int         `gorm:"not null" json:"count"`
	Cause      string      `gorm:"size:200" json:"cause"`
	Notes      string      `gorm:"size:1000" json:"notes"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
}
