package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"quail-management/backend/internal/database"
	"quail-management/backend/internal/models"
	"quail-management/backend/internal/response"
)

type InventoryHandler struct{}

func NewInventoryHandler() *InventoryHandler {
	return &InventoryHandler{}
}

type StockSummaryItem struct {
	ProductID     uuid.UUID       `json:"product_id"`
	SKU           string          `json:"sku"`
	Name          string          `json:"name"`
	Category      string          `json:"category"`
	UnitCode      string          `json:"unit_code"`
	CurrentStock  decimal.Decimal `json:"current_stock"`
	MinStockAlert decimal.Decimal `json:"min_stock_alert"`
	IsLowStock    bool            `json:"is_low_stock"`
}

func (h *InventoryHandler) GetSummary(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	unitMap := make(map[uuid.UUID]string)
	for _, u := range db.Units {
		unitMap[u.ID] = u.Code
	}

	stockMap := make(map[uuid.UUID]decimal.Decimal)
	for _, mov := range db.InventoryMovements {
		cur := stockMap[mov.ProductID]
		stockMap[mov.ProductID] = cur.Add(mov.Quantity)
	}

	var results []StockSummaryItem
	for _, prod := range db.Products {
		stock := stockMap[prod.ID]
		isLow := stock.LessThanOrEqual(prod.MinStockAlert) && prod.MinStockAlert.GreaterThan(decimal.Zero)

		results = append(results, StockSummaryItem{
			ProductID:     prod.ID,
			SKU:           prod.SKU,
			Name:          prod.Name,
			Category:      prod.Category,
			UnitCode:      unitMap[prod.DefaultUnitID],
			CurrentStock:  stock,
			MinStockAlert: prod.MinStockAlert,
			IsLowStock:    isLow,
		})
	}

	response.JSON(c, http.StatusOK, "Ringkasan stok persediaan", results)
}

func (h *InventoryHandler) ListMovements(c *gin.Context) {
	productIDStr := c.Query("product_id")

	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	prodMap := make(map[uuid.UUID]string)
	for _, p := range db.Products {
		prodMap[p.ID] = p.Name
	}
	unitMap := make(map[uuid.UUID]string)
	for _, u := range db.Units {
		unitMap[u.ID] = u.Code
	}

	type MovementDetailResponse struct {
		models.InventoryMovement
		ProductName string `json:"product_name"`
		UnitCode    string `json:"unit_code"`
	}

	var results []MovementDetailResponse
	for _, mov := range db.InventoryMovements {
		if productIDStr != "" && mov.ProductID.String() != productIDStr {
			continue
		}
		results = append(results, MovementDetailResponse{
			InventoryMovement: mov,
			ProductName:       prodMap[mov.ProductID],
			UnitCode:          unitMap[mov.UnitID],
		})
	}

	response.JSON(c, http.StatusOK, "Buku pergerakan stok", results)
}

