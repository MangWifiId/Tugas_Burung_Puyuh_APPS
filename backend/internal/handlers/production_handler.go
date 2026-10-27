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

type ProductionHandler struct{}

func NewProductionHandler() *ProductionHandler {
	return &ProductionHandler{}
}

type ProductionRecordResponse struct {
	models.ProductionRecord
	FlockName string `json:"flock_name"`
	CoopName  string `json:"coop_name"`
}

func (h *ProductionHandler) ListProduction(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	flockMap := make(map[uuid.UUID]string)
	for _, f := range db.Flocks {
		flockMap[f.ID] = f.Name + " (" + f.Code + ")"
	}

	coopMap := make(map[uuid.UUID]string)
	for _, coop := range db.Coops {
		coopMap[coop.ID] = coop.Name + " (" + coop.Code + ")"
	}

	var results []ProductionRecordResponse
	for _, pr := range db.ProductionRecords {
		results = append(results, ProductionRecordResponse{
			ProductionRecord: pr,
			FlockName:        flockMap[pr.FlockID],
			CoopName:         coopMap[pr.CoopID],
		})
	}

	response.JSON(c, http.StatusOK, "Riwayat produksi telur", results)
}

func (h *ProductionHandler) RecordProduction(c *gin.Context) {
	var req struct {
		FlockID     string `json:"flock_id" binding:"required"`
		CoopID      string `json:"coop_id" binding:"required"`
		RecordDate  string `json:"record_date" binding:"required"` // "YYYY-MM-DD"
		TotalEggs   int    `json:"total_eggs" binding:"required,min=0"`
		DamagedEggs int    `json:"damaged_eggs" binding:"min=0"`
		Notes       string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data pencatatan produksi tidak lengkap")
		return
	}

	if req.DamagedEggs > req.TotalEggs {
		response.BadRequest(c, "Jumlah telur rusak tidak boleh melebihi total telur yang diambil")
		return
	}
	if req.TotalEggs <= 0 {
		response.BadRequest(c, "Total telur yang diambil harus lebih besar dari 0")
		return
	}

	recDate, err := time.Parse("2006-01-02", req.RecordDate)
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

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	if _, ok := findFlock(db, flockUUID); !ok {
		response.NotFound(c, "Kelompok puyuh tidak ditemukan")
		return
	}
	if _, ok := findCoop(db, coopUUID); !ok {
		response.NotFound(c, "Kandang tidak ditemukan")
		return
	}

	for _, existing := range db.ProductionRecords {
		if existing.FlockID == flockUUID && existing.CoopID == coopUUID &&
			existing.RecordDate.Format("2006-01-02") == recDate.Format("2006-01-02") {
			response.Conflict(c, "Produksi untuk kelompok dan kandang ini pada tanggal tersebut sudah dicatat")
			return
		}
	}

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	// Cari produk telur layak jual (kategori 'egg')
	var eggProduct *models.Product
	for _, p := range db.Products {
		if p.Category == "egg" && p.IsActive {
			eggProduct = &p
			break
		}
	}

	saleableEggs := req.TotalEggs - req.DamagedEggs
	now := time.Now().UTC()
	recordID := uuid.New()

	newRecord := models.ProductionRecord{
		BaseUUIDModel: models.BaseUUIDModel{ID: recordID, CreatedAt: now, UpdatedAt: now},
		FarmID:        farmID,
		FlockID:       flockUUID,
		CoopID:        coopUUID,
		RecordDate:    recDate,
		TotalEggs:     req.TotalEggs,
		DamagedEggs:   req.DamagedEggs,
		SaleableEggs:  saleableEggs,
		Notes:         req.Notes,
	}
	db.ProductionRecords = append(db.ProductionRecords, newRecord)

	// Single Source of Truth: Menambah stok telur layak jual di inventory_movements
	if eggProduct != nil && saleableEggs > 0 {
		db.InventoryMovements = append(db.InventoryMovements, models.InventoryMovement{
			BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			FarmID:        farmID,
			ProductID:     eggProduct.ID,
			UnitID:        eggProduct.DefaultUnitID,
			MovementDate:  recDate,
			MovementType:  "production_in",
			Quantity:      decimal.NewFromInt(int64(saleableEggs)),
			ReferenceType: "production_records",
			ReferenceID:   recordID,
			Notes:         "Panen harian puyuh petelur layak jual",
		})
	}

	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Pencatatan produksi gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Pencatatan produksi telur berhasil disimpan dan stok telur diperbarui", newRecord)
}
