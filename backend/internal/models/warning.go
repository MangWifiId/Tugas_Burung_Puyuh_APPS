package models

import "time"

const (
	WarningOpen         = "open"
	WarningAcknowledged = "acknowledged"

	LevelNormal  = "normal"
	LevelWaspada = "waspada"
	LevelKritis  = "kritis"
)

type WarningRule struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	TenantID    uint      `gorm:"index;uniqueIndex:idx_warning_rules_tenant_code" json:"-"`
	Code        string    `gorm:"size:80;uniqueIndex:idx_warning_rules_tenant_code;not null" json:"code"`
	Name        string    `gorm:"size:160;not null" json:"name"`
	Category    string    `gorm:"size:30;not null;index" json:"category"`
	Level       string    `gorm:"size:20;not null" json:"level"`
	Threshold   float64   `gorm:"not null" json:"threshold"`
	Unit        string    `gorm:"size:20" json:"unit"`
	Description string    `gorm:"size:500" json:"description"`
	Enabled     bool      `gorm:"not null;default:true" json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type WarningEvent struct {
	ID               uint         `gorm:"primaryKey" json:"id"`
	TenantID         uint         `gorm:"index;uniqueIndex:idx_warning_tenant_day" json:"-"`
	RuleID           *uint        `gorm:"index" json:"rule_id,omitempty"`
	Rule             *WarningRule `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"rule,omitempty"`
	Code             string       `gorm:"size:80;not null;uniqueIndex:idx_warning_tenant_day" json:"code"`
	Category         string       `gorm:"size:30;not null;index" json:"category"`
	Level            string       `gorm:"size:20;not null;index" json:"level"`
	Title            string       `gorm:"size:200;not null" json:"title"`
	Description      string       `gorm:"size:1000" json:"description"`
	MetricValue      float64      `json:"metric_value"`
	Threshold        float64      `json:"threshold"`
	EventDate        Date         `gorm:"type:date;not null;uniqueIndex:idx_warning_tenant_day" json:"event_date"`
	DetectedAt       time.Time    `json:"detected_at"`
	Status           string       `gorm:"size:20;not null;default:open;index" json:"status"`
	AcknowledgedAt   *time.Time   `json:"acknowledged_at,omitempty"`
	AcknowledgedBy   *uint        `json:"acknowledged_by,omitempty"`
	AcknowledgedName string       `gorm:"size:120" json:"acknowledged_name,omitempty"`
	CreatedAt        time.Time    `json:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at"`
}
