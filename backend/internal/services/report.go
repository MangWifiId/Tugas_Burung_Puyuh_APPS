package services

import (
	"fmt"
	"math"
	"sort"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/mailer"
	"manajemen-puyuh/backend/internal/models"
)

type ReportService struct {
	db *gorm.DB
}

func NewReportService(db *gorm.DB) *ReportService { return &ReportService{db: db} }

type ReportPoint struct {
	Period       string  `json:"period"`
	Label        string  `json:"label"`
	Eggs         int     `json:"eggs"`
	SalesEggs    int     `json:"sales_eggs"`
	Revenue      float64 `json:"revenue"`
	Mortality    int     `json:"mortality"`
	Sacks        float64 `json:"sacks"`
	FeedSpend    float64 `json:"feed_spend"`
	FeedPrice    float64 `json:"feed_price"`
	Population   int     `json:"population"`
	Productivity float64 `json:"productivity"`
}

type ReportTotals struct {
	TotalEggs         int     `json:"total_eggs"`
	AverageEggs       float64 `json:"average_eggs"`
	TotalSalesEggs    int     `json:"total_sales_eggs"`
	TotalRevenue      float64 `json:"total_revenue"`
	TotalMortality    int     `json:"total_mortality"`
	MortalityRate     float64 `json:"mortality_rate"`
	TotalFeedSacks    float64 `json:"total_feed_sacks"`
	TotalFeedSpend    float64 `json:"total_feed_spend"`
	LatestFeedPrice   float64 `json:"latest_feed_price"`
	CurrentPopulation int     `json:"current_population"`
	Productivity      float64 `json:"productivity"`
}

type ReportResponse struct {
	From      models.Date            `json:"from"`
	To        models.Date            `json:"to"`
	GroupBy   string                 `json:"group_by"`
	Days      int                    `json:"days"`
	Totals    ReportTotals           `json:"totals"`
	Series    []ReportPoint          `json:"series"`
	AgeSeries []AgeProductivityPoint `json:"age_series"`
	Batches   []models.BatchStats    `json:"batches"`
}

// AgeProductivityPoint membandingkan produktivitas aktual dengan standar umur
// pada kelompok umur (minggu) tertentu.
type AgeProductivityPoint struct {
	AgeWeeks     int     `json:"age_weeks"`
	Label        string  `json:"label"`
	Eggs         int     `json:"eggs"`
	Population   int     `json:"population"`
	Productivity float64 `json:"productivity"`
	Standard     float64 `json:"standard"`
	Samples      int     `json:"samples"`
}

type dayData struct {
	eggs       int
	salesEggs  int
	revenue    float64
	mortality  int
	sacks      float64
	feedSpend  float64
	feedPrice  float64
	population int
}

