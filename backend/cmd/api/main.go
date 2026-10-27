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

	// Inisialisasi JSON File Database
	jdb, err := database.InitJSONDB(cfg.DataDir)
	if err != nil {
		log.Fatalf("Gagal inisialisasi basis data JSON: %v", err)
	}
	_ = jdb

	// Cek dan sambungkan ke database PostgreSQL jika dikonfigurasi
	dbMode := "json_file_storage"
	dbDetail := filepath.Join(cfg.DataDir, "database.json")

	if cfg.DatabaseURL != "" || (cfg.DBHost != "" && cfg.DBHost != "localhost") {
		gormDB, err := database.Connect(cfg)
		if err != nil {
			log.Printf("ℹ️ PostgreSQL belum dapat terhubung (%v). Menggunakan JSON File DB sebagai fallback.\n", err)
		} else {
			log.Println("✓ Berhasil terhubung ke database PostgreSQL!")
			if err := database.AutoMigrate(gormDB); err != nil {
				log.Printf("⚠️ Gagal migrasi skema PostgreSQL: %v\n", err)
			} else {
				// Sinkronkan seluruh data ke PostgreSQL
				if err := database.SyncDataToPostgres(gormDB, jdb); err != nil {
					log.Printf("⚠️ Sinkronisasi awal ke PostgreSQL tidak sepenuhnya berhasil: %v\n", err)
				}
			}
			dbMode = "postgresql_mirror"
			dbDetail = "PostgreSQL terhubung; data utama tetap JSON (mode mirror)"
			if cfg.DatabaseURL != "" {
				dbDetail = "PostgreSQL Cloud terhubung via DATABASE_URL; data utama JSON"
			}
		}
	}

	if cfg.GinMode == "release" && cfg.JWTSecret == "super_secret_jwt_key_default_development" {
		log.Println("⚠️ PERINGATAN: JWT_SECRET masih memakai nilai default. Set JWT_SECRET di environment produksi!")
	}

	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.CORSMiddleware(cfg.CORSOrigins))

	// Register API v1 Routes
	v1 := router.Group("/api/v1")
	{
		v1.GET("/health", func(c *gin.Context) {
			response.JSON(c, http.StatusOK, "Sistem Manajemen Peternakan Puyuh API Aktif", gin.H{
				"status":   "healthy",
				"database": dbMode,
				"detail":   dbDetail,
				"app_env":  cfg.AppEnv,
				"version":  "1.0.0",
			})
		})

		// Setup route handlers
		routes.RegisterRoutes(v1, cfg)
	}

	// Sajikan Web UI Frontend jika folder dist tersedia (Single Fullstack Container)
	for _, distPath := range []string{"frontend/dist", "../frontend/dist", "dist"} {
		if stat, err := os.Stat(distPath); err == nil && stat.IsDir() {
			router.Static("/assets", filepath.Join(distPath, "assets"))
			router.StaticFile("/favicon.svg", filepath.Join(distPath, "favicon.svg"))
			router.StaticFile("/icons.svg", filepath.Join(distPath, "icons.svg"))
			router.NoRoute(func(c *gin.Context) {
				if !strings.HasPrefix(c.Request.URL.Path, "/api") {
					c.File(filepath.Join(distPath, "index.html"))
					return
				}
				response.NotFound(c, "Endpoint API tidak ditemukan")
			})
			log.Println("✓ Web UI Frontend terdeteksi dan disajikan dari:", distPath)
			break
		}
	}

	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("🚀 Server Backend berjalan di http://localhost%s (Mode Basis Data: %s)\n", serverAddr, dbMode)
	if err := router.Run(serverAddr); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
