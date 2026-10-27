package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"quail-management/backend/internal/database"
	"quail-management/backend/internal/models"
	"quail-management/backend/internal/response"
)

type FlockHandler struct{}

func NewFlockHandler() *FlockHandler {
	return &FlockHandler{}
}

type FlockDetailResponse struct {
	models.Flock
	CoopPlacements []CoopPlacementDetail  `json:"coop_placements"`
	Movements      []models.FlockMovement `json:"movements"`
}

type CoopPlacementDetail struct {
	CoopID   uuid.UUID `json:"coop_id"`
	CoopCode string    `json:"coop_code"`
	CoopName string    `json:"coop_name"`
	Quantity int       `json:"quantity"`
}

func (h *FlockHandler) ListFlocks(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	coopMap := make(map[uuid.UUID]models.Coop)
	for _, coop := range db.Coops {
		coopMap[coop.ID] = coop
	}

	var results []FlockDetailResponse
	for _, f := range db.Flocks {
		var placements []CoopPlacementDetail
		for _, fp := range db.FlockPlacements {
			if fp.FlockID == f.ID && fp.Quantity > 0 {
				coop := coopMap[fp.CoopID]
				placements = append(placements, CoopPlacementDetail{
					CoopID:   fp.CoopID,
					CoopCode: coop.Code,
					CoopName: coop.Name,
					Quantity: fp.Quantity,
				})
			}
		}

		results = append(results, FlockDetailResponse{
			Flock:          f,
			CoopPlacements: placements,
		})
	}

	response.JSON(c, http.StatusOK, "Daftar kelompok puyuh", results)
}

