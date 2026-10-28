package services

import (
	"errors"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
)

type BatchService struct {
	db *gorm.DB
}

func NewBatchService(db *gorm.DB) *BatchService { return &BatchService{db: db} }

type BatchInput struct {
	Name                string       `json:"name"`
	HatchDate           models.Date  `json:"hatch_date"`
	EntryDate           *models.Date `json:"entry_date"`
	InitialPopulation   int          `json:"initial_population"`
	ProductionStartDate *models.Date `json:"production_start_date"`
	Status              string       `json:"status"`
	Notes               string       `json:"notes"`
}

func (s *BatchService) validate(input *BatchInput, batchID uint) error {
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		return apperr.BadRequest("nama kelompok wajib diisi")
	}
	if input.HatchDate.IsZero() {
		return apperr.BadRequest("tanggal menetas wajib diisi")
	}
	if input.HatchDate.After(models.DateToday()) {
		return apperr.BadRequest("tanggal menetas tidak boleh melebihi hari ini")
	}
	if input.InitialPopulation <= 0 {
		return apperr.BadRequest("populasi awal harus lebih besar dari 0")
	}
	if input.EntryDate != nil && !input.EntryDate.IsZero() {
		if input.EntryDate.Before(input.HatchDate) {
			return apperr.BadRequest("tanggal masuk kandang tidak boleh sebelum tanggal menetas")
		}
		if input.EntryDate.After(models.DateToday()) {
			return apperr.BadRequest("tanggal masuk kandang tidak boleh melebihi hari ini")
		}
	} else {
		input.EntryDate = nil
	}
	if input.ProductionStartDate != nil && !input.ProductionStartDate.IsZero() {
		if input.ProductionStartDate.Before(input.HatchDate) {
			return apperr.BadRequest("tanggal mulai produksi tidak boleh sebelum tanggal menetas")
		}
	} else {
		input.ProductionStartDate = nil
	}
	if input.Status == "" {
		input.Status = models.BatchStatusActive
	}
	if input.Status != models.BatchStatusActive && input.Status != models.BatchStatusInactive {
		return apperr.BadRequest("status kelompok tidak valid")
	}

	if batchID != 0 {
		totals, err := populationTotalsAt(s.db, batchID, models.DateToday(), 0)
		if err != nil {
			return err
		}
		minimum := totals.Mortality + totals.Reduction - totals.Addition
		if input.InitialPopulation < minimum {
			return apperr.BadRequest("populasi awal tidak boleh lebih kecil dari total pengurangan yang sudah tercatat")
		}
	}
	return nil
}

