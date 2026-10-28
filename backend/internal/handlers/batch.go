package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"manajemen-puyuh/backend/internal/services"
	"manajemen-puyuh/backend/internal/utils"
)

func queryUint(c *gin.Context, key string) uint {
	value, err := strconv.ParseUint(c.Query(key), 10, 64)
	if err != nil {
		return 0
	}
	return uint(value)
}

func (h *Handler) ListBatches(c *gin.Context) {
	data, err := h.Batches.List(c.Query("search"), c.DefaultQuery("status", "all"))
	if err != nil {
		handleListError(c, "list batches", err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) GetBatch(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	data, err := h.Batches.Get(id)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) CreateBatch(c *gin.Context) {
	var input services.BatchInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Batches.Create(actor(c), input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Created(c, data)
}

func (h *Handler) UpdateBatch(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	var input services.BatchInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Batches.Update(actor(c), id, input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) DeleteBatch(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	if err := h.Batches.Delete(actor(c), id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.NoContent(c)
}

func (h *Handler) BatchHistory(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	from, to, ok := rangeOr(c, 30)
	if !ok {
		return
	}
	data, err := h.Batches.History(id, from, to)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) ListAdjustments(c *gin.Context) {
	from, to, ok := rangeOr(c, 30)
	if !ok {
		return
	}
	data, err := h.Adjust.List(queryUint(c, "batch_id"), from, to)
	if err != nil {
		handleListError(c, "list adjustments", err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) CreateAdjustment(c *gin.Context) {
	var input services.AdjustmentInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Adjust.Create(actor(c), input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Created(c, data)
}

func (h *Handler) UpdateAdjustment(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	var input services.AdjustmentInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Adjust.Update(actor(c), id, input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) DeleteAdjustment(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	if err := h.Adjust.Delete(actor(c), id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.NoContent(c)
}
