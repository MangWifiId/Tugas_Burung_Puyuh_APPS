package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"quail-management/backend/internal/database"
	"quail-management/backend/internal/handlers"
)

func TestPerformanceAnalytics(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Inisialisasi DB di direktori sementara
	tempDir := t.TempDir()
	_, err := database.InitJSONDB(tempDir)
	if err != nil {
		t.Fatalf("InitJSONDB failed: %v", err)
	}

	handler := handlers.NewAnalyticsHandler()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/api/v1/analytics/performance?start_date=&end_date=", nil)
	c.Request = req

	handler.GetPerformanceAnalytics(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var response struct {
		Success bool                                  `json:"success"`
		Message string                                `json:"message"`
		Data    handlers.PerformanceAnalyticsResponse `json:"data"`
	}

	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if !response.Success {
		t.Errorf("expected success true, got false")
	}

	if response.Data.Summary.ActivePopulation <= 0 {
		t.Errorf("expected ActivePopulation > 0, got %d", response.Data.Summary.ActivePopulation)
	}

	if response.Data.Summary.TotalEggsProduced <= 0 {
		t.Errorf("expected TotalEggsProduced > 0, got %d", response.Data.Summary.TotalEggsProduced)
	}

	if response.Data.Summary.HenDayPct <= 0.0 {
		t.Errorf("expected HenDayPct > 0, got %f", response.Data.Summary.HenDayPct)
	}

	if response.Data.Summary.FCRPer100Eggs <= 0.0 {
		t.Errorf("expected FCRPer100Eggs > 0, got %f", response.Data.Summary.FCRPer100Eggs)
	}

	if len(response.Data.DailyTrends) == 0 {
		t.Errorf("expected daily trends to not be empty")
	}

	if len(response.Data.CoopComparison) == 0 {
		t.Errorf("expected coop comparison to not be empty")
	}

	if len(response.Data.Insights) == 0 {
		t.Errorf("expected insights to not be empty")
	}
}