func (s *BatchService) List(search, status string) ([]models.BatchStats, error) {
	query := s.db.Model(&models.QuailBatch{})
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if search = strings.TrimSpace(search); search != "" {
		query = query.Where("LOWER(name) LIKE ?", "%"+strings.ToLower(search)+"%")
	}

	var batches []models.QuailBatch
	if err := query.Order("status ASC, name ASC").Find(&batches).Error; err != nil {
		return nil, err
	}

	type aggregate struct {
		BatchID uint
		Total   int64
	}
	var mortalityRows []aggregate
	if err := s.db.Model(&models.MortalityRecord{}).
		Select("batch_id, COALESCE(SUM(count), 0) AS total").Group("batch_id").
		Scan(&mortalityRows).Error; err != nil {
		return nil, err
	}
	var adjustmentRows []struct {
		BatchID uint
		Type    string
		Total   int64
	}
	if err := s.db.Model(&models.PopulationAdjustment{}).
		Select("batch_id, type, COALESCE(SUM(quantity), 0) AS total").
		Group("batch_id, type").Scan(&adjustmentRows).Error; err != nil {
		return nil, err
	}

	mortality := map[uint]int{}
	for _, row := range mortalityRows {
		mortality[row.BatchID] = int(row.Total)
	}
	reduction := map[uint]int{}
	addition := map[uint]int{}
	for _, row := range adjustmentRows {
		if row.Type == models.AdjustmentAddition {
			addition[row.BatchID] = int(row.Total)
		} else {
			reduction[row.BatchID] = int(row.Total)
		}
	}

	today := models.DateToday()

	// Produksi 14 hari terakhir dipakai untuk menghitung produktivitas 7 hari
	// berjalan dan tren dibanding 7 hari sebelumnya.
	type productionAgg struct {
		recentEggs, prevEggs int
		recentDays, prevDays int
		latestDate           models.Date
		latestEggs           int
		hasLatest            bool
	}
	var productionRows []struct {
		BatchID        uint
		ProductionDate models.Date
		EggCount       int
	}
	if err := s.db.Model(&models.EggProduction{}).
		Select("batch_id, production_date, egg_count").
		Where("production_date BETWEEN ? AND ?", today.AddDays(-13), today).
		Scan(&productionRows).Error; err != nil {
		return nil, err
	}
	production := map[uint]*productionAgg{}
	recentStart := today.AddDays(-7)
	for _, row := range productionRows {
		if row.BatchID == 0 {
			continue
		}
		agg := production[row.BatchID]
		if agg == nil {
			agg = &productionAgg{}
			production[row.BatchID] = agg
		}
		if row.ProductionDate.After(recentStart) {
			agg.recentEggs += row.EggCount
			agg.recentDays++
		} else {
			agg.prevEggs += row.EggCount
			agg.prevDays++
		}
		if !agg.hasLatest || row.ProductionDate.After(agg.latestDate) {
			agg.latestDate = row.ProductionDate
			agg.latestEggs = row.EggCount
			agg.hasLatest = true
		}
	}

	result := make([]models.BatchStats, 0, len(batches))
	for _, batch := range batches {
		stats := models.BatchStats{QuailBatch: batch}
		stats.TotalMortality = mortality[batch.ID]
		stats.TotalReduction = reduction[batch.ID]
		stats.TotalAddition = addition[batch.ID]
		stats.CurrentPopulation = batch.InitialPopulation - stats.TotalMortality - stats.TotalReduction + stats.TotalAddition
		if stats.CurrentPopulation < 0 {
			stats.CurrentPopulation = 0
		}
		stats.AgeDays = int(today.Time().Sub(batch.HatchDate.Time()).Hours() / 24)
		if stats.AgeDays < 0 {
			stats.AgeDays = 0
		}
		stats.AgeWeeks = stats.AgeDays / 7
		stats.AgeStage = models.AgeProductivityStage(stats.AgeDays)
		if batch.InitialPopulation > 0 {
			stats.MortalityRate = float64(stats.TotalMortality) / float64(batch.InitialPopulation) * 100
		}

		stats.StandardProductivity = models.AgeProductivityStandard(stats.AgeDays)
		stats.ProductivityStatus = "no_data"
		if agg := production[batch.ID]; agg != nil {
			if agg.hasLatest && stats.CurrentPopulation > 0 {
				stats.RecentEggs = agg.latestEggs
				stats.Productivity = round2(float64(agg.latestEggs) / float64(stats.CurrentPopulation) * 100)
				lastDate := agg.latestDate
				stats.LastProductionDate = &lastDate
			}
			if stats.CurrentPopulation > 0 && agg.recentDays > 0 {
				stats.Productivity7d = round2(
					float64(agg.recentEggs) / (float64(stats.CurrentPopulation) * 7) * 100,
				)
				stats.ProductivityGap = round2(stats.StandardProductivity - stats.Productivity7d)
				if agg.prevEggs > 0 {
					stats.ProductionTrend = round2(
						(float64(agg.recentEggs) - float64(agg.prevEggs)) / float64(agg.prevEggs) * 100,
					)
				}
				switch {
				case stats.ProductivityGap >= 10:
					stats.ProductivityStatus = "low"
				case stats.ProductivityGap >= 5:
					stats.ProductivityStatus = "watch"
				default:
					stats.ProductivityStatus = "normal"
				}
			} else if agg.hasLatest {
				stats.ProductivityStatus = "stale"
			}
		}

		result = append(result, stats)
	}
	return result, nil
}

