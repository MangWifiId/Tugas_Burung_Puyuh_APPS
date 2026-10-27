package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"quail-management/backend/internal/database"
	"quail-management/backend/internal/models"
	"quail-management/backend/internal/response"
)

type PricingHandler struct{}

func NewPricingHandler() *PricingHandler {
	return &PricingHandler{}
}

type PriceDetailResponse struct {
	models.ProductPrice
	ProductName string `json:"product_name"`
	UnitCode    string `json:"unit_code"`
}

func (h *PricingHandler) ListPrices(c *gin.Context) {
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

	var results []PriceDetailResponse
	for _, price := range db.ProductPrices {
		results = append(results, PriceDetailResponse{
			ProductPrice: price,
			ProductName:  prodMap[price.ProductID],
			UnitCode:     unitMap[price.UnitID],
		})
	}

	response.JSON(c, http.StatusOK, "Daftar riwayat harga", results)
}

func (h *PricingHandler) SetPrice(c *gin.Context) {
	var req struct {
		ProductID string          `json:"product_id" binding:"required"`
		UnitID    string          `json:"unit_id" binding:"required"`
		PriceType string          `json:"price_type" binding:"required"` // 'sell', 'buy'
		Price     decimal.Decimal `json:"price" binding:"required"`
		ValidFrom string          `json:"valid_from" binding:"required"` // "YYYY-MM-DD"
		Notes     string          `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data penetapan harga tidak lengkap")
		return
	}

	validFromDate, err := time.Parse("2006-01-02", req.ValidFrom)
	if err != nil {
		response.BadRequest(c, "Format tanggal harus YYYY-MM-DD")
		return
	}

	prodUUID, err := uuid.Parse(req.ProductID)
	if err != nil {
		response.BadRequest(c, "ID produk tidak valid")
		return
	}

	unitUUID, err := uuid.Parse(req.UnitID)
	if err != nil {
		response.BadRequest(c, "ID satuan tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	if !req.Price.GreaterThan(decimal.Zero) {
		response.BadRequest(c, "Harga harus lebih besar dari 0")
		return
	}
	if req.PriceType != "sell" && req.PriceType != "buy" {
		response.BadRequest(c, "Tipe harga harus 'sell' atau 'buy'")
		return
	}
	if _, ok := findProduct(db, prodUUID); !ok {
		response.NotFound(c, "Produk tidak ditemukan")
		return
	}
	unitFound := false
	for _, u := range db.Units {
		if u.ID == unitUUID {
			unitFound = true
			break
		}
	}
	if !unitFound {
		response.NotFound(c, "Satuan tidak ditemukan")
		return
	}

	now := time.Now().UTC()

	// Tutup tanggal masa berlaku harga lama jika ada
	for i := range db.ProductPrices {
		if db.ProductPrices[i].ProductID == prodUUID &&
			db.ProductPrices[i].UnitID == unitUUID &&
			db.ProductPrices[i].PriceType == req.PriceType &&
			db.ProductPrices[i].ValidTo == nil {
			yesterday := validFromDate.AddDate(0, 0, -1)
			db.ProductPrices[i].ValidTo = &yesterday
		}
	}

	newPrice := models.ProductPrice{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		ProductID:     prodUUID,
		UnitID:        unitUUID,
		PriceType:     req.PriceType,
		Price:         req.Price,
		ValidFrom:     validFromDate,
		Notes:         req.Notes,
	}
	db.ProductPrices = append(db.ProductPrices, newPrice)
	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Data gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Harga baru berhasil ditetapkan", newPrice)
}
