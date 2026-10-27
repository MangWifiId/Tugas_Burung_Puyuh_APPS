package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"golang.org/x/crypto/bcrypt"

	"quail-management/backend/internal/config"
	"quail-management/backend/internal/database"
	"quail-management/backend/internal/handlers"
	"quail-management/backend/internal/models"
)

func setupTestDB(t *testing.T) *database.JSONDatabase {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := database.InitJSONDB(t.TempDir())
	if err != nil {
		t.Fatalf("InitJSONDB gagal: %v", err)
	}
	return db
}

func performJSONRequest(handler gin.HandlerFunc, method, target string, body any) *httptest.ResponseRecorder {
	payload, _ := json.Marshal(body)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, target, bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	handler(c)
	return w
}

func decimalStock(db *database.JSONDatabase, productID uuid.UUID) decimal.Decimal {
	stock := decimal.Zero
	for _, mov := range db.InventoryMovements {
		if mov.ProductID == productID {
			stock = stock.Add(mov.Quantity)
		}
	}
	return stock
}

func decimalFromInt(v int64) decimal.Decimal {
	return decimal.NewFromInt(v)
}

func TestAutoPostSalePersistsPostedStatusAndDoesNotDuplicateStock(t *testing.T) {
	db := setupTestDB(t)

	var customer models.Customer
	for _, c := range db.Customers {
		customer = c
		break
	}
	var eggProduct models.Product
	for _, p := range db.Products {
		if p.Category == "egg" {
			eggProduct = p
			break
		}
	}
	if customer.ID == uuid.Nil || eggProduct.ID == uuid.Nil {
		t.Fatal("data seed pelanggan/produk tidak ditemukan")
	}

	stockBefore := decimalStock(db, eggProduct.ID)
	invoiceBefore := len(db.CustomerInvoices)
	movementBefore := len(db.InventoryMovements)

	handler := handlers.NewSalesHandler()
	w := performJSONRequest(handler.CreateSale, http.MethodPost, "/api/v1/sales", map[string]any{
		"customer_id": customer.ID.String(),
		"sale_date":   time.Now().Format("2006-01-02"),
		"auto_post":   true,
		"items": []map[string]any{{
			"product_id": eggProduct.ID.String(),
			"unit_id":    eggProduct.DefaultUnitID.String(),
			"quantity":   5,
			"unit_price": 450,
		}},
	})

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	if len(db.Sales) != 1 {
		t.Fatalf("expected 1 sale, got %d", len(db.Sales))
	}
	if db.Sales[0].Status != "posted" {
		t.Fatalf("auto-post tidak tersimpan: status di database = %q", db.Sales[0].Status)
	}
	if len(db.CustomerInvoices) != invoiceBefore+1 {
		t.Fatalf("expected 1 invoice baru, got %d", len(db.CustomerInvoices)-invoiceBefore)
	}
	if len(db.InventoryMovements) != movementBefore+1 {
		t.Fatalf("expected 1 mutasi stok, got %d", len(db.InventoryMovements)-movementBefore)
	}
	if got := decimalStock(db, eggProduct.ID); !got.Equal(stockBefore.Sub(decimalFromInt(5))) {
		t.Fatalf("stok tidak berkurang tepat: before=%s after=%s", stockBefore, got)
	}

	// Mencoba posted ulang harus ditolak dan tidak menambah stok/faktur.
	invoiceAfterFirst := len(db.CustomerInvoices)
	stockAfterFirst := decimalStock(db, eggProduct.ID)

	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest(http.MethodPost, "/api/v1/sales/"+db.Sales[0].ID.String()+"/post", nil)
	c2.Params = gin.Params{{Key: "id", Value: db.Sales[0].ID.String()}}
	handler.PostSale(c2)

	if w2.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 saat post ulang, got %d: %s", w2.Code, w2.Body.String())
	}
	if len(db.CustomerInvoices) != invoiceAfterFirst {
		t.Fatal("faktur bertambah saat post ulang transaksi yang sudah posted")
	}
	if got := decimalStock(db, eggProduct.ID); !got.Equal(stockAfterFirst) {
		t.Fatalf("stok berubah saat post ulang: before=%s after=%s", stockAfterFirst, got)
	}
}

func TestLoginRejectsUnknownPasswordWithoutDeadlock(t *testing.T) {
	db := setupTestDB(t)

	var owner models.User
	for _, u := range db.Users {
		owner = u
		break
	}
	if owner.ID == uuid.Nil {
		t.Fatal("user seed tidak ditemukan")
	}

	authHandler := handlers.NewAuthHandler(&config.Config{
		JWTSecret:       "test-secret",
		JWTExpiresHours: 1,
	})

	done := make(chan int, 1)
	go func() {
		w := performJSONRequest(authHandler.Login, http.MethodPost, "/api/v1/auth/login", map[string]string{
			"email":    owner.Email,
			"password": "admin123",
		})
		done <- w.Code
	}()

	select {
	case code := <-done:
		if code != http.StatusUnauthorized {
			t.Fatalf("expected 401 untuk password salah, got %d", code)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("login menggantung (deadlock) saat password salah")
	}

	// Password yang benar tetap harus bisa login.
	w := performJSONRequest(authHandler.Login, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email":    owner.Email,
		"password": "password123",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 untuk password benar, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRegisterIsClosedWhenOwnerAlreadyExists(t *testing.T) {
	_ = setupTestDB(t)

	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	if hash == nil {
		t.Fatal("gagal membuat hash")
	}

	authHandler := handlers.NewAuthHandler(&config.Config{
		JWTSecret:         "test-secret",
		JWTExpiresHours:   1,
		AllowRegistration: false,
	})

	w := performJSONRequest(authHandler.Register, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"name":     "Penyusup",
		"email":    "penyusup@example.com",
		"password": "password123",
	})
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 saat registrasi publik tertutup, got %d: %s", w.Code, w.Body.String())
	}
}
