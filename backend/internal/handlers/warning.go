package handlers

import (
	"time"

	"github.com/gin-gonic/gin"

	"manajemen-puyuh/backend/internal/models"
	"manajemen-puyuh/backend/internal/services"
	"manajemen-puyuh/backend/internal/utils"
)

func (h *Handler) ListWarnings(c *gin.Context) {
	from, to, ok := rangeOr(c, 30)
	if !ok {
		return
	}
	if c.Query("generate") == "true" {
		if _, err := h.Warnings.GenerateFor(models.DateToday()); err != nil {
			handleListError(c, "generate warnings", err)
			return
		}
	}
	page, limit, _ := utils.Pagination(c)
	data, total, err := h.Warnings.List(services.WarningFilter{
		From: from, To: to, Status: c.DefaultQuery("status", "all"),
		Category: c.Query("category"), Level: c.Query("level"),
		Page: page, Limit: limit,
	})
	if err != nil {
		handleListError(c, "list warnings", err)
		return
	}
	utils.Paginated(c, data, utils.BuildMeta(page, limit, total))
}

type generateWarningInput struct {
	Date *models.Date `json:"date"`
}

func (h *Handler) GenerateWarnings(c *gin.Context) {
	date := models.DateToday()
	if c.Request.ContentLength > 0 {
		var input generateWarningInput
		if !utils.BindJSON(c, &input) {
			return
		}
		if input.Date != nil && !input.Date.IsZero() {
			date = *input.Date
		}
	}
	events, err := h.Warnings.GenerateFor(date)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, gin.H{"date": date, "generated": len(events), "events": events})
}

func (h *Handler) AcknowledgeWarning(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	data, err := h.Warnings.Acknowledge(actor(c), id)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) ListWarningRules(c *gin.Context) {
	data, err := h.Warnings.Rules()
	if err != nil {
		handleListError(c, "list warning rules", err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) UpdateWarningRule(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	var input services.WarningRuleInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Warnings.UpdateRule(actor(c), id, input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) Dashboard(c *gin.Context) {
	from, to, ok := rangeOr(c, 30)
	if !ok {
		return
	}
	groupBy, err := services.ParseGroupBy(c.DefaultQuery("group_by", "day"))
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	data, err := h.DashboardSvc.Load(from, to, groupBy)
	if err != nil {
		handleListError(c, "dashboard", err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) Report(c *gin.Context) {
	today := models.DateToday()
	from, to := today.StartOfMonth(), today
	if c.Query("from") != "" || c.Query("to") != "" {
		var ok bool
		from, to, ok = rangeOr(c, 30)
		if !ok {
			return
		}
	}
	groupBy, err := services.ParseGroupBy(c.DefaultQuery("group_by", "day"))
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	data, err := h.Reports.Overview(from, to, groupBy)
	if err != nil {
		handleListError(c, "report", err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) ListActivities(c *gin.Context) {
	page, limit, _ := utils.Pagination(c)
	data, total, err := h.Activity.List(page, limit)
	if err != nil {
		handleListError(c, "list activities", err)
		return
	}
	utils.Paginated(c, data, utils.BuildMeta(page, limit, total))
}

type settingsInput struct {
	Settings map[string]string `json:"settings"`
}

func (h *Handler) ListSettings(c *gin.Context) {
	data, err := h.Settings.List()
	if err != nil {
		handleListError(c, "list settings", err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) UpdateSettings(c *gin.Context) {
	var input settingsInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Settings.Update(actor(c), input.Settings)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) WarningCounts(c *gin.Context) {
	open, critical, err := h.Warnings.CountOpen()
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, gin.H{"open": open, "critical": critical, "checked_at": time.Now()})
}
