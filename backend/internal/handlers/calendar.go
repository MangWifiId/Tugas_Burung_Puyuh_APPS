package handlers

import (
	"github.com/gin-gonic/gin"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
	"manajemen-puyuh/backend/internal/services"
	"manajemen-puyuh/backend/internal/utils"
)

func (h *Handler) ListCalendar(c *gin.Context) {
	today := models.DateToday()
	from, to := today.StartOfMonth(), today.EndOfMonth()
	if raw := c.Query("from"); raw != "" {
		parsed, err := models.ParseDate(raw)
		if err != nil {
			utils.HandleError(c, apperr.BadRequest("parameter from harus berformat YYYY-MM-DD"))
			return
		}
		from = parsed
	}
	if raw := c.Query("to"); raw != "" {
		parsed, err := models.ParseDate(raw)
		if err != nil {
			utils.HandleError(c, apperr.BadRequest("parameter to harus berformat YYYY-MM-DD"))
			return
		}
		to = parsed
	}
	if from.After(to) {
		utils.HandleError(c, apperr.BadRequest("tanggal awal tidak boleh melebihi tanggal akhir"))
		return
	}
	data, err := h.Calendar.List(from, to, queryUint(c, "batch_id"), c.Query("event_type"), c.DefaultQuery("status", "all"))
	if err != nil {
		handleListError(c, "list calendar", err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) UpcomingEvents(c *gin.Context) {
	data, err := h.Calendar.Upcoming(7, 10)
	if err != nil {
		handleListError(c, "upcoming events", err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) GetEvent(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	data, err := h.Calendar.Get(id)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) CreateEvent(c *gin.Context) {
	var input services.EventInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Calendar.Create(actor(c), input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Created(c, data)
}

func (h *Handler) UpdateEvent(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	var input services.EventInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Calendar.Update(actor(c), id, input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) DeleteEvent(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	if err := h.Calendar.Delete(actor(c), id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.NoContent(c)
}