func (s *ReportService) Overview(from, to models.Date, groupBy string) (*ReportResponse, error) {
	if groupBy == "" {
		groupBy = "day"
	}
	days := map[string]*dayData{}
	order := []string{}
	for day := from; !day.After(to); day = day.AddDays(1) {
		days[day.String()] = &dayData{}
		order = append(order, day.String())
	}
	dayCount := len(order)

	var productions []models.EggProduction
	if err := s.db.Where("production_date BETWEEN ? AND ?", from, to).Find(&productions).Error; err != nil {
		return nil, err
	}
	for _, item := range productions {
		if day, ok := days[item.ProductionDate.String()]; ok {
			day.eggs += item.EggCount
		}
	}

	var pickups []models.EggPickup
	if err := s.db.Where("pickup_date BETWEEN ? AND ?", from, to).Find(&pickups).Error; err != nil {
		return nil, err
	}
	for _, item := range pickups {
		if day, ok := days[item.PickupDate.String()]; ok {
			day.salesEggs += item.EggCount
		}
	}

	var notes []models.SalesNote
	if err := s.db.Where("note_date BETWEEN ? AND ?", from, to).Find(&notes).Error; err != nil {
		return nil, err
	}
	for _, item := range notes {
		if day, ok := days[item.NoteDate.String()]; ok {
			day.revenue += item.TotalAmount
		}
	}

	var mortality []models.MortalityRecord
	if err := s.db.Where("record_date BETWEEN ? AND ?", from, to).Find(&mortality).Error; err != nil {
		return nil, err
	}
	for _, item := range mortality {
		if day, ok := days[item.RecordDate.String()]; ok {
			day.mortality += item.Count
		}
	}

	var receipts []models.FeedReceipt
	if err := s.db.Where("received_date BETWEEN ? AND ?", from, to).Find(&receipts).Error; err != nil {
		return nil, err
	}
	for _, item := range receipts {
		if day, ok := days[item.ReceivedDate.String()]; ok {
			day.sacks += item.Sacks
			day.feedSpend += item.TotalPrice()
		}
	}

	var histories []models.FeedPriceHistory
	if err := s.db.Where("effective_date <= ?", to).
		Order("effective_date ASC, id ASC").Find(&histories).Error; err != nil {
		return nil, err
	}
	runningPrice := 0.0
	priceByDay := map[string]float64{}
	for _, history := range histories {
		if history.EffectiveDate.Before(from) {
			runningPrice = history.PricePerSack
			continue
		}
		priceByDay[history.EffectiveDate.String()] = history.PricePerSack
	}
	for _, key := range order {
		if price, ok := priceByDay[key]; ok {
			runningPrice = price
		}
		days[key].feedPrice = runningPrice
	}

	var batches []models.QuailBatch
	if err := s.db.Order("hatch_date ASC").Find(&batches).Error; err != nil {
		return nil, err
	}
	batchByID := map[uint]*models.QuailBatch{}
	batchPopulation := map[uint]map[string]int{}
	popByDay := map[string]int{}
	for i := range batches {
		batch := &batches[i]
		batchByID[batch.ID] = batch
		points, err := PopulationHistory(s.db, batch, from, to)
		if err != nil {
			return nil, err
		}
		daily := make(map[string]int, len(points))
		for _, point := range points {
			if point.Date.Before(batch.HatchDate) {
				continue
			}
			popByDay[point.Date.String()] += point.Population
			daily[point.Date.String()] = point.Population
		}
		batchPopulation[batch.ID] = daily
	}
	for _, key := range order {
		days[key].population = popByDay[key]
	}

	// Produktivitas menurut umur: setiap catatan produksi dihitung terhadap
	// populasi batch pada hari itu, lalu dikelompokkan per minggu umur.
	type ageAggregate struct {
		eggs, population, samples int
	}
	ageBuckets := map[int]*ageAggregate{}
	for _, item := range productions {
		if item.BatchID == nil {
			continue
		}
		batch := batchByID[*item.BatchID]
		if batch == nil {
			continue
		}
		age := int(item.ProductionDate.Time().Sub(batch.HatchDate.Time()).Hours() / 24)
		if age < 35 {
			continue
		}
		population := batchPopulation[batch.ID][item.ProductionDate.String()]
		if population <= 0 {
			continue
		}
		week := age / 7
		agg := ageBuckets[week]
		if agg == nil {
			agg = &ageAggregate{}
			ageBuckets[week] = agg
		}
		agg.eggs += item.EggCount
		agg.population += population
		agg.samples++
	}
	ageWeeks := make([]int, 0, len(ageBuckets))
	for week := range ageBuckets {
		ageWeeks = append(ageWeeks, week)
	}
	sort.Ints(ageWeeks)
	ageSeries := make([]AgeProductivityPoint, 0, len(ageWeeks))
	for _, week := range ageWeeks {
		agg := ageBuckets[week]
		point := AgeProductivityPoint{
			AgeWeeks:   week,
			Label:      fmt.Sprintf("%d mg", week),
			Eggs:       agg.eggs,
			Population: agg.population,
			Samples:    agg.samples,
			Standard:   models.AgeProductivityStandard(week*7 + 3),
		}
		if agg.population > 0 {
			point.Productivity = round2(float64(agg.eggs) / float64(agg.population) * 100)
		}
		ageSeries = append(ageSeries, point)
	}

	buckets := map[string]*ReportPoint{}
	popSum := map[string]float64{}
	bucketDays := map[string]int{}
	bucketOrder := []string{}
	totalEggs, totalSales, totalMortality := 0, 0, 0
	totalRevenue, totalSacks, totalSpend, totalPop := 0.0, 0.0, 0.0, 0.0
	latestPrice, lastPopulation := 0.0, 0
	for _, key := range order {
		day := days[key]
		totalEggs += day.eggs
		totalSales += day.salesEggs
		totalRevenue += day.revenue
		totalMortality += day.mortality
		totalSacks += day.sacks
		totalSpend += day.feedSpend
		totalPop += float64(day.population)
		lastPopulation = day.population
		if day.feedPrice > 0 {
			latestPrice = day.feedPrice
		}

		parsed, _ := models.ParseDate(key)
		period, label := PeriodKey(parsed, groupBy)

		point, ok := buckets[period]
		if !ok {
			point = &ReportPoint{Period: period, Label: label}
			buckets[period] = point
			bucketOrder = append(bucketOrder, period)
		}
		point.Eggs += day.eggs
		point.SalesEggs += day.salesEggs
		point.Revenue += day.revenue
		point.Mortality += day.mortality
		point.Sacks += day.sacks
		point.FeedSpend += day.feedSpend
		point.Population = day.population
		if day.feedPrice > 0 {
			point.FeedPrice = day.feedPrice
		}
		popSum[period] += float64(day.population)
		bucketDays[period]++
	}

	sort.Strings(bucketOrder)
	series := make([]ReportPoint, 0, len(bucketOrder))
	for _, period := range bucketOrder {
		point := buckets[period]
		daysInBucket := bucketDays[period]
		avgPop := 0.0
		if daysInBucket > 0 {
			avgPop = popSum[period] / float64(daysInBucket)
		}
		if avgPop > 0 && daysInBucket > 0 {
			point.Productivity = round2(float64(point.Eggs) / (avgPop * float64(daysInBucket)) * 100)
		}
		series = append(series, *point)
	}

	avgPopulation := 0.0
	if dayCount > 0 {
		avgPopulation = totalPop / float64(dayCount)
	}
	totals := ReportTotals{
		TotalEggs:         totalEggs,
		TotalSalesEggs:    totalSales,
		TotalRevenue:      totalRevenue,
		TotalMortality:    totalMortality,
		TotalFeedSacks:    totalSacks,
		TotalFeedSpend:    totalSpend,
		LatestFeedPrice:   latestPrice,
		CurrentPopulation: lastPopulation,
	}
	if dayCount > 0 {
		totals.AverageEggs = round2(float64(totalEggs) / float64(dayCount))
	}
	if avgPopulation > 0 {
		totals.Productivity = round2(float64(totalEggs) / (avgPopulation * float64(dayCount)) * 100)
	}
	startPopulation := lastPopulation + totalMortality
	if startPopulation > 0 {
		totals.MortalityRate = round2(float64(totalMortality) / float64(startPopulation) * 100)
	}

	batchStats, err := NewBatchService(s.db).List("", "all")
	if err != nil {
		return nil, err
	}
	activePopulation := 0
	for _, stat := range batchStats {
		if stat.Status == models.BatchStatusActive {
			activePopulation += stat.CurrentPopulation
		}
	}
	totals.CurrentPopulation = activePopulation

	return &ReportResponse{
		From: from, To: to, GroupBy: groupBy, Days: dayCount,
		Totals: totals, Series: series, AgeSeries: ageSeries, Batches: batchStats,
	}, nil
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}

