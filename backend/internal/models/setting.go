package models

import "time"

type AppSetting struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	TenantID  uint      `gorm:"index;uniqueIndex:idx_app_settings_tenant_key" json:"-"`
	Key       string    `gorm:"size:80;uniqueIndex:idx_app_settings_tenant_key;not null" json:"key"`
	Value     string    `gorm:"size:1000" json:"value"`
	Label     string    `gorm:"size:160" json:"label"`
	Group     string    `gorm:"column:group_name;size:50;default:umum" json:"group"`
	UpdatedAt time.Time `json:"updated_at"`
}
