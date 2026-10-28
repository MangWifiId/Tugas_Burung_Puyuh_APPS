package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
)

type WarningService struct {
	db *gorm.DB
}

func NewWarningService(db *gorm.DB) *WarningService { return &WarningService{db: db} }

func (s *WarningService) enabled() bool {
	var setting models.AppSetting
	if err := s.db.Where("key = ?", "warning_enabled").First(&setting).Error; err != nil {
		return true
	}
	return strings.ToLower(setting.Value) != "false"
}

func (s *WarningService) activeRules() (map[string]*models.WarningRule, error) {
	var rules []models.WarningRule
	if err := s.db.Where("enabled = ?", true).Find(&rules).Error; err != nil {
		return nil, err
	}
	result := make(map[string]*models.WarningRule, len(rules))
	for i := range rules {
		result[rules[i].Code] = &rules[i]
	}
	return result, nil
}

func (s *WarningService) productionTotal(from, to models.Date) (int, int, error) {
	var rows []models.EggProduction
	if err := s.db.Where("production_date BETWEEN ? AND ?", from, to).Find(&rows).Error; err != nil {
		return 0, 0, err
	}
	total := 0
	for _, row := range rows {
		total += row.EggCount
	}
	return total, len(rows), nil
}

func (s *WarningService) mortalityTotal(from, to models.Date) (int, int, error) {
	var rows []models.MortalityRecord
	if err := s.db.Where("record_date BETWEEN ? AND ?", from, to).Find(&rows).Error; err != nil {
		return 0, 0, err
	}
	total := 0
	for _, row := range rows {
		total += row.Count
	}
	return total, len(rows), nil
}

