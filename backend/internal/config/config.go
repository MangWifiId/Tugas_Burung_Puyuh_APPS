package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Env            string
	Port           string
	Timezone       string
	DBDriver       string
	DatabaseURL    string
	SQLitePath     string
	JWTSecret      string
	JWTExpiry      time.Duration
	AdminName      string
	AdminEmail     string
	AdminPassword  string
	SeedDemo       bool
	AllowedOrigins []string
}

func Load() *Config {
	_ = godotenv.Load()

	cfg := &Config{
		Env:           env("APP_ENV", "development"),
		Port:          env("PORT", "8080"),
		Timezone:      env("APP_TIMEZONE", "Asia/Jakarta"),
		DBDriver:      strings.ToLower(env("DB_DRIVER", "")),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		SQLitePath:    env("SQLITE_PATH", "data/puyuh.db"),
		JWTSecret:     env("JWT_SECRET", "dev-secret-change-me"),
		JWTExpiry:     time.Duration(envInt("JWT_EXPIRY_HOURS", 24)) * time.Hour,
		AdminName:     env("ADMIN_NAME", "Pemilik Kandang"),
		AdminEmail:    env("ADMIN_EMAIL", "admin@kandang.local"),
		AdminPassword: env("ADMIN_PASSWORD", "Admin123!"),
		SeedDemo:      envBool("SEED_DEMO", false),
		AllowedOrigins: strings.Split(
			env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"),
			",",
		),
	}

	// DATABASE_URL menandakan PostgreSQL (Neon). Tanpa itu, gunakan SQLite
	// agar pengembangan lokal tetap bisa berjalan tanpa server database.
	if cfg.DBDriver == "" {
		if cfg.DatabaseURL != "" {
			cfg.DBDriver = "postgres"
		} else {
			cfg.DBDriver = "sqlite"
		}
	}

	if cfg.Env == "production" && cfg.JWTSecret == "dev-secret-change-me" {
		log.Fatal("JWT_SECRET wajib diubah pada mode production")
	}

	return cfg
}

func (c *Config) IsProduction() bool { return c.Env == "production" }

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}
