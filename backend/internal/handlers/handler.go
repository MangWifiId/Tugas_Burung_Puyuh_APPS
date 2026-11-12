package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/config"
	"manajemen-puyuh/backend/internal/mailer"
	"manajemen-puyuh/backend/internal/middleware"
	"manajemen-puyuh/backend/internal/models"
	"manajemen-puyuh/backend/internal/services"
	"manajemen-puyuh/backend/internal/tenancy"
	"manajemen-puyuh/backend/internal/utils"
)

type Handler struct {
	Cfg    *config.Config
	DB     *gorm.DB
	Auth   *services.AuthService
	Mailer *mailer.Mailer
}

// db mengembalikan koneksi yang sudah dikunci ke tenant user yang login.
// Service dibuat per request agar tidak ada state tenant yang bocor antar user.
func (h *Handler) db(c *gin.Context) *gorm.DB {
	return tenancy.WithTenant(h.DB, c.Request.Context(), middleware.TenantID(c))
}

func (h *Handler) Batches(c *gin.Context) *services.BatchService {
	return services.NewBatchService(h.db(c))
}
func (h *Handler) Adjust(c *gin.Context) *services.AdjustmentService {
	return services.NewAdjustmentService(h.db(c))
}
func (h *Handler) Produce(c *gin.Context) *services.ProductionService {
	return services.NewProductionService(h.db(c))
}
func (h *Handler) Sales(c *gin.Context) *services.SalesService {
	return services.NewSalesService(h.db(c))
}
func (h *Handler) Feed(c *gin.Context) *services.FeedService {
	return services.NewFeedService(h.db(c))
}
func (h *Handler) Mortality(c *gin.Context) *services.MortalityService {
	return services.NewMortalityService(h.db(c))
}
func (h *Handler) Calendar(c *gin.Context) *services.CalendarService {
	return services.NewCalendarService(h.db(c))
}
func (h *Handler) Warnings(c *gin.Context) *services.WarningService {
	return services.NewWarningService(h.db(c), h.Mailer)
}
func (h *Handler) Reports(c *gin.Context) *services.ReportService {
	return services.NewReportService(h.db(c))
}
func (h *Handler) DashboardSvc(c *gin.Context) *services.DashboardService {
	return services.NewDashboardService(h.db(c), h.Mailer)
}
func (h *Handler) Settings(c *gin.Context) *services.SettingService {
	return services.NewSettingService(h.db(c))
}
func (h *Handler) Activity(c *gin.Context) *services.ActivityService {
	return services.NewActivityService(h.db(c))
}

func actor(c *gin.Context) services.Actor {
	user := middleware.CurrentUser(c)
	if user == nil {
		return services.Actor{}
	}
	return services.Actor{ID: user.ID, Name: user.Name}
}

func currentUser(c *gin.Context) *models.User {
	return middleware.CurrentUser(c)
}

func rangeOr(c *gin.Context, days int) (models.Date, models.Date, bool) {
	from, to, err := utils.DateRange(c, days)
	if err != nil {
		utils.HandleError(c, err)
		return from, to, false
	}
	return from, to, true
}

func handleListError(c *gin.Context, context string, err error) {
	log.Printf("ERROR %s: %v", context, err)
	utils.Fail(c, http.StatusInternalServerError, "gagal memuat data", nil)
}