type DashboardService struct {
	db     *gorm.DB
	mailer *mailer.Mailer
}

func NewDashboardService(db *gorm.DB, m *mailer.Mailer) *DashboardService {
	return &DashboardService{db: db, mailer: m}
}

type DashboardData struct {
	TodayEggs         int                    `json:"today_eggs"`
	TodayMortality    int                    `json:"today_mortality"`
	MonthEggs         int                    `json:"month_eggs"`
	MonthMortality    int                    `json:"month_mortality"`
	MonthPickupEggs   int                    `json:"month_pickup_eggs"`
	MonthRevenue      float64                `json:"month_revenue"`
	MonthNotes        int                    `json:"month_notes"`
	MonthFeedSacks    float64                `json:"month_feed_sacks"`
	MonthFeedSpend    float64                `json:"month_feed_spend"`
	CurrentPopulation int                    `json:"current_population"`
	InitialPopulation int                    `json:"initial_population"`
	TodayProductivity float64                `json:"today_productivity"`
	MonthProductivity float64                `json:"month_productivity"`
	LatestFeedPrice   float64                `json:"latest_feed_price"`
	OpenWarnings      int64                  `json:"open_warnings"`
	CriticalWarnings  int64                  `json:"critical_warnings"`
	UpcomingEvents    []models.CalendarEvent `json:"upcoming_events"`
	RecentWarnings    []models.WarningEvent  `json:"recent_warnings"`
	Charts            []ReportPoint          `json:"charts"`
	AgeSeries         []AgeProductivityPoint `json:"age_series"`
	Batches           []models.BatchStats    `json:"batches"`
}

