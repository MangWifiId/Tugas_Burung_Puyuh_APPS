package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	GinMode        string
	AppEnv         string
	DatabaseURL    string
	DBHost         string
	DBPort         string
	DBUser         string
	DBPassword     string
	DBName         string
	DBSSLMode      string
	JWTSecret      string
	JWTExpiresHours int
	CORSOrigins    string
}

func LoadConfig() *Config {
	// Try loading .env from current directory or parent directory
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	port := getEnv("PORT", "8080")
	ginMode := getEnv("GIN_MODE", "debug")
	appEnv := getEnv("APP_ENV", "development")

	jwtSecret := getEnv("JWT_SECRET", "super_secret_jwt_key_default_development")
	jwtHoursStr := getEnv("JWT_EXPIRES_HOURS", "72")
	jwtHours, err := strconv.Atoi(jwtHoursStr)
	if err != nil {
		jwtHours = 72
	}

	return &Config{
		Port:           port,
		GinMode:        ginMode,
		AppEnv:         appEnv,
		DatabaseURL:    getEnv("DATABASE_URL", ""),
		DBHost:         getEnv("DB_HOST", "localhost"),
		DBPort:         getEnv("DB_PORT", "5432"),
		DBUser:         getEnv("DB_USER", "postgres"),
		DBPassword:     getEnv("DB_PASSWORD", "postgres"),
		DBName:         getEnv("DB_NAME", "quail_management"),
		DBSSLMode:      getEnv("DB_SSLMODE", "disable"),
		JWTSecret:      jwtSecret,
		JWTExpiresHours: jwtHours,
		CORSOrigins:    getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
