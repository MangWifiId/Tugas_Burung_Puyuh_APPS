package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"manajemen-puyuh/backend/internal/config"
	"manajemen-puyuh/backend/internal/middleware"
	"manajemen-puyuh/backend/internal/models"
	"manajemen-puyuh/backend/internal/services"
	"manajemen-puyuh/backend/internal/utils"
)

type Handler struct {
	Cfg          *config.Config
	Auth         *services.AuthService
	Batches      *services.BatchService
	Adjust       *services.AdjustmentService
	Produce      *services.ProductionService
	Sales        *services.SalesService
	Feed         *services.FeedService
	Mortality    *services.MortalityService
	Calendar     *services.CalendarService
	Warnings     *services.WarningService
	Reports      *services.ReportService
	DashboardSvc *services.DashboardService
	Settings     *services.SettingService
	Activity     *services.ActivityService
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
