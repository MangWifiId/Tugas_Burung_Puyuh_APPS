package services

import (
	"errors"
	"sort"
	"strings"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
)

type ProductionService struct {
	db *gorm.DB
}

func NewProductionService(db *gorm.DB) *ProductionService { return &ProductionService{db: db} }

type ProductionInput struct {
	BatchID        *uint       `json:"batch_id"`
	ProductionDate models.Date `json:"production_date"`
	EggCount       int         `json:"egg_count"`
	Notes          string      `json:"notes"`
}

type ProductionFilter struct {
	From    models.Date
	To      models.Date
	BatchID uint
	Page    int
	Limit   int
}

func (s *ProductionService) List(filter ProductionFilter) ([]models.EggProduction, int64, error) {
	query := s.db.Model(&models.EggProduction{}).Where("production_date BETWEEN ? AND ?", filter.From, filter.To)
	if filter.BatchID != 0 {
		query = query.Where("batch_id = ?", filter.BatchID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var data []models.EggProduction
	if err := query.Preload("Batch").
		Order("production_date DESC, id DESC").
		Offset((filter.Page - 1) * filter.Limit).Limit(filter.Limit).
		Find(&data).Error; err != nil {
		return nil, 0, err
	}
	return data, total, nil
}

func (s *ProductionService) validate(input *ProductionInput, excludeID uint) (*models.QuailBatch, error) {
	if err := ValidateRecordDate(input.ProductionDate, "tanggal produksi"); err != nil {
		return nil, err
	}
	if err := ValidatePositive(input.EggCount, "jumlah telur"); err != nil {
		return nil, err
	}
	input.Notes = strings.TrimSpace(input.Notes)
	if input.BatchID != nil && *input.BatchID == 0 {
		input.BatchID = nil
	}
	if input.BatchID != nil {
		batch, err := FindBatch(s.db, *input.BatchID)
		if err != nil {
			return nil, err
		}
		if input.EggCount > batch.InitialPopulation*2 {
			return nil, apperr.BadRequest("jumlah telur tidak wajar dibandingkan populasi kelompok")
		}
	} else if input.EggCount > 1000000 {
		return nil, apperr.BadRequest("jumlah telur tidak wajar")
	}

	var duplicate int64
	query := s.db.Model(&models.EggProduction{}).Where("production_date = ?", input.ProductionDate)
	if input.BatchID == nil {
		query = query.Where("batch_id IS NULL")
	} else {
		query = query.Where("batch_id = ?", *input.BatchID)
	}
	if excludeID != 0 {
		query = query.Where("id <> ?", excludeID)
	}
	if err := query.Count(&duplicate).Error; err != nil {
		return nil, err
	}
	if duplicate > 0 {
		return nil, apperr.Conflict("produksi pada tanggal dan kelompok tersebut sudah dicatat")
	}
	if input.BatchID == nil {
		return nil, nil
	}
	return FindBatch(s.db, *input.BatchID)
}

func (s *ProductionService) Create(actor Actor, input ProductionInput) (*models.EggProduction, error) {
	batch, err := s.validate(&input, 0)
	if err != nil {
		return nil, err
	}
	production := models.EggProduction{
		BatchID:        input.BatchID,
		ProductionDate: input.ProductionDate,
		EggCount:       input.EggCount,
		Notes:          input.Notes,
	}
	if actor.ID != 0 {
		production.CreatedBy = &actor.ID
	}
	if err := s.db.Create(&production).Error; err != nil {
		return nil, err
	}
	target := "seluruh kandang"
	if batch != nil {
		target = batch.Name
	}
	LogActivity(s.db, actor, "create", "production", production.ID,
		"Produksi "+itoa(production.EggCount)+" telur ("+target+")")
	return &production, nil
}

func (s *ProductionService) Update(actor Actor, id uint, input ProductionInput) (*models.EggProduction, error) {
	var production models.EggProduction
	if err := s.db.First(&production, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("catatan produksi tidak ditemukan")
		}
		return nil, err
	}
	if _, err := s.validate(&input, id); err != nil {
		return nil, err
	}
	production.BatchID = input.BatchID
	production.ProductionDate = input.ProductionDate
	production.EggCount = input.EggCount
	production.Notes = input.Notes
	if err := s.db.Save(&production).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "update", "production", production.ID,
		"Mengubah produksi tanggal "+production.ProductionDate.String()+" menjadi "+itoa(production.EggCount)+" telur")
	return &production, nil
}

func (s *ProductionService) Delete(actor Actor, id uint) error {
	var production models.EggProduction
	if err := s.db.First(&production, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperr.NotFound("catatan produksi tidak ditemukan")
		}
		return err
	}
	if err := s.db.Delete(&production).Error; err != nil {
		return err
	}
	LogActivity(s.db, actor, "delete", "production", id,
		"Menghapus produksi tanggal "+production.ProductionDate.String())
	return nil
}

type ProductionPoint struct {
	Period  string `json:"period"`
	Label   string `json:"label"`
	Eggs    int    `json:"eggs"`
	Records int    `json:"records"`
}

type ProductionSummary struct {
	TotalEggs   int               `json:"total_eggs"`
	TotalDays   int               `json:"total_days"`
	AverageEggs float64           `json:"average_eggs"`
	Points      []ProductionPoint `json:"points"`
}

func (s *ProductionService) Summary(from, to models.Date, groupBy string) (*ProductionSummary, error) {
	if groupBy == "" {
		groupBy = "day"
	}
	var records []models.EggProduction
	if err := s.db.Where("production_date BETWEEN ? AND ?", from, to).
		Order("production_date ASC").Find(&records).Error; err != nil {
		return nil, err
	}
	buckets := map[string]*ProductionPoint{}
	order := []string{}
	total := 0
	days := map[string]bool{}
	for _, record := range records {
		key, label := PeriodKey(record.ProductionDate, groupBy)
		point, ok := buckets[key]
		if !ok {
			point = &ProductionPoint{Period: key, Label: label}
			buckets[key] = point
			order = append(order, key)
		}
		point.Eggs += record.EggCount
		point.Records++
		total += record.EggCount
		days[record.ProductionDate.String()] = true
	}
	sort.Strings(order)
	points := make([]ProductionPoint, 0, len(order))
	for _, key := range order {
		points = append(points, *buckets[key])
	}
	summary := &ProductionSummary{TotalEggs: total, TotalDays: len(days), Points: points}
	if len(days) > 0 {
		summary.AverageEggs = float64(total) / float64(len(days))
	}
	return summary, nil
}