func (s *BatchService) Get(id uint) (*models.BatchStats, error) {
	batch, err := FindBatch(s.db, id)
	if err != nil {
		return nil, err
	}
	list, err := s.List("", "all")
	if err != nil {
		return nil, err
	}
	for i := range list {
		if list[i].ID == batch.ID {
			return &list[i], nil
		}
	}
	return nil, apperr.NotFound("kelompok puyuh tidak ditemukan")
}

func (s *BatchService) Create(actor Actor, input BatchInput) (*models.QuailBatch, error) {
	if err := s.validate(&input, 0); err != nil {
		return nil, err
	}
	batch := models.QuailBatch{
		Name:                input.Name,
		HatchDate:           input.HatchDate,
		EntryDate:           input.EntryDate,
		InitialPopulation:   input.InitialPopulation,
		ProductionStartDate: input.ProductionStartDate,
		Status:              input.Status,
		Notes:               strings.TrimSpace(input.Notes),
	}
	if err := s.db.Create(&batch).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "create", "batch", batch.ID, "Menambah kelompok puyuh "+batch.Name)
	return &batch, nil
}

func (s *BatchService) Update(actor Actor, id uint, input BatchInput) (*models.QuailBatch, error) {
	batch, err := FindBatch(s.db, id)
	if err != nil {
		return nil, err
	}
	if err := s.validate(&input, id); err != nil {
		return nil, err
	}
	batch.Name = input.Name
	batch.HatchDate = input.HatchDate
	batch.EntryDate = input.EntryDate
	batch.InitialPopulation = input.InitialPopulation
	batch.ProductionStartDate = input.ProductionStartDate
	batch.Status = input.Status
	batch.Notes = strings.TrimSpace(input.Notes)
	if err := s.db.Save(batch).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "update", "batch", batch.ID, "Mengubah kelompok puyuh "+batch.Name)
	return batch, nil
}

func (s *BatchService) Delete(actor Actor, id uint) error {
	batch, err := FindBatch(s.db, id)
	if err != nil {
		return err
	}
	checks := []struct {
		model any
		label string
	}{
		{&models.EggProduction{}, "produksi telur"},
		{&models.MortalityRecord{}, "kematian"},
		{&models.PopulationAdjustment{}, "penyesuaian populasi"},
	}
	for _, check := range checks {
		var count int64
		if err := s.db.Model(check.model).Where("batch_id = ?", id).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return apperr.Conflict("kelompok tidak dapat dihapus karena masih memiliki data " + check.label)
		}
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.CalendarEvent{}).Where("batch_id = ?", id).Update("batch_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(&models.QuailBatch{}, id).Error
	}); err != nil {
		return err
	}
	LogActivity(s.db, actor, "delete", "batch", id, "Menghapus kelompok puyuh "+batch.Name)
	return nil
}

func (s *BatchService) History(id uint, from, to models.Date) ([]PopulationPoint, error) {
	batch, err := FindBatch(s.db, id)
	if err != nil {
		return nil, err
	}
	return PopulationHistory(s.db, batch, from, to)
}

type AdjustmentService struct {
	db *gorm.DB
}

func NewAdjustmentService(db *gorm.DB) *AdjustmentService { return &AdjustmentService{db: db} }

type AdjustmentInput struct {
	BatchID    uint        `json:"batch_id"`
	AdjustDate models.Date `json:"adjust_date"`
	Type       string      `json:"type"`
	Quantity   int         `json:"quantity"`
	Reason     string      `json:"reason"`
	Notes      string      `json:"notes"`
}

