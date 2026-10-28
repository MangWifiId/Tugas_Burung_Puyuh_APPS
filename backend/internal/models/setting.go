package models

import "time"

type AppSetting struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Key       string    `gorm:"size:80;uniqueIndex;not null" json:"key"`
	Value     string    `gorm:"size:1000" json:"value"`
	Label     string    `gorm:"size:160" json:"label"`
	Group     string    `gorm:"column:group_name;size:50;default:umum" json:"group"`
	UpdatedAt time.Time `json:"updated_at"`
}
