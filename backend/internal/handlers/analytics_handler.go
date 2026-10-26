package handlers

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"quail-management/backend/internal/database"
	"quail-management/backend/internal/response"
)

type AnalyticsHandler struct{}

func NewAnalyticsHandler() *AnalyticsHandler {
	return &AnalyticsHandler{}
}

type PeriodInfo struct {
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	DaysCount int    `json:"days_count"`
}

type AnalyticsSummary struct {
	ActivePopulation   int             `json:"active_population"`
	TotalEggsProduced  int             `json:"total_eggs_produced"`
	TotalSaleableEggs  int             `json:"total_saleable_eggs"`
	TotalDamagedEggs   int             `json:"total_damaged_eggs"`
	DamagedRatePct     float64         `json:"damaged_rate_pct"`
	HenDayPct          float64         `json:"hen_day_pct"`
	TotalFeedKg        decimal.Decimal `json:"total_feed_kg"`
	DailyFeedIntakeG   float64         `json:"daily_feed_intake_g"`
	FCRPer100Eggs      float64         `json:"fcr_per_100_eggs"`
	FCRPerTray         float64         `json:"fcr_per_tray"`
	FeedPricePerKg     decimal.Decimal `json:"feed_price_per_kg"`
	TotalFeedCost      decimal.Decimal `json:"total_feed_cost"`
	FeedCostPerEgg     decimal.Decimal `json:"feed_cost_per_egg"`
	FeedCostPerTray    decimal.Decimal `json:"feed_cost_per_tray"`
	AvgEggPrice        decimal.Decimal `json:"avg_egg_price"`
	GrossMarginPerEgg  decimal.Decimal `json:"gross_margin_per_egg"`
	GrossMarginPct     float64         `json:"gross_margin_pct"`
	TotalMortality     int             `json:"total_mortality"`
	MortalityRatePct   float64         `json:"mortality_rate_pct"`
	PerformanceStatus  string          `json:"performance_status"`
	PerformanceLabel   string          `json:"performance_label"`
}

type DailyAnalyticsTrend struct {
	Date               string  `json:"date"`
	EggsProduced       int     `json:"eggs_produced"`
	SaleableEggs       int     `json:"saleable_eggs"`
	DamagedEggs        int     `json:"damaged_eggs"`
	HenDayPct          float64 `json:"hen_day_pct"`
	FeedKg             float64 `json:"feed_kg"`
	DailyFeedPerBirdG  float64 `json:"daily_feed_per_bird_g"`
	FCRPer100          float64 `json:"fcr_per_100"`
}

type CoopPerformanceItem struct {
	CoopID        uuid.UUID       `json:"coop_id"`
	CoopCode      string          `json:"coop_code"`
	CoopName      string          `json:"coop_name"`
	Capacity      int             `json:"capacity"`
	Population    int             `json:"population"`
	EggsProduced  int             `json:"eggs_produced"`
	SaleableEggs  int             `json:"saleable_eggs"`
	HenDayPct     float64         `json:"hen_day_pct"`
	FeedKg        float64         `json:"feed_kg"`
	FeedPerBirdG  float64         `json:"feed_per_bird_g"`
	FCRPer100     float64         `json:"fcr_per_100"`
	FeedCostEst   decimal.Decimal `json:"feed_cost_est"`
	CostPerEgg    decimal.Decimal `json:"cost_per_egg"`
	Status        string          `json:"status"`
	StatusLabel   string          `json:"status_label"`
}

type PerformanceInsight struct {
	Category string `json:"category"`
	Title    string `json:"title"`
	Message  string `json:"message"`
	Type     string `json:"type"` // "success", "info", "warning"
}

type PerformanceAnalyticsResponse struct {
	Period         PeriodInfo            `json:"period"`
	Summary        AnalyticsSummary      `json:"summary"`
	DailyTrends    []DailyAnalyticsTrend `json:"daily_trends"`
	CoopComparison []CoopPerformanceItem `json:"coop_comparison"`
	Insights       []PerformanceInsight  `json:"insights"`
}

