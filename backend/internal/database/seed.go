package database

import (
	"fmt"
	"log"
	"math"
	"math/rand"
	"time"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/config"
	"manajemen-puyuh/backend/internal/models"
	"manajemen-puyuh/backend/internal/utils"
)

type seedSetting struct {
	Key   string
	Value string
	Label string
	Group string
}

func Seed(db *gorm.DB, cfg *config.Config) error {
	if err := seedAdmin(db, cfg); err != nil {
		return err
	}
	if err := seedSettings(db); err != nil {
		return err
	}
	if err := seedWarningRules(db); err != nil {
		return err
	}
	if cfg.SeedDemo {
		if err := seedDemo(db); err != nil {
			return err
		}
	}
	return nil
}

func seedAdmin(db *gorm.DB, cfg *config.Config) error {
	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := utils.HashPassword(cfg.AdminPassword)
	if err != nil {
		return err
	}
	admin := models.User{
		Name:         cfg.AdminName,
		Email:        cfg.AdminEmail,
		PasswordHash: hash,
		Role:         "owner",
	}
	if err := db.Create(&admin).Error; err != nil {
		return err
	}
	log.Printf("akun admin dibuat: %s", cfg.AdminEmail)
	return nil
}

func seedSettings(db *gorm.DB) error {
	defaults := []seedSetting{
		{"farm_name", "Kandang Puyuh Sejahtera", "Nama usaha", "umum"},
		{"owner_name", "Pemilik Kandang", "Nama pemilik", "umum"},
		{"address", "", "Alamat kandang", "umum"},
		{"phone", "", "Nomor telepon", "umum"},
		{"egg_unit", "butir", "Satuan telur", "umum"},
		{"feed_unit", "sak", "Satuan pakan", "umum"},
		{"currency", "IDR", "Mata uang", "umum"},
		{"warning_enabled", "true", "Aktifkan warning otomatis", "warning"},
	}
	for _, s := range defaults {
		var existing models.AppSetting
		err := db.Where("key = ?", s.Key).First(&existing).Error
		if err == nil {
			continue
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		if err := db.Create(&models.AppSetting{
			Key: s.Key, Value: s.Value, Label: s.Label, Group: s.Group,
		}).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedWarningRules(db *gorm.DB) error {
	rules := []models.WarningRule{
		{Code: "mortality_rate_warning", Name: "Kematian harian melewati batas", Category: "mortality", Level: models.LevelWaspada, Threshold: 1, Unit: "%", Description: "Persentase kematian hari ini terhadap populasi melewati batas waspada."},
		{Code: "mortality_rate_critical", Name: "Kematian harian kritis", Category: "mortality", Level: models.LevelKritis, Threshold: 2, Unit: "%", Description: "Persentase kematian hari ini terhadap populasi melewati batas kritis."},
		{Code: "mortality_spike", Name: "Lonjakan kematian", Category: "mortality", Level: models.LevelWaspada, Threshold: 50, Unit: "%", Description: "Jumlah kematian hari ini meningkat dibandingkan rata-rata 7 hari sebelumnya."},
		{Code: "production_drop_warning", Name: "Produksi telur menurun", Category: "production", Level: models.LevelWaspada, Threshold: 15, Unit: "%", Description: "Produksi telur hari ini turun dibandingkan rata-rata 7 hari sebelumnya."},
		{Code: "production_drop_critical", Name: "Penurunan produksi kritis", Category: "production", Level: models.LevelKritis, Threshold: 30, Unit: "%", Description: "Produksi telur hari ini turun drastis dibandingkan rata-rata 7 hari sebelumnya."},
		{Code: "age_productivity_gap", Name: "Produktivitas di bawah standar umur", Category: "production", Level: models.LevelWaspada, Threshold: 10, Unit: "poin %", Description: "Produktivitas 7 hari suatu batch berada di bawah standar produktivitas menurut umur puyuh."},
		{Code: "population_drop_warning", Name: "Populasi menurun signifikan", Category: "population", Level: models.LevelWaspada, Threshold: 3, Unit: "%", Description: "Populasi burung menurun signifikan dibandingkan 7 hari sebelumnya."},
		{Code: "feed_gap_warning", Name: "Pakan tidak diterima", Category: "feed", Level: models.LevelWaspada, Threshold: 8, Unit: "hari", Description: "Tidak ada penerimaan pakan dalam jumlah hari yang melewati batas."},
	}
	for _, rule := range rules {
		var existing models.WarningRule
		err := db.Where("code = ?", rule.Code).First(&existing).Error
		if err == nil {
			continue
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		rule.Enabled = true
		if err := db.Create(&rule).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedDemo(db *gorm.DB) error {
	var count int64
	db.Model(&models.QuailBatch{}).Count(&count)
	if count > 0 {
		return nil
	}

	log.Println("mengisi data demo...")
	today := models.DateToday()
	rng := rand.New(rand.NewSource(42))

	batch := models.QuailBatch{
		Name:                "Batch Alpha",
		HatchDate:           today.AddDays(-125),
		EntryDate:           datePtr(today.AddDays(-118)),
		InitialPopulation:   1200,
		ProductionStartDate: datePtr(today.AddDays(-85)),
		Status:              models.BatchStatusActive,
		Notes:               "Data contoh untuk mencoba aplikasi.",
	}
	if err := db.Create(&batch).Error; err != nil {
		return err
	}
	batch2 := models.QuailBatch{
		Name:              "Batch Beta",
		HatchDate:         today.AddDays(-20),
		EntryDate:         datePtr(today.AddDays(-14)),
		InitialPopulation: 800,
		Status:            models.BatchStatusActive,
	}
	if err := db.Create(&batch2).Error; err != nil {
		return err
	}

	// Kematian harian kecil.
	mortalityByDay := make([]int, 30)
	for i := 29; i >= 0; i-- {
		count := 1 + rng.Intn(4)
		if i == 4 {
			count = 22
		}
		mortalityByDay[i] = count
		rec := models.MortalityRecord{
			BatchID:    batch.ID,
			RecordDate: today.AddDays(-i),
			Count:      count,
			Cause:      "kondisi kandang",
		}
		if err := db.Create(&rec).Error; err != nil {
			return err
		}
	}

	// Produksi 30 hari terakhir mengikuti kurva umur: Batch Alpha saat ini
	// berumur 125 hari, sehingga produksinya menurun perlahan seiring umur.
	deathsSoFar := 0
	for i := 29; i >= 0; i-- {
		day := today.AddDays(-i)
		age := 125 - i
		standard := models.AgeProductivityStandard(age) / 100
		factor := standard - 0.02 + (rng.Float64()-0.5)*0.03
		if factor < 0 {
			factor = 0
		}
		population := batch.InitialPopulation - deathsSoFar
		prod := models.EggProduction{
			BatchID:        &batch.ID,
			ProductionDate: day,
			EggCount:       int(math.Round(float64(population) * factor)),
			Notes:          "",
		}
		if err := db.Create(&prod).Error; err != nil {
			return err
		}
		deathsSoFar += mortalityByDay[i]
	}

	// Penerimaan pakan mingguan dengan perubahan harga.
	prices := []float64{385000, 385000, 402000, 402000, 418000}
	types := []string{"layer", "layer", "layer", "layer", "layer"}
	for i := 4; i >= 0; i-- {
		receipt := models.FeedReceipt{
			ReceivedDate: today.AddDays(-i * 7),
			FeedType:     types[4-i],
			Sacks:        float64(20 + rng.Intn(4)),
			PricePerSack: prices[4-i],
			Notes:        "",
		}
		if err := db.Create(&receipt).Error; err != nil {
			return err
		}
		if err := db.Create(&models.FeedPriceHistory{
			FeedType:      receipt.FeedType,
			PricePerSack:  receipt.PricePerSack,
			EffectiveDate: receipt.ReceivedDate,
			FeedReceiptID: &receipt.ID,
			Notes:         "Penerimaan pakan",
		}).Error; err != nil {
			return err
		}
	}

	// Pengambilan Senin & Kamis selama 3 minggu terakhir.
	pickupCount := 0
	for i := 20; i >= 0; i-- {
		day := today.AddDays(-i)
		weekday := day.Time().Weekday()
		if weekday != time.Monday && weekday != time.Thursday {
			continue
		}
		if day.After(today) {
			continue
		}
		price := 1900.0
		pickup := models.EggPickup{
			PickupDate:   day,
			EggCount:     1800 + rng.Intn(300),
			PricePerUnit: &price,
			Status:       models.PickupInvoiced,
			Notes:        "",
		}
		if err := db.Create(&pickup).Error; err != nil {
			return err
		}
		pickupCount++
	}

	noteDate := today.AddDays(-3)
	note := models.SalesNote{
		NoteNumber:    fmt.Sprintf("PT-%s-001", noteDate.Time().Format("200601")),
		NoteDate:      noteDate,
		PeriodStart:   datePtr(noteDate.AddDays(-7)),
		PeriodEnd:     datePtr(noteDate),
		TotalEggs:     3600,
		TotalAmount:   6840000,
		FeedDeduction: 8000000,
		Notes:         "Nota contoh dari PT. Potongan pakan hanya informasi.",
	}
	if err := db.Create(&note).Error; err != nil {
		return err
	}

	events := []models.CalendarEvent{
		{Title: "Pemberian vitamin", EventDate: today.AddDays(2), EventType: "vitamin", BatchID: &batch.ID, Reminder: true, ReminderDays: 1, Status: models.EventPlanned},
		{Title: "Puyuh naik ke baterai", EventDate: today.AddDays(5), EventType: "naik_baterai", BatchID: &batch2.ID, Reminder: true, ReminderDays: 2, Status: models.EventPlanned},
		{Title: "Pemberian obat cacing", EventDate: today.AddDays(-6), EventType: "obat", BatchID: &batch.ID, Status: models.EventDone},
	}
	for _, e := range events {
		if err := db.Create(&e).Error; err != nil {
			return err
		}
	}

	log.Printf("data demo dibuat (termasuk %d pengambilan telur)", pickupCount)
	return nil
}

func datePtr(d models.Date) *models.Date { return &d }
