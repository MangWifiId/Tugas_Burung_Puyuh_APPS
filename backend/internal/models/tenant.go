package models

import "time"

// Tenant merepresentasikan satu usaha/kandang. Pada model 1 user = 1 kandang,
// setiap user memiliki tepat satu TenantID.
type Tenant struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:160;not null" json:"name"`
	Slug      string    `gorm:"size:160;uniqueIndex;not null" json:"slug"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// IsTenantScoped menandai model yang datanya harus selalu difilter per tenant.
// User dan Tenant sendiri tidak termasuk karena login harus bisa mencari user
// lintas tenant.
func (QuailBatch) IsTenantScoped()           {}
func (PopulationAdjustment) IsTenantScoped() {}
func (EggProduction) IsTenantScoped()        {}
func (MortalityRecord) IsTenantScoped()      {}
func (EggPickup) IsTenantScoped()            {}
func (SalesNote) IsTenantScoped()            {}
func (FeedReceipt) IsTenantScoped()          {}
func (FeedPriceHistory) IsTenantScoped()     {}
func (CalendarEvent) IsTenantScoped()        {}
func (WarningRule) IsTenantScoped()          {}
func (WarningEvent) IsTenantScoped()         {}
func (AppSetting) IsTenantScoped()           {}
func (ActivityLog) IsTenantScoped()          {}