func (s *AdjustmentService) validate(input *AdjustmentInput, excludeID uint) (*models.QuailBatch, error) {
	batch, err := FindBatch(s.db, input.BatchID)
	if err != nil {
		return nil, err
	}
	if err := ValidateRecordDate(input.AdjustDate, "tanggal penyesuaian"); err != nil {
		return nil, err
	}
	if input.Type != models.AdjustmentReduction && input.Type != models.AdjustmentAddition {
		return nil, apperr.BadRequest("jenis penyesuaian harus reduction atau addition")
	}
	if err := ValidatePositive(input.Quantity, "jumlah penyesuaian"); err != nil {
		return nil, err
	}
	if input.Reason = strings.TrimSpace(input.Reason); input.Reason == "" {
		return nil, apperr.BadRequest("alasan penyesuaian wajib diisi")
	}

	if input.Type == models.AdjustmentReduction {
		available, err := PopulationAt(s.db, batch, input.AdjustDate, 0)
		if err != nil {
			return nil, err
		}
		if excludeID != 0 {
			var old models.PopulationAdjustment
			if err := s.db.First(&old, excludeID).Error; err == nil {
				if old.Type == models.AdjustmentReduction {
					available += old.Quantity
				} else {
					available -= old.Quantity
				}
			}
		}
		if input.Quantity > available {
			return nil, apperr.BadRequest("jumlah pengurangan melebihi populasi yang tersedia")
		}
	}
	return batch, nil
}

func (s *AdjustmentService) List(batchID uint, from, to models.Date) ([]models.PopulationAdjustment, error) {
	query := s.db.Preload("Batch").Where("adjust_date BETWEEN ? AND ?", from, to)
	if batchID != 0 {
		query = query.Where("batch_id = ?", batchID)
	}
	var data []models.PopulationAdjustment
	err := query.Order("adjust_date DESC, id DESC").Find(&data).Error
	return data, err
}

func (s *AdjustmentService) Create(actor Actor, input AdjustmentInput) (*models.PopulationAdjustment, error) {
	batch, err := s.validate(&input, 0)
	if err != nil {
		return nil, err
	}
	adjustment := models.PopulationAdjustment{
		BatchID: input.BatchID, AdjustDate: input.AdjustDate, Type: input.Type,
		Quantity: input.Quantity, Reason: input.Reason, Notes: strings.TrimSpace(input.Notes),
	}
	if err := s.db.Create(&adjustment).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "create", "population_adjustment", adjustment.ID,
		"Penyesuaian populasi "+batch.Name+": "+input.Type+" "+itoa(input.Quantity))
	return &adjustment, nil
}

func (s *AdjustmentService) Update(actor Actor, id uint, input AdjustmentInput) (*models.PopulationAdjustment, error) {
	var adjustment models.PopulationAdjustment
	if err := s.db.First(&adjustment, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("penyesuaian populasi tidak ditemukan")
		}
		return nil, err
	}
	if _, err := s.validate(&input, id); err != nil {
		return nil, err
	}
	adjustment.BatchID = input.BatchID
	adjustment.AdjustDate = input.AdjustDate
	adjustment.Type = input.Type
	adjustment.Quantity = input.Quantity
	adjustment.Reason = input.Reason
	adjustment.Notes = strings.TrimSpace(input.Notes)
	if err := s.db.Save(&adjustment).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "update", "population_adjustment", id, "Mengubah penyesuaian populasi #"+itoa(int(id)))
	return &adjustment, nil
}

func (s *AdjustmentService) Delete(actor Actor, id uint) error {
	var adjustment models.PopulationAdjustment
	if err := s.db.First(&adjustment, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperr.NotFound("penyesuaian populasi tidak ditemukan")
		}
		return err
	}
	if err := s.db.Delete(&adjustment).Error; err != nil {
		return err
	}
	LogActivity(s.db, actor, "delete", "population_adjustment", id, "Menghapus penyesuaian populasi #"+itoa(int(id)))
	return nil
}

func itoa(v int) string { return strconv.Itoa(v) }