func (s *DashboardService) Load(from, to models.Date, groupBy string) (*DashboardData, error) {
	today := models.DateToday()
	report, err := NewReportService(s.db).Overview(from, to, groupBy)
	if err != nil {
		return nil, err
	}

	monthStart := today.StartOfMonth()
	monthReport, err := NewReportService(s.db).Overview(monthStart, today, "day")
	if err != nil {
		return nil, err
	}

	warningService := NewWarningService(s.db, s.mailer)
	if _, err := warningService.GenerateFor(today); err != nil {
		return nil, err
	}
	openWarnings, criticalWarnings, err := warningService.CountOpen()
	if err != nil {
		return nil, err
	}
	recentWarnings, err := warningService.RecentOpen(5)
	if err != nil {
		return nil, err
	}
	upcoming, err := NewCalendarService(s.db).Upcoming(7, 5)
	if err != nil {
		return nil, err
	}
	latestPrice, err := NewFeedService(s.db).LatestPrice("layer")
	if err != nil {
		return nil, err
	}

	todayEggs, _, err := warningService.productionTotal(today, today)
	if err != nil {
		return nil, err
	}
	todayMortality, _, err := warningService.mortalityTotal(today, today)
	if err != nil {
		return nil, err
	}

	initialPopulation := 0
	for _, batch := range report.Batches {
		if batch.Status == models.BatchStatusActive {
			initialPopulation += batch.InitialPopulation
		}
	}

	data := &DashboardData{
		TodayEggs: todayEggs, TodayMortality: todayMortality,
		MonthEggs: monthReport.Totals.TotalEggs, MonthMortality: monthReport.Totals.TotalMortality,
		MonthPickupEggs: monthReport.Totals.TotalSalesEggs, MonthRevenue: monthReport.Totals.TotalRevenue,
		MonthFeedSacks: monthReport.Totals.TotalFeedSacks, MonthFeedSpend: monthReport.Totals.TotalFeedSpend,
		CurrentPopulation: report.Totals.CurrentPopulation, InitialPopulation: initialPopulation,
		MonthProductivity: monthReport.Totals.Productivity,
		OpenWarnings:      openWarnings, CriticalWarnings: criticalWarnings,
		UpcomingEvents: upcoming, RecentWarnings: recentWarnings,
		Charts: report.Series, AgeSeries: report.AgeSeries, Batches: report.Batches,
	}
	if report.Totals.CurrentPopulation > 0 {
		data.TodayProductivity = round2(float64(todayEggs) / float64(report.Totals.CurrentPopulation) * 100)
	}
	if latestPrice != nil {
		data.LatestFeedPrice = latestPrice.PricePerSack
	}
	var noteCount int64
	if err := s.db.Model(&models.SalesNote{}).
		Where("note_date BETWEEN ? AND ?", monthStart, today).Count(&noteCount).Error; err != nil {
		return nil, err
	}
	data.MonthNotes = int(noteCount)
	return data, nil
}
