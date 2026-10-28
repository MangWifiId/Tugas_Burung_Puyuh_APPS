package routes

import (
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"manajemen-puyuh/backend/internal/handlers"
	"manajemen-puyuh/backend/internal/middleware"
)

func New(h *handlers.Handler) *gin.Engine {
	if h.Cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cleanOrigins(h.Cfg.AllowedOrigins),
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	router.GET("/health", h.Health)

	api := router.Group("/api/v1")
	api.POST("/auth/login", h.Login)
	api.POST("/auth/register", h.Register)

	auth := api.Group("")
	auth.Use(middleware.Auth(h.Cfg.JWTSecret, h.Auth))
	{
		auth.GET("/auth/me", h.Me)
		auth.POST("/auth/logout", h.Logout)
		auth.PUT("/auth/password", h.ChangePassword)
		auth.PUT("/auth/profile", h.UpdateProfile)

		auth.GET("/dashboard", h.Dashboard)
		auth.GET("/reports", h.Report)

		auth.GET("/batches", h.ListBatches)
		auth.POST("/batches", h.CreateBatch)
		auth.GET("/batches/:id", h.GetBatch)
		auth.PUT("/batches/:id", h.UpdateBatch)
		auth.DELETE("/batches/:id", h.DeleteBatch)
		auth.GET("/batches/:id/history", h.BatchHistory)

		auth.GET("/population-adjustments", h.ListAdjustments)
		auth.POST("/population-adjustments", h.CreateAdjustment)
		auth.PUT("/population-adjustments/:id", h.UpdateAdjustment)
		auth.DELETE("/population-adjustments/:id", h.DeleteAdjustment)

		auth.GET("/productions/summary", h.ProductionSummary)
		auth.GET("/productions", h.ListProductions)
		auth.POST("/productions", h.CreateProduction)
		auth.PUT("/productions/:id", h.UpdateProduction)
		auth.DELETE("/productions/:id", h.DeleteProduction)

		auth.GET("/pickups/linkable", h.LinkablePickups)
		auth.GET("/pickups", h.ListPickups)
		auth.POST("/pickups", h.CreatePickup)
		auth.PUT("/pickups/:id", h.UpdatePickup)
		auth.DELETE("/pickups/:id", h.DeletePickup)

		auth.GET("/sales-notes", h.ListNotes)
		auth.POST("/sales-notes", h.CreateNote)
		auth.GET("/sales-notes/:id", h.GetNote)
		auth.PUT("/sales-notes/:id", h.UpdateNote)
		auth.DELETE("/sales-notes/:id", h.DeleteNote)
		auth.GET("/sales/summary", h.SalesSummary)

		auth.GET("/feed-receipts", h.ListFeed)
		auth.POST("/feed-receipts", h.CreateFeed)
		auth.PUT("/feed-receipts/:id", h.UpdateFeed)
		auth.DELETE("/feed-receipts/:id", h.DeleteFeed)

		auth.GET("/feed-prices/latest", h.LatestFeedPrice)
		auth.GET("/feed-prices", h.ListFeedPrices)
		auth.POST("/feed-prices", h.AddFeedPrice)
		auth.GET("/feed/summary", h.FeedSummary)

		auth.GET("/mortality/summary", h.MortalitySummary)
		auth.GET("/mortality", h.ListMortality)
		auth.POST("/mortality", h.CreateMortality)
		auth.PUT("/mortality/:id", h.UpdateMortality)
		auth.DELETE("/mortality/:id", h.DeleteMortality)

		auth.GET("/events/upcoming", h.UpcomingEvents)
		auth.GET("/events", h.ListCalendar)
		auth.POST("/events", h.CreateEvent)
		auth.GET("/events/:id", h.GetEvent)
		auth.PUT("/events/:id", h.UpdateEvent)
		auth.DELETE("/events/:id", h.DeleteEvent)

		auth.GET("/warnings/counts", h.WarningCounts)
		auth.POST("/warnings/generate", h.GenerateWarnings)
		auth.GET("/warnings", h.ListWarnings)
		auth.POST("/warnings/:id/acknowledge", h.AcknowledgeWarning)
		auth.GET("/warning-rules", h.ListWarningRules)
		auth.PUT("/warning-rules/:id", h.UpdateWarningRule)

		auth.GET("/settings", h.ListSettings)
		auth.PUT("/settings", h.UpdateSettings)
		auth.GET("/activities", h.ListActivities)
	}

	return router
}

func cleanOrigins(origins []string) []string {
	result := make([]string, 0, len(origins))
	for _, origin := range origins {
		if trimmed := strings.TrimSpace(origin); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return []string{"http://localhost:5173"}
	}
	return result
}
