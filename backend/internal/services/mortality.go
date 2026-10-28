package services

import (
	"errors"
	"sort"
	"strings"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
)

type MortalityService struct {
	db *gorm.DB
}

func NewMortalityService(db *gorm.DB) *MortalityService { return &MortalityService{db: db} }

type MortalityInput struct {
	BatchID    uint        `json:"batch_id"`
	RecordDate models.Date `json:"record_date"`
	Count      int         `json:"count"`
	Cause      string      `json:"cause"`
	Notes      string      `json:"notes"`
}

type MortalityFilter struct {
	From    models.Date
	To      models.Date
	BatchID uint
	Page    int
	Limit   int
}

func (s *MortalityService) List(filter MortalityFilter) ([]models.MortalityRecord, int64, error) {
	query := s.db.Model(&models.MortalityRecord{}).Where("record_date BETWEEN ? AND ?", filter.From, filter.To)
	if filter.BatchID != 0 {
		query = query.Where("batch_id = ?", filter.BatchID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var data []models.MortalityRecord
	if err := query.Preload("Batch").
		Order("record_date DESC, id DESC").
		Offset((filter.Page - 1) * filter.Limit).Limit(filter.Limit).
		Find(&data).Error; err != nil {
		return nil, 0, err
	}
	return data, total, nil
}

func (s *MortalityService) validate(input *MortalityInput, excludeID uint) (*models.QuailBatch, error) {
	batch, err := FindBatch(s.db, input.BatchID)
	if err != nil {
		return nil, err
	}
	if err := ValidateRecordDate(input.RecordDate, "tanggal kematian"); err != nil {
		return nil, err
	}
	if err := ValidatePositive(input.Count, "jumlah kematian"); err != nil {
		return nil, err
	}
	input.Cause = strings.TrimSpace(input.Cause)
	input.Notes = strings.TrimSpace(input.Notes)

	available, err := PopulationAt(s.db, batch, input.RecordDate, excludeID)
	if err != nil {
		return nil, err
	}
	if available <= 0 {
		return nil, apperr.BadRequest("populasi kelompok sudah habis, periksa kembali data populasi")
	}
	if input.Count > available {
		return nil, apperr.BadRequest("jumlah kematian (" + itoa(input.Count) + ") melebihi populasi tersedia (" + itoa(available) + ")")
	}
	return batch, nil
}

func (s *MortalityService) Create(actor Actor, input MortalityInput) (*models.MortalityRecord, error) {
	batch, err := s.validate(&input, 0)
	if err != nil {
		return nil, err
	}
	record := models.MortalityRecord{
		BatchID: input.BatchID, RecordDate: input.RecordDate, Count: input.Count,
		Cause: input.Cause, Notes: input.Notes,
	}
	if err := s.db.Create(&record).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "create", "mortality", record.ID,
		"Kematian "+itoa(record.Count)+" ekor pada "+batch.Name)
	return &record, nil
}

func (s *MortalityService) Update(actor Actor, id uint, input MortalityInput) (*models.MortalityRecord, error) {
	var record models.MortalityRecord
	if err := s.db.First(&record, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("catatan kematian tidak ditemukan")
		}
		return nil, err
	}
	if _, err := s.validate(&input, id); err != nil {
		return nil, err
	}
	oldCount := record.Count
	record.BatchID = input.BatchID
	record.RecordDate = input.RecordDate
	record.Count = input.Count
	record.Cause = input.Cause
	record.Notes = input.Notes
	if err := s.db.Save(&record).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "update", "mortality", id,
		"Koreksi kematian tanggal "+record.RecordDate.String()+": "+itoa(oldCount)+" menjadi "+itoa(record.Count)+" ekor")
	return &record, nil
}

func (s *MortalityService) Delete(actor Actor, id uint) error {
	var record models.MortalityRecord
	if err := s.db.First(&record, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperr.NotFound("catatan kematian tidak ditemukan")
		}
		return err
	}
	if err := s.db.Delete(&record).Error; err != nil {
		return err
	}
	LogActivity(s.db, actor, "delete", "mortality", id,
		"Menghapus kematian tanggal "+record.RecordDate.String())
	return nil
}

type MortalityPoint struct {
	Period  string `json:"period"`
	Label   string `json:"label"`
	Count   int    `json:"count"`
	Records int    `json:"records"`
}

type MortalitySummary struct {
	Total        int              `json:"total"`
	AverageDaily float64          `json:"average_daily"`
	Points       []MortalityPoint `json:"points"`
	ByBatch      []BatchTotal     `json:"by_batch"`
}

type BatchTotal struct {
	BatchID   uint   `json:"batch_id"`
	BatchName string `json:"batch_name"`
	Total     int    `json:"total"`
}

func (s *MortalityService) Summary(from, to models.Date, groupBy string) (*MortalitySummary, error) {
	if groupBy == "" {
		groupBy = "day"
	}
	var records []models.MortalityRecord
	if err := s.db.Preload("Batch").Where("record_date BETWEEN ? AND ?", from, to).
		Order("record_date ASC").Find(&records).Error; err != nil {
		return nil, err
	}
	buckets := map[string]*MortalityPoint{}
	order := []string{}
	total := 0
	days := map[string]bool{}
	byBatch := map[uint]*BatchTotal{}
	for _, record := range records {
		key, label := PeriodKey(record.RecordDate, groupBy)
		point, ok := buckets[key]
		if !ok {
			point = &MortalityPoint{Period: key, Label: label}
			buckets[key] = point
			order = append(order, key)
		}
		point.Count += record.Count
		point.Records++
		total += record.Count
		days[record.RecordDate.String()] = true
		name := "Tanpa kelompok"
		if record.Batch != nil {
			name = record.Batch.Name
		}
		if _, ok := byBatch[record.BatchID]; !ok {
			byBatch[record.BatchID] = &BatchTotal{BatchID: record.BatchID, BatchName: name}
		}
		byBatch[record.BatchID].Total += record.Count
	}
	sort.Strings(order)
	points := make([]MortalityPoint, 0, len(order))
	for _, key := range order {
		points = append(points, *buckets[key])
	}
	batches := make([]BatchTotal, 0, len(byBatch))
	for _, item := range byBatch {
		batches = append(batches, *item)
	}
	sort.Slice(batches, func(i, j int) bool { return batches[i].Total > batches[j].Total })
	summary := &MortalitySummary{Total: total, Points: points, ByBatch: batches}
	if len(days) > 0 {
		summary.AverageDaily = float64(total) / float64(len(days))
	}
	return summary, nil
}
