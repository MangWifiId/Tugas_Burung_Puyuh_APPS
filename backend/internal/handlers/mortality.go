package handlers

import (
	"github.com/gin-gonic/gin"

	"manajemen-puyuh/backend/internal/services"
	"manajemen-puyuh/backend/internal/utils"
)

func (h *Handler) ListMortality(c *gin.Context) {
	from, to, ok := rangeOr(c, 30)
	if !ok {
		return
	}
	page, limit, _ := utils.Pagination(c)
	filter := services.MortalityFilter{
		From: from, To: to, BatchID: queryUint(c, "batch_id"), Page: page, Limit: limit,
	}
	data, total, err := h.Mortality.List(filter)
	if err != nil {
		handleListError(c, "list mortality", err)
		return
	}
	utils.Paginated(c, data, utils.BuildMeta(page, limit, total))
}

func (h *Handler) CreateMortality(c *gin.Context) {
	var input services.MortalityInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Mortality.Create(actor(c), input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Created(c, data)
}

func (h *Handler) UpdateMortality(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	var input services.MortalityInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Mortality.Update(actor(c), id, input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) DeleteMortality(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	if err := h.Mortality.Delete(actor(c), id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.NoContent(c)
}

func (h *Handler) MortalitySummary(c *gin.Context) {
	from, to, ok := rangeOr(c, 30)
	if !ok {
		return
	}
	groupBy, err := services.ParseGroupBy(c.DefaultQuery("group_by", "day"))
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	data, err := h.Mortality.Summary(from, to, groupBy)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}
