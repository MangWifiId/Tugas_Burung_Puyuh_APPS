package database

import (
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"manajemen-puyuh/backend/internal/config"
	"manajemen-puyuh/backend/internal/models"
	"manajemen-puyuh/backend/internal/tenancy"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	var dialector gorm.Dialector

	switch cfg.DBDriver {
	case "postgres":
		if cfg.DatabaseURL == "" {
			return nil, fmt.Errorf("DATABASE_URL wajib diisi untuk driver postgres")
		}
		dialector = postgres.Open(poolerSafeDSN(cfg.DatabaseURL))
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
	if err := tenancy.Register(db); err != nil {
		return nil, fmt.Errorf("gagal memasang filter tenant: %w", err)
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

// poolerSafeDSN menambahkan pengaturan pgx yang aman untuk connection pooler
// seperti PgBouncer/Neon. Tanpa ini, prepared statement yang di-cache pgx bisa
// gagal setelah perubahan skema ("cached plan must not change result type").
func poolerSafeDSN(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	query := parsed.Query()
	if query.Get("default_query_exec_mode") == "" && query.Get("statement_cache_capacity") == "" {
		query.Set("default_query_exec_mode", "simple_protocol")
	}
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&models.Tenant{},
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
	); err != nil {
		return err
	}
	return migrateTenancy(db)
}

// tenantTables adalah tabel yang datanya dimiliki oleh satu kandang.
var tenantTables = []string{
	"users",
	"activity_logs",
	"quail_batches",
	"egg_productions",
	"mortality_records",
	"population_adjustments",
	"egg_pickups",
	"sales_notes",
	"feed_receipts",
	"feed_price_histories",
	"calendar_events",
	"warning_rules",
	"warning_events",
	"app_settings",
}

// legacyUniqueIndexes adalah index unik lama yang hanya berlaku global.
// Setelah multi-tenant, keunikan harus per tenant sehingga index ini dibuang.
var legacyUniqueIndexes = []string{
	"idx_app_settings_key",
	"idx_warning_rules_code",
	"idx_warning_day",
	"idx_sales_notes_note_number",
}

func migrateTenancy(db *gorm.DB) error {
	for _, index := range legacyUniqueIndexes {
		if err := db.Exec("DROP INDEX IF EXISTS " + index).Error; err != nil {
			return fmt.Errorf("gagal menghapus index lama %s: %w", index, err)
		}
	}

	tenant, err := EnsureDefaultTenant(db)
	if err != nil {
		return err
	}
	for _, table := range tenantTables {
		if err := db.Exec(
			"UPDATE "+table+" SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = 0",
			tenant.ID,
		).Error; err != nil {
			return fmt.Errorf("gagal mengisi tenant_id pada %s: %w", table, err)
		}
	}

	// SQLite tidak mendukung ALTER COLUMN SET NOT NULL. Untuk PostgreSQL,
	// paksa NOT NULL agar baris baru tidak bisa lolos tanpa tenant.
	if db.Dialector.Name() == "postgres" {
		for _, table := range tenantTables {
			if err := db.Exec("ALTER TABLE " + table + " ALTER COLUMN tenant_id SET NOT NULL").Error; err != nil {
				return fmt.Errorf("gagal menetapkan tenant_id wajib pada %s: %w", table, err)
			}
		}
	}
	return nil
}

// EnsureDefaultTenant mengembalikan tenant pertama, atau membuat tenant default
// jika belum ada. Dipakai saat migrasi data lama dan saat seeding.
func EnsureDefaultTenant(db *gorm.DB) (*models.Tenant, error) {
	var tenant models.Tenant
	err := db.Order("id ASC").First(&tenant).Error
	if err == nil {
		return &tenant, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	tenant = models.Tenant{Name: "Kandang Utama", Slug: "kandang-utama"}
	if err := db.Create(&tenant).Error; err != nil {
		return nil, err
	}
	return &tenant, nil
}