// GenerateFor menghitung ulang warning untuk tanggal tertentu. Hasil disimpan
// dengan kunci unik (kode, tanggal) sehingga tidak terjadi duplikasi.
func (s *WarningService) GenerateFor(date models.Date) ([]models.WarningEvent, error) {
	if !s.enabled() {
		return []models.WarningEvent{}, nil
	}
	rules, err := s.activeRules()
	if err != nil {
		return nil, err
	}
	var batches []models.QuailBatch
	if err := s.db.Where("status = ?", models.BatchStatusActive).Find(&batches).Error; err != nil {
		return nil, err
	}
	if len(batches) == 0 {
		return []models.WarningEvent{}, nil
	}

	popNow := 0
	for i := range batches {
		pop, err := PopulationAt(s.db, &batches[i], date, 0)
		if err != nil {
			return nil, err
		}
		if pop > 0 {
			popNow += pop
		}
	}

	todayMort, _, err := s.mortalityTotal(date, date)
	if err != nil {
		return nil, err
	}
	prevMort, _, err := s.mortalityTotal(date.AddDays(-7), date.AddDays(-1))
	if err != nil {
		return nil, err
	}
	prevMortAvg := float64(prevMort) / 7

	todayEggs, todayRecords, err := s.productionTotal(date, date)
	if err != nil {
		return nil, err
	}
	prevEggs, prevRecords, err := s.productionTotal(date.AddDays(-7), date.AddDays(-1))
	if err != nil {
		return nil, err
	}
	prevEggAvg := 0.0
	if prevRecords > 0 {
		prevEggAvg = float64(prevEggs) / float64(prevRecords)
	}

	popPrev := 0
	oldestAllowed := date.AddDays(-7)
	for i := range batches {
		batch := &batches[i]
		if batch.HatchDate.After(oldestAllowed) {
			continue
		}
		pop, err := PopulationAt(s.db, batch, oldestAllowed, 0)
		if err != nil {
			return nil, err
		}
		if pop > 0 {
			popPrev += pop
		}
	}

	results := []models.WarningEvent{}
	create := func(rule *models.WarningRule, title, description string, metric float64) error {
		if rule == nil {
			return nil
		}
		event, err := s.upsert(rule, date, title, description, metric)
		if err != nil {
			return err
		}
		if event != nil {
			results = append(results, *event)
		}
		return nil
	}
	createWithCode := func(rule *models.WarningRule, code, title, description string, metric float64) error {
		if rule == nil {
			return nil
		}
		event, err := s.upsertWithCode(rule, code, date, title, description, metric)
		if err != nil {
			return err
		}
		if event != nil {
			results = append(results, *event)
		}
		return nil
	}

	if popNow > 0 {
		rate := float64(todayMort) / float64(popNow) * 100
		for _, code := range []string{"mortality_rate_warning", "mortality_rate_critical"} {
			rule := rules[code]
			if rule != nil && rate >= rule.Threshold {
				title := fmt.Sprintf("Kematian harian %.2f%%", rate)
				desc := fmt.Sprintf("%d ekor mati dari populasi %d ekor pada %s. Batas %s: %.2f%%.",
					todayMort, popNow, date.String(), rule.Level, rule.Threshold)
				if err := create(rule, title, desc, rate); err != nil {
					return nil, err
				}
			}
		}
	}

	if todayMort > 0 {
		metric := 100.0
		if prevMortAvg > 0 {
			metric = (float64(todayMort) - prevMortAvg) / prevMortAvg * 100
		}
		rule := rules["mortality_spike"]
		if rule != nil && metric >= rule.Threshold {
			desc := fmt.Sprintf("Kematian hari ini %d ekor, rata-rata 7 hari sebelumnya %.1f ekor/hari (naik %.1f%%).",
				todayMort, prevMortAvg, metric)
			if err := create(rule, "Lonjakan kematian terdeteksi", desc, metric); err != nil {
				return nil, err
			}
		}
	}

	if todayRecords > 0 && prevEggAvg > 0 {
		drop := (prevEggAvg - float64(todayEggs)) / prevEggAvg * 100
		for _, code := range []string{"production_drop_warning", "production_drop_critical"} {
			rule := rules[code]
			if rule != nil && drop >= rule.Threshold {
				desc := fmt.Sprintf("Produksi hari ini %d telur, rata-rata 7 hari sebelumnya %.0f telur/hari (turun %.1f%%).",
					todayEggs, prevEggAvg, drop)
				if err := create(rule, "Produksi telur menurun", desc, drop); err != nil {
					return nil, err
				}
			}
		}
	}

	if ageRule := rules["age_productivity_gap"]; ageRule != nil {
		windowStart := date.AddDays(-6)
		for i := range batches {
			batch := &batches[i]
			age := int(date.Time().Sub(batch.HatchDate.Time()).Hours() / 24)
			if age < 40 {
				continue
			}
			pop, err := PopulationAt(s.db, batch, date, 0)
			if err != nil {
				return nil, err
			}
			if pop <= 0 {
				continue
			}
			var rows []models.EggProduction
			if err := s.db.Where("batch_id = ? AND production_date BETWEEN ? AND ?", batch.ID, windowStart, date).
				Find(&rows).Error; err != nil {
				return nil, err
			}
			if len(rows) == 0 {
				continue
			}
			eggs := 0
			for _, row := range rows {
				eggs += row.EggCount
			}
			actual := float64(eggs) / (float64(pop) * 7) * 100
			standard := models.AgeProductivityStandard(age)
			gap := standard - actual
			if gap < ageRule.Threshold {
				continue
			}
			code := fmt.Sprintf("%s_b%d", ageRule.Code, batch.ID)
			title := fmt.Sprintf("Produktivitas %s di bawah standar umur", batch.Name)
			desc := fmt.Sprintf(
				"%s berumur %d hari (%s); produktivitas 7 hari %.1f%%, standar umur %.1f%% (selisih %.1f poin di bawah standar).",
				batch.Name, age, models.AgeProductivityStage(age), actual, standard, gap,
			)
			if err := createWithCode(ageRule, code, title, desc, round2(gap)); err != nil {
				return nil, err
			}
		}
	}

	if popPrev > 0 {
		drop := float64(popPrev-popNow) / float64(popPrev) * 100
		rule := rules["population_drop_warning"]
		if rule != nil && drop >= rule.Threshold {
			desc := fmt.Sprintf("Populasi turun dari %d menjadi %d ekor dalam 7 hari (%.1f%%).",
				popPrev, popNow, drop)
			if err := create(rule, "Populasi menurun signifikan", desc, drop); err != nil {
				return nil, err
			}
		}
	}

	rule := rules["feed_gap_warning"]
	if rule != nil {
		var latest models.FeedReceipt
		err := s.db.Where("received_date <= ?", date).Order("received_date DESC, id DESC").First(&latest).Error
		gap := 0
		if errors.Is(err, gorm.ErrRecordNotFound) {
			gap = int(rule.Threshold) + 1
		} else if err != nil {
			return nil, err
		} else {
			gap = int(date.Time().Sub(latest.ReceivedDate.Time()).Hours() / 24)
		}
		if gap > int(rule.Threshold) {
			msg := fmt.Sprintf("Belum ada penerimaan pakan dalam %d hari terakhir (batas %d hari).", gap, int(rule.Threshold))
			if err := create(rule, "Pakan perlu segera dicek", msg, float64(gap)); err != nil {
				return nil, err
			}
		}
	}

	return results, nil
}

func (s *WarningService) upsert(rule *models.WarningRule, date models.Date, title, description string, metric float64) (*models.WarningEvent, error) {
	return s.upsertWithCode(rule, rule.Code, date, title, description, metric)
}

