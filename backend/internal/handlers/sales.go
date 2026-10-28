package handlers

import (
	"github.com/gin-gonic/gin"

	"manajemen-puyuh/backend/internal/services"
	"manajemen-puyuh/backend/internal/utils"
)

func (h *Handler) ListPickups(c *gin.Context) {
	from, to, ok := rangeOr(c, 30)
	if !ok {
		return
	}
	page, limit, _ := utils.Pagination(c)
	data, total, err := h.Sales.ListPickups(services.PickupFilter{
		From: from, To: to, Status: c.DefaultQuery("status", "all"), Page: page, Limit: limit,
	})
	if err != nil {
		handleListError(c, "list pickups", err)
		return
	}
	utils.Paginated(c, data, utils.BuildMeta(page, limit, total))
}

func (h *Handler) CreatePickup(c *gin.Context) {
	var input services.PickupInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Sales.CreatePickup(actor(c), input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Created(c, data)
}

func (h *Handler) UpdatePickup(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	var input services.PickupInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Sales.UpdatePickup(actor(c), id, input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) DeletePickup(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	if err := h.Sales.DeletePickup(actor(c), id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.NoContent(c)
}

func (h *Handler) LinkablePickups(c *gin.Context) {
	from, to, ok := rangeOr(c, 90)
	if !ok {
		return
	}
	data, err := h.Sales.PickupsForLinking(from, to)
	if err != nil {
		handleListError(c, "linkable pickups", err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) ListNotes(c *gin.Context) {
	from, to, ok := rangeOr(c, 30)
	if !ok {
		return
	}
	page, limit, _ := utils.Pagination(c)
	data, total, err := h.Sales.ListNotes(services.NoteFilter{
		From: from, To: to, Search: c.Query("search"), Page: page, Limit: limit,
	})
	if err != nil {
		handleListError(c, "list notes", err)
		return
	}
	utils.Paginated(c, data, utils.BuildMeta(page, limit, total))
}

func (h *Handler) GetNote(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	data, err := h.Sales.GetNote(id)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) CreateNote(c *gin.Context) {
	var input services.SalesNoteInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Sales.CreateNote(actor(c), input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Created(c, data)
}

func (h *Handler) UpdateNote(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	var input services.SalesNoteInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Sales.UpdateNote(actor(c), id, input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) DeleteNote(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	if err := h.Sales.DeleteNote(actor(c), id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.NoContent(c)
}

func (h *Handler) SalesSummary(c *gin.Context) {
	from, to, ok := rangeOr(c, 30)
	if !ok {
		return
	}
	data, err := h.Sales.Summary(from, to)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}
