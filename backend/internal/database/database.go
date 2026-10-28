package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"manajemen-puyuh/backend/internal/config"
	"manajemen-puyuh/backend/internal/models"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	var dialector gorm.Dialector

	switch cfg.DBDriver {
	case "postgres":
		if cfg.DatabaseURL == "" {
			return nil, fmt.Errorf("DATABASE_URL wajib diisi untuk driver postgres")
		}
		dialector = postgres.Open(cfg.DatabaseURL)
	case "sqlite":
		if dir := filepath.Dir(cfg.SQLitePath); dir != "." && dir != "" {
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return nil, fmt.Errorf("gagal membuat folder database: %w", err)
			}
		}
		dialector = sqlite.Open(cfg.SQLitePath)
	default:
		return nil, fmt.Errorf("DB_DRIVER tidak dikenal: %s", cfg.DBDriver)
	}

	logMode := logger.Warn
	if cfg.Env == "development" {
		logMode = logger.Info
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger:  logger.Default.LogMode(logMode),
		NowFunc: func() time.Time { return time.Now().In(time.Local) },
	})
	if err != nil {
		return nil, fmt.Errorf("gagal terhubung ke database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	if cfg.DBDriver == "postgres" {
		sqlDB.SetMaxOpenConns(10)
		sqlDB.SetMaxIdleConns(5)
		sqlDB.SetConnMaxLifetime(30 * time.Minute)
	} else {
		sqlDB.SetMaxOpenConns(1)
	}

	if err := Migrate(db); err != nil {
		return nil, err
	}

	log.Printf("database siap (%s)", cfg.DBDriver)
	return db, nil
}

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.ActivityLog{},
		&models.QuailBatch{},
		&models.EggProduction{},
		&models.MortalityRecord{},
		&models.PopulationAdjustment{},
		&models.EggPickup{},
		&models.SalesNote{},
		&models.FeedReceipt{},
		&models.FeedPriceHistory{},
		&models.CalendarEvent{},
		&models.WarningRule{},
		&models.WarningEvent{},
		&models.AppSetting{},
	)
}
