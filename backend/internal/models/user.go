package models

import "time"

const (
	RoleOwner = "owner"
	RoleStaff = "staff"
)

type User struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	TenantID     uint       `gorm:"index" json:"tenant_id"`
	Name         string     `gorm:"size:120;not null" json:"name"`
	Email        string     `gorm:"size:190;uniqueIndex;not null" json:"email"`
	PasswordHash string     `gorm:"size:255;not null" json:"-"`
	Role         string     `gorm:"size:30;not null;default:owner" json:"role"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`

	EmailVerified              bool       `gorm:"not null;default:false" json:"email_verified"`
	EmailVerifiedAt            *time.Time `json:"email_verified_at,omitempty"`
	EmailVerificationTokenHash string     `gorm:"size:64;index" json:"-"`
	EmailVerificationExpiresAt *time.Time `json:"-"`
}

type ActivityLog struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	TenantID    uint      `gorm:"index" json:"-"`
	UserID      *uint     `json:"user_id,omitempty"`
	UserName    string    `gorm:"size:120" json:"user_name"`
	Action      string    `gorm:"size:30;not null;index" json:"action"`
	Entity      string    `gorm:"size:50;not null;index" json:"entity"`
	EntityID    uint      `json:"entity_id"`
	Description string    `gorm:"size:500" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}
