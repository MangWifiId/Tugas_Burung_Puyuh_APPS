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
	"quail-management/backend/internal/routes"
)

func main() {
	cfg := config.LoadConfig()

	if cfg.GinMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Inisialisasi JSON File Database
	jdb, err := database.InitJSONDB("data")
	if err != nil {
		log.Fatalf("Gagal inisialisasi basis data JSON: %v", err)
	}
	_ = jdb

	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.CORSMiddleware(cfg.CORSOrigins))

	// Register API v1 Routes
	v1 := router.Group("/api/v1")
	{
		v1.GET("/health", func(c *gin.Context) {
			response.JSON(c, http.StatusOK, "Sistem Manajemen Peternakan Puyuh API Aktif (JSON Database Mode)", gin.H{
				"status":    "healthy",
				"database":  "json_file_storage",
				"storage":   "backend/data/database.json",
				"app_env":   cfg.AppEnv,
				"version":   "1.0.0",
			})
		})

		// Setup route handlers
		routes.RegisterRoutes(v1, cfg)
	}

	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("🚀 Server Backend berjalan di http://localhost%s (Mode: JSON File DB)\n", serverAddr)
	if err := router.Run(serverAddr); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