func (h *FlockHandler) CreateFlock(c *gin.Context) {
	var req struct {
		Code            string `json:"code" binding:"required"`
		Name            string `json:"name" binding:"required"`
		EntryDate       string `json:"entry_date" binding:"required"` // "YYYY-MM-DD"
		InitialQuantity int    `json:"initial_quantity" binding:"required,min=1"`
		InitialAgeDays  int    `json:"initial_age_days"`
		InitialCoopID   string `json:"initial_coop_id" binding:"required"`
		Notes           string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data kelompok puyuh tidak lengkap")
		return
	}

	entryDate, err := time.Parse("2006-01-02", req.EntryDate)
	if err != nil {
		response.BadRequest(c, "Format tanggal harus YYYY-MM-DD")
		return
	}

	coopUUID, err := uuid.Parse(req.InitialCoopID)
	if err != nil {
		response.BadRequest(c, "ID kandang awal tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	coop, ok := findCoop(db, coopUUID)
	if !ok {
		response.NotFound(c, "Kandang awal tidak ditemukan")
		return
	}

	usedCapacity := 0
	for _, fp := range db.FlockPlacements {
		if fp.CoopID == coopUUID {
			usedCapacity += fp.Quantity
		}
	}
	if coop.Capacity > 0 && usedCapacity+req.InitialQuantity > coop.Capacity {
		response.Unprocessable(c, "Kapasitas kandang tidak mencukupi untuk jumlah awal kelompok puyuh")
		return
	}

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	for _, f := range db.Flocks {
		if f.Code == req.Code {
			response.Conflict(c, "Kode kelompok puyuh sudah digunakan")
			return
		}
	}

	now := time.Now().UTC()
	flockID := uuid.New()
	newFlock := models.Flock{
		BaseUUIDModel:   models.BaseUUIDModel{ID: flockID, CreatedAt: now, UpdatedAt: now},
		FarmID:          farmID,
		Code:            req.Code,
		Name:            req.Name,
		EntryDate:       entryDate,
		InitialQuantity: req.InitialQuantity,
		CurrentQuantity: req.InitialQuantity,
		InitialAgeDays:  req.InitialAgeDays,
		Status:          "active",
		Notes:           req.Notes,
	}
	db.Flocks = append(db.Flocks, newFlock)

	// Alokasi kandang awal
	db.FlockPlacements = append(db.FlockPlacements, models.FlockPlacement{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FlockID:       flockID,
		CoopID:        coopUUID,
		Quantity:      req.InitialQuantity,
	})

	// Log movement awal
	db.FlockMovements = append(db.FlockMovements, models.FlockMovement{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FlockID:       flockID,
		MovementDate:  entryDate,
		MovementType:  "addition",
		Quantity:      req.InitialQuantity,
		ToCoopID:      &coopUUID,
		Reason:        "Penerimaan bibit/kelompok puyuh baru",
	})

	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Data gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Kelompok puyuh berhasil ditambahkan", newFlock)
}

func (h *FlockHandler) RecordMovement(c *gin.Context) {
	flockIDStr := c.Param("id")
	flockID, err := uuid.Parse(flockIDStr)
	if err != nil {
		response.BadRequest(c, "ID kelompok puyuh tidak valid")
		return
	}

	var req struct {
		MovementDate string `json:"movement_date" binding:"required"`
		MovementType string `json:"movement_type" binding:"required"` // 'mortality', 'culling', 'transfer', 'addition'
		Quantity     int    `json:"quantity" binding:"required,min=1"`
		FromCoopID   string `json:"from_coop_id"`
		ToCoopID     string `json:"to_coop_id"`
		Reason       string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data mutasi populasi tidak lengkap (alasan wajib diisi)")
		return
	}

	movDate, err := time.Parse("2006-01-02", req.MovementDate)
	if err != nil {
		response.BadRequest(c, "Format tanggal harus YYYY-MM-DD")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	flockIdx := -1
	for i, f := range db.Flocks {
		if f.ID == flockID {
			flockIdx = i
			break
		}
	}
	if flockIdx == -1 {
		response.NotFound(c, "Kelompok puyuh tidak ditemukan")
		return
	}

	now := time.Now().UTC()
	var fromCoopUUID, toCoopUUID *uuid.UUID

	if req.FromCoopID != "" {
		parsed, err := uuid.Parse(req.FromCoopID)
		if err != nil {
			response.BadRequest(c, "ID kandang asal tidak valid")
			return
		}
		if _, ok := findCoop(db, parsed); !ok {
			response.NotFound(c, "Kandang asal tidak ditemukan")
			return
		}
		fromCoopUUID = &parsed
	}
	if req.ToCoopID != "" {
		parsed, err := uuid.Parse(req.ToCoopID)
		if err != nil {
			response.BadRequest(c, "ID kandang tujuan tidak valid")
			return
		}
		if _, ok := findCoop(db, parsed); !ok {
			response.NotFound(c, "Kandang tujuan tidak ditemukan")
			return
		}
		toCoopUUID = &parsed
	}

	switch req.MovementType {
	case "mortality", "culling":
		// Mengurangi populasi total peternakan dan kandang asal
		if req.Quantity > db.Flocks[flockIdx].CurrentQuantity {
			response.BadRequest(c, "Jumlah pengurangan melebihi sisa populasi kelompok saat ini")
			return
		}

		if fromCoopUUID != nil {
			placementIdx := -1
			for j := range db.FlockPlacements {
				if db.FlockPlacements[j].FlockID == flockID && db.FlockPlacements[j].CoopID == *fromCoopUUID {
					placementIdx = j
					break
				}
			}
			if placementIdx == -1 {
				response.Unprocessable(c, "Kelompok puyuh tidak terdaftar di kandang asal yang dipilih")
				return
			}
			if db.FlockPlacements[placementIdx].Quantity < req.Quantity {
				response.Unprocessable(c, "Jumlah di kandang asal tidak mencukupi untuk pengurangan populasi")
				return
			}
			db.FlockPlacements[placementIdx].Quantity -= req.Quantity
		} else {
			// Tanpa kandang asal: kurangi alokasi kandang secara berurutan.
			remaining := req.Quantity
			for j := range db.FlockPlacements {
				if remaining == 0 {
					break
				}
				if db.FlockPlacements[j].FlockID != flockID || db.FlockPlacements[j].Quantity <= 0 {
					continue
				}
				take := remaining
				if db.FlockPlacements[j].Quantity < take {
					take = db.FlockPlacements[j].Quantity
				}
				db.FlockPlacements[j].Quantity -= take
				remaining -= take
			}
		}

		db.Flocks[flockIdx].CurrentQuantity -= req.Quantity
		db.Flocks[flockIdx].UpdatedAt = now
		if db.Flocks[flockIdx].CurrentQuantity == 0 {
			db.Flocks[flockIdx].Status = "culled"
		}

	case "transfer":
		// Mutasi antar kandang: TIDAK MENGUBAH total populasi peternakan
		if fromCoopUUID == nil || toCoopUUID == nil {
			response.BadRequest(c, "Kandang asal dan kandang tujuan harus dipilih untuk transfer antar-kandang")
			return
		}
		if *fromCoopUUID == *toCoopUUID {
			response.BadRequest(c, "Kandang asal dan tujuan tidak boleh sama")
			return
		}

		placementIdx := -1
		for j := range db.FlockPlacements {
			if db.FlockPlacements[j].FlockID == flockID && db.FlockPlacements[j].CoopID == *fromCoopUUID {
				placementIdx = j
				break
			}
		}
		if placementIdx == -1 {
			response.Unprocessable(c, "Kelompok puyuh tidak terdaftar di kandang asal yang dipilih")
			return
		}
		if db.FlockPlacements[placementIdx].Quantity < req.Quantity {
			response.Unprocessable(c, "Jumlah di kandang asal tidak mencukupi untuk transfer")
			return
		}
		db.FlockPlacements[placementIdx].Quantity -= req.Quantity

		// Tambah ke tujuan
		foundTarget := false
		for j := range db.FlockPlacements {
			if db.FlockPlacements[j].FlockID == flockID && db.FlockPlacements[j].CoopID == *toCoopUUID {
				db.FlockPlacements[j].Quantity += req.Quantity
				foundTarget = true
				break
			}
		}
		if !foundTarget {
			db.FlockPlacements = append(db.FlockPlacements, models.FlockPlacement{
				BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
				FlockID:       flockID,
				CoopID:        *toCoopUUID,
				Quantity:      req.Quantity,
			})
		}

	case "addition":
		// Penambahan populasi
		db.Flocks[flockIdx].CurrentQuantity += req.Quantity
		db.Flocks[flockIdx].UpdatedAt = now

		targetAdded := false
		if toCoopUUID != nil {
			for j := range db.FlockPlacements {
				if db.FlockPlacements[j].FlockID == flockID && db.FlockPlacements[j].CoopID == *toCoopUUID {
					db.FlockPlacements[j].Quantity += req.Quantity
					targetAdded = true
					break
				}
			}
		}
		if !targetAdded {
			// Jika kandang tujuan tidak dipilih, gunakan alokasi kandang pertama.
			for j := range db.FlockPlacements {
				if db.FlockPlacements[j].FlockID == flockID {
					db.FlockPlacements[j].Quantity += req.Quantity
					targetAdded = true
					break
				}
			}
		}
		if !targetAdded {
			response.Unprocessable(c, "Kelompok puyuh belum memiliki alokasi kandang; pilih kandang tujuan")
			return
		}

	default:
		response.BadRequest(c, "Tipe mutasi populasi tidak dikenal")
		return
	}

	newMov := models.FlockMovement{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FlockID:       flockID,
		MovementDate:  movDate,
		MovementType:  req.MovementType,
		Quantity:      req.Quantity,
		FromCoopID:    fromCoopUUID,
		ToCoopID:      toCoopUUID,
		Reason:        req.Reason,
	}
	db.FlockMovements = append(db.FlockMovements, newMov)

	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Mutasi populasi gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Mutasi populasi berhasil dicatat", newMov)
}
