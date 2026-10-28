package handlers

import (
	"github.com/gin-gonic/gin"

	"manajemen-puyuh/backend/internal/services"
	"manajemen-puyuh/backend/internal/utils"
)

func (h *Handler) ListFeed(c *gin.Context) {
	from, to, ok := rangeOr(c, 30)
	if !ok {
		return
	}
	page, limit, _ := utils.Pagination(c)
	data, total, err := h.Feed.List(services.FeedFilter{
		From: from, To: to, FeedType: c.Query("feed_type"), Page: page, Limit: limit,
	})
	if err != nil {
		handleListError(c, "list feed", err)
		return
	}
	utils.Paginated(c, data, utils.BuildMeta(page, limit, total))
}

func (h *Handler) CreateFeed(c *gin.Context) {
	var input services.FeedInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Feed.Create(actor(c), input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Created(c, data)
}

func (h *Handler) UpdateFeed(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	var input services.FeedInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Feed.Update(actor(c), id, input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) DeleteFeed(c *gin.Context) {
	id, err := utils.ParseID(c)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	if err := h.Feed.Delete(actor(c), id); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.NoContent(c)
}

func (h *Handler) ListFeedPrices(c *gin.Context) {
	from, to, ok := rangeOr(c, 365)
	if !ok {
		return
	}
	data, err := h.Feed.PriceHistory(c.Query("feed_type"), from, to)
	if err != nil {
		handleListError(c, "list feed prices", err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) AddFeedPrice(c *gin.Context) {
	var input services.FeedPriceInput
	if !utils.BindJSON(c, &input) {
		return
	}
	data, err := h.Feed.AddPrice(actor(c), input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.Created(c, data)
}

func (h *Handler) LatestFeedPrice(c *gin.Context) {
	data, err := h.Feed.LatestPrice(c.DefaultQuery("feed_type", "layer"))
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}

func (h *Handler) FeedSummary(c *gin.Context) {
	from, to, ok := rangeOr(c, 30)
	if !ok {
		return
	}
	data, err := h.Feed.Summary(from, to)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, data)
}