func (s *WarningService) upsertWithCode(rule *models.WarningRule, code string, date models.Date, title, description string, metric float64) (*models.WarningEvent, error) {
	var event models.WarningEvent
	err := s.db.Where("code = ? AND event_date = ?", code, date).First(&event).Error
	ruleID := rule.ID
	if errors.Is(err, gorm.ErrRecordNotFound) {
		event = models.WarningEvent{
			RuleID: &ruleID, Code: code, Category: rule.Category, Level: rule.Level,
			Title: title, Description: description, MetricValue: metric, Threshold: rule.Threshold,
			EventDate: date, DetectedAt: time.Now(), Status: models.WarningOpen,
		}
		if err := s.db.Create(&event).Error; err != nil {
			return nil, err
		}
		return &event, nil
	}
	if err != nil {
		return nil, err
	}
	if event.Status == models.WarningOpen {
		event.Title = title
		event.Description = description
		event.MetricValue = metric
		event.Threshold = rule.Threshold
		event.Level = rule.Level
		event.Category = rule.Category
		if err := s.db.Save(&event).Error; err != nil {
			return nil, err
		}
	}
	return &event, nil
}

type WarningFilter struct {
	From     models.Date
	To       models.Date
	Status   string
	Category string
	Level    string
	Page     int
	Limit    int
}

func (s *WarningService) List(filter WarningFilter) ([]models.WarningEvent, int64, error) {
	query := s.db.Model(&models.WarningEvent{}).
		Where("event_date BETWEEN ? AND ?", filter.From, filter.To)
	if filter.Status != "" && filter.Status != "all" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Category != "" && filter.Category != "all" {
		query = query.Where("category = ?", filter.Category)
	}
	if filter.Level != "" && filter.Level != "all" {
		query = query.Where("level = ?", filter.Level)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var events []models.WarningEvent
	if err := query.Preload("Rule").Order("event_date DESC, detected_at DESC").
		Offset((filter.Page - 1) * filter.Limit).Limit(filter.Limit).
		Find(&events).Error; err != nil {
		return nil, 0, err
	}
	return events, total, nil
}

func (s *WarningService) CountOpen() (int64, int64, error) {
	var open, critical int64
	if err := s.db.Model(&models.WarningEvent{}).Where("status = ?", models.WarningOpen).Count(&open).Error; err != nil {
		return 0, 0, err
	}
	if err := s.db.Model(&models.WarningEvent{}).Where("status = ? AND level = ?", models.WarningOpen, models.LevelKritis).Count(&critical).Error; err != nil {
		return 0, 0, err
	}
	return open, critical, nil
}

func (s *WarningService) RecentOpen(limit int) ([]models.WarningEvent, error) {
	var events []models.WarningEvent
	err := s.db.Where("status = ?", models.WarningOpen).
		Order("event_date DESC, detected_at DESC").Limit(limit).Find(&events).Error
	return events, err
}

func (s *WarningService) Acknowledge(actor Actor, id uint) (*models.WarningEvent, error) {
	var event models.WarningEvent
	if err := s.db.First(&event, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("warning tidak ditemukan")
		}
		return nil, err
	}
	if event.Status == models.WarningAcknowledged {
		return &event, nil
	}
	now := time.Now()
	event.Status = models.WarningAcknowledged
	event.AcknowledgedAt = &now
	event.AcknowledgedName = actor.Name
	if actor.ID != 0 {
		event.AcknowledgedBy = &actor.ID
	}
	if err := s.db.Save(&event).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "acknowledge", "warning", event.ID, "Menandai warning diperiksa: "+event.Title)
	return &event, nil
}

func (s *WarningService) Rules() ([]models.WarningRule, error) {
	var rules []models.WarningRule
	err := s.db.Order("category ASC, id ASC").Find(&rules).Error
	return rules, err
}

type WarningRuleInput struct {
	Threshold   float64 `json:"threshold"`
	Level       string  `json:"level"`
	Enabled     bool    `json:"enabled"`
	Description string  `json:"description"`
}

func (s *WarningService) UpdateRule(actor Actor, id uint, input WarningRuleInput) (*models.WarningRule, error) {
	var rule models.WarningRule
	if err := s.db.First(&rule, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("aturan warning tidak ditemukan")
		}
		return nil, err
	}
	if input.Threshold < 0 {
		return nil, apperr.BadRequest("batas warning tidak boleh negatif")
	}
	if input.Level != models.LevelWaspada && input.Level != models.LevelKritis {
		return nil, apperr.BadRequest("level warning harus waspada atau kritis")
	}
	rule.Threshold = input.Threshold
	rule.Level = input.Level
	rule.Enabled = input.Enabled
	if strings.TrimSpace(input.Description) != "" {
		rule.Description = strings.TrimSpace(input.Description)
	}
	if err := s.db.Save(&rule).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "update", "warning_rule", rule.ID, "Mengubah aturan warning "+rule.Name)
	return &rule, nil
}
