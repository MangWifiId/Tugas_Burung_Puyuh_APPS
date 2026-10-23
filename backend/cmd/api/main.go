package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"quail-management/backend/internal/config"
	"quail-management/backend/internal/database"
	"quail-management/backend/internal/middleware"
	"quail-management/backend/internal/response"
)

func main() {
	cfg := config.LoadConfig()

	if cfg.GinMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Connect to Database
	db, err := database.Connect(cfg)
	if err != nil {
		log.Printf("⚠️ Catatan Database: %v\n", err)
		log.Println("Aplikasi tetap berjalan dalam mode API scaffolding (pastikan PostgreSQL berjalan untuk transaksi database).")
	} else {
		// AutoMigrate database models
		if err := database.AutoMigrate(db); err != nil {
			log.Printf("Gagal menjalankan migrasi database: %v\n", err)
		}
	}

	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.CORSMiddleware(cfg.CORSOrigins))

	// API Root & Health Check
	v1 := router.Group("/api/v1")
	{
		v1.GET("/health", func(c *gin.Context) {
			dbStatus := "connected"
			if database.DB == nil {
				dbStatus = "disconnected"
			}
			response.JSON(c, http.StatusOK, "Sistem Manajemen Peternakan Puyuh API Aktif", gin.H{
				"status":    "healthy",
				"database":  dbStatus,
				"app_env":   cfg.AppEnv,
				"version":   "1.0.0",
			})
		})
	}

	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("🚀 Server Backend berjalan di http://localhost%s\n", serverAddr)
	if err := router.Run(serverAddr); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
