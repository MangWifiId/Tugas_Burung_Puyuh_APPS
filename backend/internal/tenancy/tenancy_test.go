package tenancy

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"manajemen-puyuh/backend/internal/models"
)

func openTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:tenancy_%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("buka sqlite: %v", err)
	}
	if err := Register(db); err != nil {
		t.Fatalf("pasang callback: %v", err)
	}
	if err := db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.QuailBatch{},
		&models.CalendarEvent{},
		&models.AppSetting{},
	); err != nil {
		t.Fatalf("migrasi: %v", err)
	}
	return db
}

func TestIsolasiTenant(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	tenantA := models.Tenant{Name: "Kandang A", Slug: "kandang-a"}
	tenantB := models.Tenant{Name: "Kandang B", Slug: "kandang-b"}
	if err := db.Create(&tenantA).Error; err != nil {
		t.Fatalf("buat tenant A: %v", err)
	}
	if err := db.Create(&tenantB).Error; err != nil {
		t.Fatalf("buat tenant B: %v", err)
	}

	a := WithTenant(db, ctx, tenantA.ID)
	b := WithTenant(db, ctx, tenantB.ID)

	batchA := models.QuailBatch{Name: "Batch A", HatchDate: models.DateToday(), InitialPopulation: 10, Status: models.BatchStatusActive}
	batchB := models.QuailBatch{Name: "Batch B", HatchDate: models.DateToday(), InitialPopulation: 20, Status: models.BatchStatusActive}
	if err := a.Create(&batchA).Error; err != nil {
		t.Fatalf("buat batch A: %v", err)
	}
	if err := b.Create(&batchB).Error; err != nil {
		t.Fatalf("buat batch B: %v", err)
	}

	// Create otomatis mengisi tenant_id.
	var rawA, rawB models.QuailBatch
	if err := db.Table("quail_batches").Where("id = ?", batchA.ID).Scan(&rawA).Error; err != nil {
		t.Fatalf("baca batch A: %v", err)
	}
	if rawA.TenantID != tenantA.ID {
		t.Fatalf("tenant batch A = %d, ingin %d", rawA.TenantID, tenantA.ID)
	}
	if err := db.Table("quail_batches").Where("id = ?", batchB.ID).Scan(&rawB).Error; err != nil {
		t.Fatalf("baca batch B: %v", err)
	}
	if rawB.TenantID != tenantB.ID {
		t.Fatalf("tenant batch B = %d, ingin %d", rawB.TenantID, tenantB.ID)
	}

	// List hanya data milik sendiri.
	var listA []models.QuailBatch
	if err := a.Order("id ASC").Find(&listA).Error; err != nil {
		t.Fatalf("list batch A: %v", err)
	}
	if len(listA) != 1 || listA[0].Name != "Batch A" {
		t.Fatalf("list A = %+v", listA)
	}

	// Akses by id lintas tenant gagal.
	var stolen models.QuailBatch
	if err := b.First(&stolen, batchA.ID).Error; err != gorm.ErrRecordNotFound {
		t.Fatalf("B membaca batch A: err=%v", err)
	}

	// Update & delete lintas tenant tidak mengenai data.
	if res := b.Model(&models.QuailBatch{}).Where("id = ?", batchA.ID).Update("name", "dibajak"); res.Error != nil || res.RowsAffected != 0 {
		t.Fatalf("B update batch A: err=%v rows=%d", res.Error, res.RowsAffected)
	}
	if res := b.Delete(&models.QuailBatch{}, batchA.ID); res.Error != nil || res.RowsAffected != 0 {
		t.Fatalf("B delete batch A: err=%v rows=%d", res.Error, res.RowsAffected)
	}

	// Agregat tetap ter-scope.
	if err := a.Create(&[]models.AppSetting{
		{Key: "farm_name", Value: "A"},
		{Key: "egg_unit", Value: "butir"},
	}).Error; err != nil {
		t.Fatalf("buat setting A: %v", err)
	}
	if err := b.Create(&models.AppSetting{Key: "farm_name", Value: "B"}).Error; err != nil {
		t.Fatalf("buat setting B: %v", err)
	}
	var countA int64
	if err := a.Model(&models.AppSetting{}).Count(&countA).Error; err != nil {
		t.Fatalf("hitung setting A: %v", err)
	}
	if countA != 2 {
		t.Fatalf("setting A = %d, ingin 2", countA)
	}
	var countAll int64
	if err := db.Model(&models.AppSetting{}).Count(&countAll).Error; err != nil {
		t.Fatalf("hitung semua setting: %v", err)
	}
	if countAll != 3 {
		t.Fatalf("semua setting = %d, ingin 3", countAll)
	}

	// Preload relasi juga ter-scope.
	eventA := models.CalendarEvent{Title: "Event A", EventDate: models.DateToday(), EventType: "lainnya", Status: models.EventPlanned}
	eventA.BatchID = &batchA.ID
	if err := a.Create(&eventA).Error; err != nil {
		t.Fatalf("buat event A: %v", err)
	}
	eventB := models.CalendarEvent{Title: "Event B", EventDate: models.DateToday(), EventType: "lainnya", Status: models.EventPlanned}
	eventB.BatchID = &batchB.ID
	if err := b.Create(&eventB).Error; err != nil {
		t.Fatalf("buat event B: %v", err)
	}
	var eventsA []models.CalendarEvent
	if err := a.Preload("Batch").Order("id ASC").Find(&eventsA).Error; err != nil {
		t.Fatalf("list event A: %v", err)
	}
	if len(eventsA) != 1 || eventsA[0].Title != "Event A" {
		t.Fatalf("event A = %+v", eventsA)
	}
	if eventsA[0].Batch == nil || eventsA[0].Batch.Name != "Batch A" {
		t.Fatalf("preload batch event A = %+v", eventsA[0].Batch)
	}
}
