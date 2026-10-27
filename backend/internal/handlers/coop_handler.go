package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"quail-management/backend/internal/database"
	"quail-management/backend/internal/models"
	"quail-management/backend/internal/response"
)

type CoopHandler struct{}

func NewCoopHandler() *CoopHandler {
	return &CoopHandler{}
}

type CoopResponse struct {
	models.Coop
	CurrentPopulation int `json:"current_population"`
}

type CreateCoopRequest struct {
	Code     string `json:"code" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Capacity int    `json:"capacity" binding:"required,min=1"`
	Status   string `json:"status"`
	Notes    string `json:"notes"`
}

func (h *CoopHandler) ListCoops(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	var result []CoopResponse
	for _, coop := range db.Coops {
		pop := 0
		for _, fp := range db.FlockPlacements {
			if fp.CoopID == coop.ID {
				pop += fp.Quantity
			}
		}
		result = append(result, CoopResponse{
			Coop:              coop,
			CurrentPopulation: pop,
		})
	}

	response.JSON(c, http.StatusOK, "Daftar kandang", result)
}

func (h *CoopHandler) CreateCoop(c *gin.Context) {
	var req CreateCoopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data kandang tidak lengkap atau kapasitas tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	for _, coop := range db.Coops {
		if coop.Code == req.Code {
			response.Conflict(c, "Kode kandang sudah digunakan")
			return
		}
	}

	now := time.Now().UTC()
	status := req.Status
	if status == "" {
		status = "active"
	}
	if status != "active" && status != "maintenance" && status != "inactive" {
		response.BadRequest(c, "Status kandang harus salah satu dari: active, maintenance, inactive")
		return
	}

	newCoop := models.Coop{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FarmID:        farmID,
		Code:          req.Code,
		Name:          req.Name,
		Capacity:      req.Capacity,
		Status:        status,
		Notes:         req.Notes,
	}

	db.Coops = append(db.Coops, newCoop)
	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Data gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Kandang baru berhasil ditambahkan", newCoop)
}

func (h *CoopHandler) UpdateCoop(c *gin.Context) {
	idStr := c.Param("id")
	coopID, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "ID kandang tidak valid")
		return
	}

	var req CreateCoopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data pembaruan tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	foundIndex := -1
	for i, coop := range db.Coops {
		if coop.ID == coopID {
			foundIndex = i
			break
		}
	}

	if foundIndex == -1 {
		response.NotFound(c, "Kandang tidak ditemukan")
		return
	}

	if req.Status != "" && req.Status != "active" && req.Status != "maintenance" && req.Status != "inactive" {
		response.BadRequest(c, "Status kandang harus salah satu dari: active, maintenance, inactive")
		return
	}

	currentPopulation := 0
	for _, fp := range db.FlockPlacements {
		if fp.CoopID == coopID {
			currentPopulation += fp.Quantity
		}
	}
	if req.Capacity < currentPopulation {
		response.Unprocessable(c, fmt.Sprintf("Kapasitas kandang (%d) tidak boleh lebih kecil dari populasi saat ini (%d)", req.Capacity, currentPopulation))
		return
	}

	db.Coops[foundIndex].Name = req.Name
	db.Coops[foundIndex].Capacity = req.Capacity
	if req.Status != "" {
		db.Coops[foundIndex].Status = req.Status
	}
	db.Coops[foundIndex].Notes = req.Notes
	db.Coops[foundIndex].UpdatedAt = time.Now().UTC()

	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Data gagal disimpan, silakan coba lagi")
		return
	}
	response.JSON(c, http.StatusOK, "Kandang berhasil diperbarui", db.Coops[foundIndex])
}
