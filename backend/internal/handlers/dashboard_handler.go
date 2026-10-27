package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"quail-management/backend/internal/database"
	"quail-management/backend/internal/response"
)

type DashboardHandler struct{}

func NewDashboardHandler() *DashboardHandler {
	return &DashboardHandler{}
}

type DashboardSummaryResponse struct {
	ActivePopulation    int             `json:"active_population"`
	TotalCoops          int             `json:"total_coops"`
	TodayProductionEggs int             `json:"today_production_eggs"`
	TodayDamagedEggs    int             `json:"today_damaged_eggs"`
	TodaySaleableEggs   int             `json:"today_saleable_eggs"`
	EggStockReady       decimal.Decimal `json:"egg_stock_ready"`
	TotalReceivables    decimal.Decimal `json:"total_receivables"`
	TotalPayables       decimal.Decimal `json:"total_payables"`
	TotalCashBalance    decimal.Decimal `json:"total_cash_balance"`
	LowStockItemsCount  int             `json:"low_stock_items_count"`
}

type ProductionTrendPoint struct {
	Date         string `json:"date"`
	TotalEggs    int    `json:"total_eggs"`
	SaleableEggs int    `json:"saleable_eggs"`
	DamagedEggs  int    `json:"damaged_eggs"`
}

func (h *DashboardHandler) GetSummary(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	// 1. Populasi aktif
	activePop := 0
	for _, f := range db.Flocks {
		if f.Status == "active" {
			activePop += f.CurrentQuantity
		}
	}

	// 2. Produksi hari ini
	todayStr := time.Now().Format("2006-01-02")
	todayTotal := 0
	todayDamaged := 0
	todaySaleable := 0
	for _, pr := range db.ProductionRecords {
		if pr.RecordDate.Format("2006-01-02") == todayStr {
			todayTotal += pr.TotalEggs
			todayDamaged += pr.DamagedEggs
			todaySaleable += pr.SaleableEggs
		}
	}

	// 3. Stok telur layak jual & barang kritis
	eggStock := decimal.Zero
	stockMap := make(map[uuid.UUID]decimal.Decimal)
	for _, mov := range db.InventoryMovements {
		stockMap[mov.ProductID] = stockMap[mov.ProductID].Add(mov.Quantity)
	}

	lowStockCount := 0
	for _, p := range db.Products {
		stk := stockMap[p.ID]
		if p.Category == "egg" {
			eggStock = eggStock.Add(stk)
		}
		if stk.LessThanOrEqual(p.MinStockAlert) && p.MinStockAlert.GreaterThan(decimal.Zero) {
			lowStockCount++
		}
	}

	// 4. Piutang & Utang belum lunas
	totalReceivables := decimal.Zero
	for _, inv := range db.CustomerInvoices {
		if inv.Status != "paid" && inv.Status != "cancelled" {
			totalReceivables = totalReceivables.Add(inv.TotalAmount.Sub(inv.PaidAmount))
		}
	}

	totalPayables := decimal.Zero
	for _, bill := range db.SupplierBills {
		if bill.Status != "paid" && bill.Status != "cancelled" {
			totalPayables = totalPayables.Add(bill.TotalAmount.Sub(bill.PaidAmount))
		}
	}

	// 5. Total Saldo Kas
	totalCash := decimal.Zero
	for _, ca := range db.CashAccounts {
		if ca.IsActive {
			totalCash = totalCash.Add(ca.CurrentBalance)
		}
	}

	summary := DashboardSummaryResponse{
		ActivePopulation:    activePop,
		TotalCoops:          len(db.Coops),
		TodayProductionEggs: todayTotal,
		TodayDamagedEggs:    todayDamaged,
		TodaySaleableEggs:   todaySaleable,
		EggStockReady:       eggStock,
		TotalReceivables:    totalReceivables,
		TotalPayables:       totalPayables,
		TotalCashBalance:    totalCash,
		LowStockItemsCount:  lowStockCount,
	}

	response.JSON(c, http.StatusOK, "Ringkasan metrik dashboard", summary)
}

func (h *DashboardHandler) GetProductionTrends(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	// 7 hari terakhir
	trendMap := make(map[string]*ProductionTrendPoint)
	var dates []string

	for i := 6; i >= 0; i-- {
		d := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		dates = append(dates, d)
		trendMap[d] = &ProductionTrendPoint{
			Date: d,
		}
	}

	for _, pr := range db.ProductionRecords {
		d := pr.RecordDate.Format("2006-01-02")
		if point, exists := trendMap[d]; exists {
			point.TotalEggs += pr.TotalEggs
			point.SaleableEggs += pr.SaleableEggs
			point.DamagedEggs += pr.DamagedEggs
		}
	}

	var results []ProductionTrendPoint
	for _, d := range dates {
		results = append(results, *trendMap[d])
	}

	response.JSON(c, http.StatusOK, "Tren produksi telur 7 hari terakhir", results)
}