func (h *InventoryHandler) RecordFeedUsage(c *gin.Context) {
	var req struct {
		FlockID   string          `json:"flock_id" binding:"required"`
		CoopID    string          `json:"coop_id" binding:"required"`
		ProductID string          `json:"product_id" binding:"required"`
		UsageDate string          `json:"usage_date" binding:"required"`
		Quantity  decimal.Decimal `json:"quantity" binding:"required"`
		Notes     string          `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data pemakaian pakan/obat tidak lengkap")
		return
	}

	if req.Quantity.LessThanOrEqual(decimal.Zero) {
		response.BadRequest(c, "Jumlah pemakaian harus lebih besar dari 0")
		return
	}

	usageDate, err := time.Parse("2006-01-02", req.UsageDate)
	if err != nil {
		response.BadRequest(c, "Format tanggal harus YYYY-MM-DD")
		return
	}

	flockUUID, err := uuid.Parse(req.FlockID)
	if err != nil {
		response.BadRequest(c, "ID flock tidak valid")
		return
	}
	coopUUID, err := uuid.Parse(req.CoopID)
	if err != nil {
		response.BadRequest(c, "ID kandang tidak valid")
		return
	}
	prodUUID, err := uuid.Parse(req.ProductID)
	if err != nil {
		response.BadRequest(c, "ID produk pakan tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	var product *models.Product
	for _, p := range db.Products {
		if p.ID == prodUUID {
			prodCopy := p
			product = &prodCopy
			break
		}
	}
	if product == nil {
		response.NotFound(c, "Produk pakan/obat tidak ditemukan")
		return
	}

	// Cek sisa stok saat ini
	currentStock := decimal.Zero
	for _, mov := range db.InventoryMovements {
		if mov.ProductID == prodUUID {
			currentStock = currentStock.Add(mov.Quantity)
		}
	}
	if currentStock.LessThan(req.Quantity) {
		response.Unprocessable(c, fmt.Sprintf("Stok %s tidak mencukupi (sisa: %s, dibutuhkan: %s)", product.Name, currentStock.String(), req.Quantity.String()))
		return
	}

	now := time.Now().UTC()
	usageID := uuid.New()

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	newUsage := models.FeedUsage{
		BaseUUIDModel: models.BaseUUIDModel{ID: usageID, CreatedAt: now, UpdatedAt: now},
		FarmID:        farmID,
		FlockID:       flockUUID,
		CoopID:        coopUUID,
		ProductID:     prodUUID,
		UnitID:        product.DefaultUnitID,
		UsageDate:     usageDate,
		Quantity:      req.Quantity,
		Notes:         req.Notes,
	}
	db.FeedUsages = append(db.FeedUsages, newUsage)

	// Single Source of Truth: Pengurangan stok dicatat sebagai mutasi negatif
	db.InventoryMovements = append(db.InventoryMovements, models.InventoryMovement{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FarmID:        farmID,
		ProductID:     prodUUID,
		UnitID:        product.DefaultUnitID,
		MovementDate:  usageDate,
		MovementType:  "usage_out",
		Quantity:      req.Quantity.Neg(), // Nilai negatif untuk pengurangan stok
		ReferenceType: "feed_usages",
		ReferenceID:   usageID,
		Notes:         "Pemakaian pakan/obat harian kandang",
	})

	_ = db.Persist()

	response.JSON(c, http.StatusCreated, "Pemakaian pakan berhasil dicatat dan stok berkurang", newUsage)
}

func (h *InventoryHandler) RecordAdjustment(c *gin.Context) {
	var req struct {
		ProductID string          `json:"product_id" binding:"required"`
		ActualQty decimal.Decimal `json:"actual_qty" binding:"required"`
		Reason    string          `json:"reason" binding:"required"`
		Notes     string          `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data penyesuaian stok tidak lengkap (alasan wajib diisi)")
		return
	}

	prodUUID, err := uuid.Parse(req.ProductID)
	if err != nil {
		response.BadRequest(c, "ID produk tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	var product *models.Product
	for _, p := range db.Products {
		if p.ID == prodUUID {
			prodCopy := p
			product = &prodCopy
			break
		}
	}
	if product == nil {
		response.NotFound(c, "Produk tidak ditemukan")
		return
	}

	// Hitung stok sistem
	systemStock := decimal.Zero
	for _, mov := range db.InventoryMovements {
		if mov.ProductID == prodUUID {
			systemStock = systemStock.Add(mov.Quantity)
		}
	}

	diffQty := req.ActualQty.Sub(systemStock)
	if diffQty.IsZero() {
		response.BadRequest(c, "Jumlah fisik aktual sama dengan jumlah sistem; tidak ada selisih yang disesuaikan")
		return
	}

	now := time.Now().UTC()
	adjID := uuid.New()
	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	adjNumber := fmt.Sprintf("ADJ-%s-%04d", time.Now().Format("20060102"), len(db.StockAdjustments)+1)

	newAdj := models.StockAdjustment{
		BaseUUIDModel:    models.BaseUUIDModel{ID: adjID, CreatedAt: now, UpdatedAt: now},
		FarmID:           farmID,
		AdjustmentNumber: adjNumber,
		AdjustmentDate:   now,
		Status:           "posted",
		Reason:           req.Reason,
		Items: []models.StockAdjustmentItem{
			{
				BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
				AdjustmentID:  adjID,
				ProductID:     prodUUID,
				UnitID:        product.DefaultUnitID,
				SystemQty:     systemStock,
				ActualQty:     req.ActualQty,
				DifferenceQty: diffQty,
				Notes:         req.Notes,
			},
		},
	}
	db.StockAdjustments = append(db.StockAdjustments, newAdj)

	// Catat mutasi selisih
	movementType := "adjustment_in"
	if diffQty.IsNegative() {
		movementType = "adjustment_out"
	}

	db.InventoryMovements = append(db.InventoryMovements, models.InventoryMovement{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FarmID:        farmID,
		ProductID:     prodUUID,
		UnitID:        product.DefaultUnitID,
		MovementDate:  now,
		MovementType:  movementType,
		Quantity:      diffQty,
		ReferenceType: "stock_adjustments",
		ReferenceID:   adjID,
		Notes:         fmt.Sprintf("Penyesuaian stok: %s. Alasan: %s", adjNumber, req.Reason),
	})

	_ = db.Persist()

	response.JSON(c, http.StatusCreated, "Penyesuaian stok berhasil dicatat", newAdj)
}

// RecordStockIn mencatat penerimaan stok masuk non-pembelian formal (misalnya: stok awal, donasi, retur, dll).
func (h *InventoryHandler) RecordStockIn(c *gin.Context) {
	var req struct {
		ProductID    string          `json:"product_id" binding:"required"`
		Quantity     decimal.Decimal `json:"quantity" binding:"required"`
		UnitCost     decimal.Decimal `json:"unit_cost"`
		ReceivedDate string          `json:"received_date" binding:"required"`
		Notes        string          `json:"notes"`
		Source       string          `json:"source"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data penerimaan stok tidak lengkap (produk, jumlah, dan tanggal wajib diisi)")
		return
	}

	if req.Quantity.LessThanOrEqual(decimal.Zero) {
		response.BadRequest(c, "Jumlah penerimaan harus lebih besar dari 0")
		return
	}

	receivedDate, err := time.Parse("2006-01-02", req.ReceivedDate)
	if err != nil {
		response.BadRequest(c, "Format tanggal harus YYYY-MM-DD")
		return
	}

	prodUUID, err := uuid.Parse(req.ProductID)
	if err != nil {
		response.BadRequest(c, "ID produk tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	var product *models.Product
	for _, p := range db.Products {
		if p.ID == prodUUID {
			prodCopy := p
			product = &prodCopy
			break
		}
	}
	if product == nil {
		response.NotFound(c, "Produk tidak ditemukan")
		return
	}

	now := time.Now().UTC()
	movID := uuid.New()

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	source := req.Source
	if source == "" {
		source = "manual"
	}
	notes := req.Notes
	if notes == "" {
		notes = fmt.Sprintf("Penerimaan stok manual — sumber: %s", source)
	}

	newMovement := models.InventoryMovement{
		BaseUUIDModel: models.BaseUUIDModel{ID: movID, CreatedAt: now, UpdatedAt: now},
		FarmID:        farmID,
		ProductID:     prodUUID,
		UnitID:        product.DefaultUnitID,
		MovementDate:  receivedDate,
		MovementType:  "stock_in",
		Quantity:      req.Quantity,
		ReferenceType: "manual_stock_in",
		ReferenceID:   movID,
		Notes:         notes,
	}
	db.InventoryMovements = append(db.InventoryMovements, newMovement)

	_ = db.Persist()

	response.JSON(c, http.StatusCreated, "Penerimaan stok berhasil dicatat", newMovement)
}