func (h *AnalyticsHandler) GetPerformanceAnalytics(c *gin.Context) {
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	coopIDStr := c.Query("coop_id")
	flockIDStr := c.Query("flock_id")

	now := time.Now()
	var endDate time.Time
	if endDateStr != "" {
		parsed, err := time.Parse("2006-01-02", endDateStr)
		if err == nil {
			endDate = parsed
		} else {
			endDate = now
		}
	} else {
		endDate = now
	}

	var startDate time.Time
	if startDateStr != "" {
		parsed, err := time.Parse("2006-01-02", startDateStr)
		if err == nil {
			startDate = parsed
		} else {
			startDate = endDate.AddDate(0, 0, -29)
		}
	} else {
		startDate = endDate.AddDate(0, 0, -29) // Default 30 hari
	}

	// Normalize to start of day
	startDate = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)
	endDate = time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, time.UTC)

	daysCount := int(endDate.Sub(startDate).Hours()/24) + 1
	if daysCount < 1 {
		daysCount = 1
	}

	var filterCoopID *uuid.UUID
	if coopIDStr != "" {
		if id, err := uuid.Parse(coopIDStr); err == nil {
			filterCoopID = &id
		}
	}

	var filterFlockID *uuid.UUID
	if flockIDStr != "" {
		if id, err := uuid.Parse(flockIDStr); err == nil {
			filterFlockID = &id
		}
	}

	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	// 1. Hitung Populasi per Kandang dan Total Populasi Aktif
	coopPopMap := make(map[uuid.UUID]int)
	for _, fp := range db.FlockPlacements {
		// Pastikan flock masih aktif
		for _, f := range db.Flocks {
			if f.ID == fp.FlockID && f.Status == "active" {
				coopPopMap[fp.CoopID] += fp.Quantity
				break
			}
		}
	}

	activePopulation := 0
	if filterCoopID != nil {
		activePopulation = coopPopMap[*filterCoopID]
	} else if filterFlockID != nil {
		for _, f := range db.Flocks {
			if f.ID == *filterFlockID && f.Status == "active" {
				activePopulation = f.CurrentQuantity
				break
			}
		}
	} else {
		for _, f := range db.Flocks {
			if f.Status == "active" {
				activePopulation += f.CurrentQuantity
			}
		}
	}

	// 2. Tentukan Harga Beli Pakan & Harga Jual Telur
	feedPricePerKg := decimal.NewFromInt(7500) // Default benchmark harga pakan layer (Rp 7.500/kg)
	for _, p := range db.ProductPrices {
		if p.PriceType == "buy" && p.Price.GreaterThan(decimal.Zero) {
			for _, prod := range db.Products {
				if prod.ID == p.ProductID && prod.Category == "feed" {
					feedPricePerKg = p.Price
					break
				}
			}
		}
	}

	avgEggPrice := decimal.NewFromInt(450) // Default benchmark harga jual telur (Rp 450/butir)
	for _, p := range db.ProductPrices {
		if p.PriceType == "sell" && p.Price.GreaterThan(decimal.Zero) {
			for _, prod := range db.Products {
				if prod.ID == p.ProductID && prod.Category == "egg" {
					avgEggPrice = p.Price
					break
				}
			}
		}
	}

	// Map untuk pengelompokan harian
	type DayAccumulator struct {
		EggsProduced int
		SaleableEggs int
		DamagedEggs  int
		FeedKg       decimal.Decimal
	}
	dailyMap := make(map[string]*DayAccumulator)

	// Inisialisasi setiap hari dalam rentang
	for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
		dStr := d.Format("2006-01-02")
		dailyMap[dStr] = &DayAccumulator{}
	}

	// Map untuk pengelompokan per kandang
	type CoopAccumulator struct {
		EggsProduced int
		SaleableEggs int
		FeedKg       decimal.Decimal
	}
	coopDataMap := make(map[uuid.UUID]*CoopAccumulator)
	for _, coop := range db.Coops {
		coopDataMap[coop.ID] = &CoopAccumulator{}
	}

	totalEggsProduced := 0
	totalSaleableEggs := 0
	totalDamagedEggs := 0

	// 3. Akumulasi Produksi Telur
	for _, pr := range db.ProductionRecords {
		prDate := pr.RecordDate
		if prDate.Before(startDate) || prDate.After(endDate) {
			continue
		}
		if filterCoopID != nil && pr.CoopID != *filterCoopID {
			continue
		}
		if filterFlockID != nil && pr.FlockID != *filterFlockID {
			continue
		}

		totalEggsProduced += pr.TotalEggs
		totalSaleableEggs += pr.SaleableEggs
		totalDamagedEggs += pr.DamagedEggs

		dStr := prDate.Format("2006-01-02")
		if day, ok := dailyMap[dStr]; ok {
			day.EggsProduced += pr.TotalEggs
			day.SaleableEggs += pr.SaleableEggs
			day.DamagedEggs += pr.DamagedEggs
		}

		if coopAcc, ok := coopDataMap[pr.CoopID]; ok {
			coopAcc.EggsProduced += pr.TotalEggs
			coopAcc.SaleableEggs += pr.SaleableEggs
		}
	}

	// 4. Akumulasi Pemakaian Pakan
	totalFeedKg := decimal.Zero
	for _, fu := range db.FeedUsages {
		uDate := fu.UsageDate
		if uDate.Before(startDate) || uDate.After(endDate) {
			continue
		}
		if filterCoopID != nil && fu.CoopID != *filterCoopID {
			continue
		}
		if filterFlockID != nil && fu.FlockID != *filterFlockID {
			continue
		}

		totalFeedKg = totalFeedKg.Add(fu.Quantity)

		dStr := uDate.Format("2006-01-02")
		if day, ok := dailyMap[dStr]; ok {
			day.FeedKg = day.FeedKg.Add(fu.Quantity)
		}

		if coopAcc, ok := coopDataMap[fu.CoopID]; ok {
			coopAcc.FeedKg = coopAcc.FeedKg.Add(fu.Quantity)
		}
	}

	// 5. Akumulasi Mortalitas (Kematian)
	totalMortality := 0
	for _, fm := range db.FlockMovements {
		if (fm.MovementType == "mortality" || fm.MovementType == "culling") &&
			!fm.MovementDate.Before(startDate) && !fm.MovementDate.After(endDate) {
			if filterFlockID != nil && fm.FlockID != *filterFlockID {
				continue
			}
			totalMortality += fm.Quantity
		}
	}

	// 6. Hitung Metrik Utama
	damagedRatePct := 0.0
	if totalEggsProduced > 0 {
		damagedRatePct = (float64(totalDamagedEggs) / float64(totalEggsProduced)) * 100
	}

	henDayPct := 0.0
	dailyFeedIntakeG := 0.0
	if activePopulation > 0 && daysCount > 0 {
		totalBirdDays := float64(activePopulation * daysCount)
		henDayPct = (float64(totalEggsProduced) / totalBirdDays) * 100
		feedKgFloat, _ := totalFeedKg.Float64()
		dailyFeedIntakeG = (feedKgFloat * 1000.0) / totalBirdDays
	}

	fcrPer100 := 0.0
	fcrPerTray := 0.0
	if totalEggsProduced > 0 {
		feedKgFloat, _ := totalFeedKg.Float64()
		fcrPer100 = (feedKgFloat / float64(totalEggsProduced)) * 100.0
		fcrPerTray = (feedKgFloat / float64(totalEggsProduced)) * 30.0
	}

	totalFeedCost := totalFeedKg.Mul(feedPricePerKg)
	feedCostPerEgg := decimal.Zero
	feedCostPerTray := decimal.Zero
	if totalSaleableEggs > 0 {
		feedCostPerEgg = totalFeedCost.DivRound(decimal.NewFromInt(int64(totalSaleableEggs)), 2)
		feedCostPerTray = feedCostPerEgg.Mul(decimal.NewFromInt(30))
	}

	grossMarginPerEgg := avgEggPrice.Sub(feedCostPerEgg)
	grossMarginPct := 0.0
	if avgEggPrice.GreaterThan(decimal.Zero) {
		marginFloat, _ := grossMarginPerEgg.Float64()
		sellFloat, _ := avgEggPrice.Float64()
		grossMarginPct = (marginFloat / sellFloat) * 100.0
	}

	mortalityRatePct := 0.0
	if activePopulation+totalMortality > 0 {
		mortalityRatePct = (float64(totalMortality) / float64(activePopulation+totalMortality)) * 100.0
	}

	// Status Performa Keseluruhan
	perfStatus := "good"
	perfLabel := "Normal / Stabil"
	if henDayPct >= 80.0 && fcrPer100 <= 2.6 {
		perfStatus = "excellent"
		perfLabel = "Sangat Baik (Optimal)"
	} else if (henDayPct > 0 && henDayPct < 70.0) || fcrPer100 > 3.0 || damagedRatePct > 4.0 {
		perfStatus = "warning"
		perfLabel = "Perlu Evaluasi Operasional"
	}

	// 7. Bentuk Tren Harian (Sorted by Date)
	var dateKeys []string
	for k := range dailyMap {
		dateKeys = append(dateKeys, k)
	}
	sort.Strings(dateKeys)

	var dailyTrends []DailyAnalyticsTrend
	for _, dKey := range dateKeys {
		acc := dailyMap[dKey]
		feedFloat, _ := acc.FeedKg.Float64()

		dHenDay := 0.0
		dFeedPerBird := 0.0
		if activePopulation > 0 {
			dHenDay = (float64(acc.EggsProduced) / float64(activePopulation)) * 100.0
			dFeedPerBird = (feedFloat * 1000.0) / float64(activePopulation)
		}

		dFCR := 0.0
		if acc.EggsProduced > 0 {
			dFCR = (feedFloat / float64(acc.EggsProduced)) * 100.0
		}

		dailyTrends = append(dailyTrends, DailyAnalyticsTrend{
			Date:              dKey,
			EggsProduced:      acc.EggsProduced,
			SaleableEggs:      acc.SaleableEggs,
			DamagedEggs:       acc.DamagedEggs,
			HenDayPct:         round(dHenDay, 1),
			FeedKg:            round(feedFloat, 2),
			DailyFeedPerBirdG: round(dFeedPerBird, 1),
			FCRPer100:         round(dFCR, 2),
		})
	}

	// 8. Bentuk Komparasi Antar Kandang
	var coopComparison []CoopPerformanceItem
	for _, coop := range db.Coops {
		acc := coopDataMap[coop.ID]
		pop := coopPopMap[coop.ID]
		feedFloat, _ := acc.FeedKg.Float64()

		cHenDay := 0.0
		cFeedPerBird := 0.0
		if pop > 0 && daysCount > 0 {
			cHenDay = (float64(acc.EggsProduced) / float64(pop*daysCount)) * 100.0
			cFeedPerBird = (feedFloat * 1000.0) / float64(pop*daysCount)
		}

		cFCR := 0.0
		if acc.EggsProduced > 0 {
			cFCR = (feedFloat / float64(acc.EggsProduced)) * 100.0
		}

		cCost := acc.FeedKg.Mul(feedPricePerKg)
		cCostPerEgg := decimal.Zero
		if acc.SaleableEggs > 0 {
			cCostPerEgg = cCost.DivRound(decimal.NewFromInt(int64(acc.SaleableEggs)), 2)
		}

		cStatus := "optimal"
		cStatusLabel := "Optimal"
		if pop == 0 {
			cStatus = "inactive"
			cStatusLabel = "Kosong / Tidak Ada Puyuh"
		} else if cHenDay >= 80.0 && cFCR <= 2.6 {
			cStatus = "optimal"
			cStatusLabel = "Sangat Efisien"
		} else if cHenDay < 70.0 || cFCR > 3.0 {
			cStatus = "warning"
			cStatusLabel = "Perlu Perhatian"
		} else {
			cStatus = "good"
			cStatusLabel = "Stabil"
		}

		coopComparison = append(coopComparison, CoopPerformanceItem{
			CoopID:       coop.ID,
			CoopCode:     coop.Code,
			CoopName:     coop.Name,
			Capacity:     coop.Capacity,
			Population:   pop,
			EggsProduced: acc.EggsProduced,
			SaleableEggs: acc.SaleableEggs,
			HenDayPct:    round(cHenDay, 1),
			FeedKg:       round(feedFloat, 2),
			FeedPerBirdG: round(cFeedPerBird, 1),
			FCRPer100:    round(cFCR, 2),
			FeedCostEst:  cCost,
			CostPerEgg:   cCostPerEgg,
			Status:       cStatus,
			StatusLabel:  cStatusLabel,
		})
	}

	// 9. Bentuk Actionable Insights Cerdas
	var insights []PerformanceInsight

	// Insight 1: Hen Day
	if henDayPct >= 80.0 {
		insights = append(insights, PerformanceInsight{
			Category: "production",
			Title:    "Produktivitas Telur Prima",
			Message:  fmt.Sprintf("Rata-rata Hen-Day mencapai %.1f%% (di atas standar 80%%). Puyuh berada dalam siklus puncak produksi yang sangat baik.", henDayPct),
			Type:     "success",
		})
	} else if henDayPct >= 70.0 {
		insights = append(insights, PerformanceInsight{
			Category: "production",
			Title:    "Tingkat Bertelur Cukup Stabil",
			Message:  fmt.Sprintf("Rata-rata Hen-Day sebesar %.1f%% berada dalam batas normal (70-80%%). Pertahankan konsistensi pencahayaan kandang 16 jam/hari.", henDayPct),
			Type:     "info",
		})
	} else if henDayPct > 0 {
		insights = append(insights, PerformanceInsight{
			Category: "production",
			Title:    "Produktivitas di Bawah Target",
			Message:  fmt.Sprintf("Hen-Day rata-rata hanya %.1f%% (di bawah standar ideal 75-85%%). Periksa potensi stres suhu udara kandang, sanitasi air minum, atau defisiensi asam amino pakan.", henDayPct),
			Type:     "warning",
		})
	}

	// Insight 2: Feed Intake
	if dailyFeedIntakeG >= 22.0 && dailyFeedIntakeG <= 26.0 {
		insights = append(insights, PerformanceInsight{
			Category: "feed",
			Title:    "Konsumsi Pakan Sangat Ideal",
			Message:  fmt.Sprintf("Konsumsi pakan harian rata-rata %.1f gram/ekor/hari tepat di standar ilmiah puyuh petelur (22-25 g). Tidak ada pemborosan pakan terdeteksi.", dailyFeedIntakeG),
			Type:     "success",
		})
	} else if dailyFeedIntakeG > 26.0 {
		insights = append(insights, PerformanceInsight{
			Category: "feed",
			Title:    "Konsumsi Pakan Tinggi / Potensi Boros",
			Message:  fmt.Sprintf("Pemberian pakan mencapai %.1f g/ekor/hari (>26g). Periksa apakah tempat pakan sering tercecer, ada hama pengerat, atau energi ransum pakan kurang padat.", dailyFeedIntakeG),
			Type:     "warning",
		})
	} else if dailyFeedIntakeG > 0 && dailyFeedIntakeG < 22.0 {
		insights = append(insights, PerformanceInsight{
			Category: "feed",
			Title:    "Konsumsi Pakan Terlalu Rendah",
			Message:  fmt.Sprintf("Konsumsi pakan hanya %.1f g/ekor/hari (<22g). Puyuh berisiko kekurangan nutrisi untuk pembentukan telur. Cek nafsu makan dan suplai air minum.", dailyFeedIntakeG),
			Type:     "warning",
		})
	}

	// Insight 3: FCR
	if fcrPer100 > 0 && fcrPer100 <= 2.5 {
		insights = append(insights, PerformanceInsight{
			Category: "fcr",
			Title:    "Efisiensi Pakan (FCR) Luar Biasa",
			Message:  fmt.Sprintf("FCR berada di angka %.2f kg/100 butir (%.2f kg/rak). Konversi ransum pakan menjadi telur sangat efisien dan memaksimalkan laba usaha.", fcrPer100, fcrPerTray),
			Type:     "success",
		})
	} else if fcrPer100 > 3.0 {
		insights = append(insights, PerformanceInsight{
			Category: "fcr",
			Title:    "FCR Di Atas Rata-rata Industri",
			Message:  fmt.Sprintf("FCR tercatat %.2f kg/100 butir. Dibutuhkan pakan lebih banyak dari normal untuk menghasilkan telur. Evaluasi formulasi pakan atau afkir puyuh yang tidak produktif.", fcrPer100),
			Type:     "warning",
		})
	}

	// Insight 4: Kualitas Telur (Damaged rate)
	if damagedRatePct > 0 && damagedRatePct <= 2.0 {
		insights = append(insights, PerformanceInsight{
			Category: "quality",
			Title:    "Cangkang Telur Kokoh & Kualitas Bagus",
			Message:  fmt.Sprintf("Persentase telur rusak sangat minim (%.1f%%). Kalsium pakan dan proses pemungutan telur berlangsung higienis dan terawat.", damagedRatePct),
			Type:     "success",
		})
	} else if damagedRatePct > 3.0 {
		insights = append(insights, PerformanceInsight{
			Category: "quality",
			Title:    "Tingkat Telur Pecah / Rusak Perlu Diwaspadai",
			Message:  fmt.Sprintf("Telur rusak mencapai %.1f%% dari total panen. Tambahkan grit kalsium/mineral feed dan pastikan alas kemiringan kandang bersih.", damagedRatePct),
			Type:     "warning",
		})
	}

	// Insight 5: Finansial & Margin
	if totalSaleableEggs > 0 {
		insights = append(insights, PerformanceInsight{
			Category: "financial",
			Title:    "Analisis HPP & Margin Kotor",
			Message:  fmt.Sprintf("Estimasi HPP biaya pakan Rp %s/butir (Rp %s/rak). Dengan rata-rata harga jual Rp %s/butir, margin kotor pakan adalah %.1f%% (Rp %s/butir).", feedCostPerEgg.String(), feedCostPerTray.String(), avgEggPrice.String(), grossMarginPct, grossMarginPerEgg.String()),
			Type:     "info",
		})
	}

	resp := PerformanceAnalyticsResponse{
		Period: PeriodInfo{
			StartDate: startDate.Format("2006-01-02"),
			EndDate:   endDate.Format("2006-01-02"),
			DaysCount: daysCount,
		},
		Summary: AnalyticsSummary{
			ActivePopulation:   activePopulation,
			TotalEggsProduced:  totalEggsProduced,
			TotalSaleableEggs:  totalSaleableEggs,
			TotalDamagedEggs:   totalDamagedEggs,
			DamagedRatePct:     round(damagedRatePct, 2),
			HenDayPct:          round(henDayPct, 1),
			TotalFeedKg:        totalFeedKg,
			DailyFeedIntakeG:   round(dailyFeedIntakeG, 1),
			FCRPer100Eggs:      round(fcrPer100, 2),
			FCRPerTray:         round(fcrPerTray, 2),
			FeedPricePerKg:     feedPricePerKg,
			TotalFeedCost:      totalFeedCost,
			FeedCostPerEgg:     feedCostPerEgg,
			FeedCostPerTray:    feedCostPerTray,
			AvgEggPrice:        avgEggPrice,
			GrossMarginPerEgg:  grossMarginPerEgg,
			GrossMarginPct:     round(grossMarginPct, 1),
			TotalMortality:     totalMortality,
			MortalityRatePct:   round(mortalityRatePct, 2),
			PerformanceStatus:  perfStatus,
			PerformanceLabel:   perfLabel,
		},
		DailyTrends:    dailyTrends,
		CoopComparison: coopComparison,
		Insights:       insights,
	}

	response.JSON(c, http.StatusOK, "Analisis performa & FCR peternakan puyuh berhasil dimuat", resp)
}

func round(val float64, precision int) float64 {
	ratio := math.Pow(10, float64(precision))
	return math.Round(val*ratio) / ratio
}
