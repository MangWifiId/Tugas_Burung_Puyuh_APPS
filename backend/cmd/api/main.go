package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"quail-management/backend/internal/config"
	"quail-management/backend/internal/database"
	"quail-management/backend/internal/middleware"
	"quail-management/backend/internal/response"
	"quail-management/backend/internal/routes"
)

func main() {
	cfg := config.LoadConfig()

	if cfg.GinMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	isProduction := strings.EqualFold(cfg.AppEnv, "production") ||
		cfg.GinMode == "release"

	dbMode := "json_file_storage"
	dbDetail := filepath.Join(cfg.DataDir, "database.json")

	// Produksi wajib memiliki konfigurasi PostgreSQL.
	if isProduction && cfg.DatabaseURL == "" &&
		(cfg.DBHost == "" || cfg.DBHost == "localhost" ||
			cfg.DBHost == "127.0.0.1") {
		log.Fatal("DATABASE_URL atau konfigurasi PostgreSQL produksi wajib tersedia")
	}

	// Hubungkan PostgreSQL jika dikonfigurasi.
	var jdbInitialized bool

	if cfg.DatabaseURL != "" ||
		(cfg.DBHost != "" && cfg.DBHost != "localhost") {

		gormDB, err := database.Connect(cfg)
		if err != nil {
			if isProduction {
				log.Fatalf("Koneksi PostgreSQL produksi gagal: %v", err)
			}
			log.Printf("PostgreSQL tidak tersedia: %v", err)
		} else {
			log.Println("Koneksi PostgreSQL berhasil")

			if err := database.AutoMigrate(gormDB); err != nil {
				log.Fatalf("Migrasi skema PostgreSQL gagal: %v", err)
			}

			dbMode = "postgresql_mirror"
			dbDetail = "PostgreSQL aktif; handler yang ada masih menggunakan JSON"

			// JSON tetap diinisialisasi untuk kompatibilitas handler lama.
			// Sinkronisasi awal tidak dilakukan otomatis agar tidak menimpa
			// data PostgreSQL yang sudah ada dengan data JSON yang lebih lama.
			jdb, err := database.InitJSONDB(cfg.DataDir)
			if err != nil {
				log.Fatalf("Inisialisasi JSON untuk kompatibilitas gagal: %v", err)
			}
			_ = jdb
			jdbInitialized = true
		}
	}

	// Mode lokal tanpa PostgreSQL tetap menggunakan JSON.
	if !jdbInitialized {
		if isProduction {
			log.Fatal("PostgreSQL wajib aktif di produksi; JSON fallback dinonaktifkan")
		}

		if _, err := database.InitJSONDB(cfg.DataDir); err != nil {
			log.Fatalf("Gagal inisialisasi basis data JSON: %v", err)
		}
	}

	if isProduction &&
		cfg.JWTSecret == "super_secret_jwt_key_default_development" {
		log.Fatal("JWT_SECRET masih memakai nilai default; atur secret yang aman")
	}

	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.CORSMiddleware(cfg.CORSOrigins))

	v1 := router.Group("/api/v1")
	{
		v1.GET("/health", func(c *gin.Context) {
			response.JSON(c, http.StatusOK,
				"Sistem Manajemen Peternakan Puyuh API Aktif",
				gin.H{
					"status":   "healthy",
					"database": dbMode,
					"detail":   dbDetail,
					"app_env":  cfg.AppEnv,
					"version":  "1.0.0",
				},
			)
		})

		routes.RegisterRoutes(v1, cfg)
	}

	// Sajikan frontend jika folder hasil build tersedia.
	for _, distPath := range []string{
		"frontend/dist",
		"../frontend/dist",
		"dist",
	} {
		if stat, err := os.Stat(distPath); err == nil && stat.IsDir() {
			router.Static("/assets", filepath.Join(distPath, "assets"))
			router.StaticFile("/favicon.svg", filepath.Join(distPath, "favicon.svg"))
			router.StaticFile("/icons.svg", filepath.Join(distPath, "icons.svg"))

			frontendPath := distPath
			router.NoRoute(func(c *gin.Context) {
				if !strings.HasPrefix(c.Request.URL.Path, "/api") {
					c.File(filepath.Join(frontendPath, "index.html"))
					return
				}
				response.NotFound(c, "Endpoint API tidak ditemukan")
			})

			log.Println("Web UI Frontend disajikan dari:", distPath)
			break
		}
	}

	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf(
		"Server Backend berjalan di http://localhost%s (Mode Basis Data: %s)",
		serverAddr,
		dbMode,
	)

	if err := router.Run(serverAddr); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
