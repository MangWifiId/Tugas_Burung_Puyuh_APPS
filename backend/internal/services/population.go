package services

import (
	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
)

func FindBatch(db *gorm.DB, id uint) (*models.QuailBatch, error) {
	var batch models.QuailBatch
	if id == 0 {
		return nil, apperr.BadRequest("kelompok puyuh wajib dipilih")
	}
	if err := db.First(&batch, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperr.NotFound("kelompok puyuh tidak ditemukan")
		}
		return nil, err
	}
	return &batch, nil
}

type populationTotals struct {
	Mortality int
	Reduction int
	Addition  int
}

func populationTotalsAt(db *gorm.DB, batchID uint, asOf models.Date, excludeMortalityID uint) (populationTotals, error) {
	var totals populationTotals

	mortQuery := db.Model(&models.MortalityRecord{}).
		Where("batch_id = ? AND record_date <= ?", batchID, asOf)
	if excludeMortalityID != 0 {
		mortQuery = mortQuery.Where("id <> ?", excludeMortalityID)
	}
	var mortality int64
	if err := mortQuery.Select("COALESCE(SUM(count), 0)").Scan(&mortality).Error; err != nil {
		return totals, err
	}
	totals.Mortality = int(mortality)

	var reductions, additions int64
	if err := db.Model(&models.PopulationAdjustment{}).
		Where("batch_id = ? AND adjust_date <= ? AND type = ?", batchID, asOf, models.AdjustmentReduction).
		Select("COALESCE(SUM(quantity), 0)").Scan(&reductions).Error; err != nil {
		return totals, err
	}
	if err := db.Model(&models.PopulationAdjustment{}).
		Where("batch_id = ? AND adjust_date <= ? AND type = ?", batchID, asOf, models.AdjustmentAddition).
		Select("COALESCE(SUM(quantity), 0)").Scan(&additions).Error; err != nil {
		return totals, err
	}
	totals.Reduction = int(reductions)
	totals.Addition = int(additions)
	return totals, nil
}

// PopulationAt menghitung populasi pada akhir tanggal tertentu.
func PopulationAt(db *gorm.DB, batch *models.QuailBatch, asOf models.Date, excludeMortalityID uint) (int, error) {
	totals, err := populationTotalsAt(db, batch.ID, asOf, excludeMortalityID)
	if err != nil {
		return 0, err
	}
	return batch.InitialPopulation - totals.Mortality - totals.Reduction + totals.Addition, nil
}

func CurrentPopulation(db *gorm.DB, batch *models.QuailBatch) (int, error) {
	return PopulationAt(db, batch, models.DateToday(), 0)
}

type PopulationPoint struct {
	Date       models.Date `json:"date"`
	Population int         `json:"population"`
	Mortality  int         `json:"mortality"`
	Adjustment int         `json:"adjustment"`
}

// PopulationHistory menghitung populasi harian pada rentang tanggal.
func PopulationHistory(db *gorm.DB, batch *models.QuailBatch, from, to models.Date) ([]PopulationPoint, error) {
	opening := batch.InitialPopulation

	var mortalityBefore int64
	if err := db.Model(&models.MortalityRecord{}).
		Where("batch_id = ? AND record_date < ?", batch.ID, from).
		Select("COALESCE(SUM(count), 0)").Scan(&mortalityBefore).Error; err != nil {
		return nil, err
	}
	var adjustmentsBefore []models.PopulationAdjustment
	if err := db.Where("batch_id = ? AND adjust_date < ?", batch.ID, from).
		Find(&adjustmentsBefore).Error; err != nil {
		return nil, err
	}
	opening -= int(mortalityBefore)
	for _, adj := range adjustmentsBefore {
		if adj.Type == models.AdjustmentAddition {
			opening += adj.Quantity
		} else {
			opening -= adj.Quantity
		}
	}

	var mortality []models.MortalityRecord
	if err := db.Where("batch_id = ? AND record_date BETWEEN ? AND ?", batch.ID, from, to).
		Find(&mortality).Error; err != nil {
		return nil, err
	}
	var adjustments []models.PopulationAdjustment
	if err := db.Where("batch_id = ? AND adjust_date BETWEEN ? AND ?", batch.ID, from, to).
		Find(&adjustments).Error; err != nil {
		return nil, err
	}

	mortalityByDate := map[string]int{}
	for _, record := range mortality {
		mortalityByDate[record.RecordDate.String()] += record.Count
	}
	adjustmentByDate := map[string]int{}
	for _, adj := range adjustments {
		if adj.Type == models.AdjustmentAddition {
			adjustmentByDate[adj.AdjustDate.String()] += adj.Quantity
		} else {
			adjustmentByDate[adj.AdjustDate.String()] -= adj.Quantity
		}
	}

	population := opening
	points := make([]PopulationPoint, 0)
	for day := from; !day.After(to); day = day.AddDays(1) {
		key := day.String()
		deaths := mortalityByDate[key]
		change := adjustmentByDate[key]
		population += change - deaths
		points = append(points, PopulationPoint{
			Date:       day,
			Population: population,
			Mortality:  deaths,
			Adjustment: change,
		})
	}
	return points, nil
}
