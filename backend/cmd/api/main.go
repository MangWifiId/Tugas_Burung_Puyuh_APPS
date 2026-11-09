package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/config"
	"manajemen-puyuh/backend/internal/database"
	"manajemen-puyuh/backend/internal/handlers"
	"manajemen-puyuh/backend/internal/models"
	"manajemen-puyuh/backend/internal/routes"
	"manajemen-puyuh/backend/internal/services"
	"manajemen-puyuh/backend/internal/tenancy"
)

func main() {
	cfg := config.Load()

	location, err := time.LoadLocation(cfg.Timezone)
	if err != nil {
		log.Printf("zona waktu %s tidak ditemukan, memakai WIB (UTC+7)", cfg.Timezone)
		location = time.FixedZone("WIB", 7*60*60)
	}
	time.Local = location

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatal(err)
	}
	if err := database.Seed(db, cfg); err != nil {
		log.Fatalf("gagal menyiapkan data awal: %v", err)
	}

	handler := &handlers.Handler{
		Cfg:  cfg,
		DB:   db,
		Auth: services.NewAuthService(db, cfg),
	}

	router := routes.New(handler)
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	stopBackground := make(chan struct{})
	go generateWarningsPeriodically(db, stopBackground)

	go func() {
		log.Printf("API berjalan di http://localhost:%s (env=%s, db=%s)", cfg.Port, cfg.Env, cfg.DBDriver)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server berhenti: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	close(stopBackground)

	log.Println("menghentikan server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("gagal menghentikan server dengan rapi: %v", err)
	}
	log.Println("server berhenti")
}

func generateWarningsPeriodically(db *gorm.DB, stop <-chan struct{}) {
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			var tenants []models.Tenant
			if err := db.Find(&tenants).Error; err != nil {
				log.Printf("gagal membaca daftar kandang: %v", err)
				continue
			}
			for _, tenant := range tenants {
				scoped := tenancy.WithTenant(db, context.Background(), tenant.ID)
				if _, err := services.NewWarningService(scoped).GenerateFor(models.DateToday()); err != nil {
					log.Printf("gagal membuat warning otomatis untuk kandang %d: %v", tenant.ID, err)
				}
			}
		}
	}
}
