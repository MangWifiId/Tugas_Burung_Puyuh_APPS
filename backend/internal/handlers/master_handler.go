package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"quail-management/backend/internal/database"
	"quail-management/backend/internal/models"
	"quail-management/backend/internal/response"
)

type MasterHandler struct{}

func NewMasterHandler() *MasterHandler {
	return &MasterHandler{}
}

// ----------------- UNITS -----------------

func (h *MasterHandler) ListUnits(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()
	response.JSON(c, http.StatusOK, "Daftar satuan", db.Units)
}

func (h *MasterHandler) CreateUnit(c *gin.Context) {
	var req struct {
		Code       string `json:"code" binding:"required"`
		Name       string `json:"name" binding:"required"`
		IsBaseUnit bool   `json:"is_base_unit"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data satuan tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	for _, u := range db.Units {
		if u.Code == req.Code {
			response.Conflict(c, "Kode satuan sudah digunakan")
			return
		}
	}

	now := time.Now().UTC()
	newUnit := models.Unit{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		Code:          req.Code,
		Name:          req.Name,
		IsBaseUnit:    req.IsBaseUnit,
	}
	db.Units = append(db.Units, newUnit)
	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Data gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Satuan berhasil dibuat", newUnit)
}

// ----------------- PRODUCTS -----------------

type ProductResponse struct {
	models.Product
	DefaultUnitName string          `json:"default_unit_name"`
	CurrentStock    decimal.Decimal `json:"current_stock"`
	LatestSellPrice decimal.Decimal `json:"latest_sell_price"`
}

func (h *MasterHandler) ListProducts(c *gin.Context) {
	category := c.Query("category")

	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	unitMap := make(map[uuid.UUID]string)
	for _, u := range db.Units {
		unitMap[u.ID] = u.Name + " (" + u.Code + ")"
	}

	// Calculate stock per product from inventory_movements (SINGLE SOURCE OF TRUTH)
	stockMap := make(map[uuid.UUID]decimal.Decimal)
	for _, mov := range db.InventoryMovements {
		cur := stockMap[mov.ProductID]
		stockMap[mov.ProductID] = cur.Add(mov.Quantity)
	}

	// Price map
	priceMap := make(map[uuid.UUID]decimal.Decimal)
	for _, p := range db.ProductPrices {
		if p.PriceType == "sell" && (p.ValidTo == nil || p.ValidTo.After(time.Now())) {
			priceMap[p.ProductID] = p.Price
		}
	}

	var results []ProductResponse
	for _, prod := range db.Products {
		if category != "" && prod.Category != category {
			continue
		}

		results = append(results, ProductResponse{
			Product:         prod,
			DefaultUnitName: unitMap[prod.DefaultUnitID],
			CurrentStock:    stockMap[prod.ID],
			LatestSellPrice: priceMap[prod.ID],
		})
	}

	response.JSON(c, http.StatusOK, "Daftar produk", results)
}

func (h *MasterHandler) CreateProduct(c *gin.Context) {
	var req struct {
		SKU           string          `json:"sku" binding:"required"`
		Name          string          `json:"name" binding:"required"`
		Category      string          `json:"category" binding:"required"`
		DefaultUnitID string          `json:"default_unit_id" binding:"required"`
		MinStockAlert decimal.Decimal `json:"min_stock_alert"`
		Description   string          `json:"description"`
		InitialPrice  decimal.Decimal `json:"initial_price"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data produk tidak lengkap")
		return
	}

	unitUUID, err := uuid.Parse(req.DefaultUnitID)
	if err != nil {
		response.BadRequest(c, "Satuan default tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	unitFound := false
	for _, u := range db.Units {
		if u.ID == unitUUID {
			unitFound = true
			break
		}
	}
	if !unitFound {
		response.NotFound(c, "Satuan default tidak ditemukan")
		return
	}
	if req.MinStockAlert.IsNegative() || req.InitialPrice.IsNegative() {
		response.BadRequest(c, "Stok minimum dan harga awal tidak boleh negatif")
		return
	}

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	for _, p := range db.Products {
		if p.SKU == req.SKU {
			response.Conflict(c, "SKU produk sudah digunakan")
			return
		}
	}

	now := time.Now().UTC()
	prodID := uuid.New()
	newProd := models.Product{
		BaseUUIDModel: models.BaseUUIDModel{ID: prodID, CreatedAt: now, UpdatedAt: now},
		FarmID:        farmID,
		SKU:           req.SKU,
		Name:          req.Name,
		Category:      req.Category,
		DefaultUnitID: unitUUID,
		MinStockAlert: req.MinStockAlert,
		IsActive:      true,
		Description:   req.Description,
	}
	db.Products = append(db.Products, newProd)

	if req.InitialPrice.GreaterThan(decimal.Zero) {
		db.ProductPrices = append(db.ProductPrices, models.ProductPrice{
			BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			ProductID:     prodID,
			UnitID:        unitUUID,
			PriceType:     "sell",
			Price:         req.InitialPrice,
			ValidFrom:     now,
			Notes:         "Harga awal saat pendaftaran produk",
		})
	}

	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Data gagal disimpan, silakan coba lagi")
		return
	}
	response.JSON(c, http.StatusCreated, "Produk berhasil ditambahkan", newProd)
}

// ----------------- CUSTOMERS & SUPPLIERS -----------------

type CustomerResponse struct {
	models.Customer
	TotalReceivables decimal.Decimal `json:"total_receivables"`
}

type SupplierResponse struct {
	models.Supplier
	TotalPayables decimal.Decimal `json:"total_payables"`
}

func (h *MasterHandler) ListCustomers(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	// Calculate receivables per customer
	recMap := make(map[uuid.UUID]decimal.Decimal)
	for _, inv := range db.CustomerInvoices {
		if inv.Status != "paid" && inv.Status != "cancelled" {
			unpaid := inv.TotalAmount.Sub(inv.PaidAmount)
			recMap[inv.CustomerID] = recMap[inv.CustomerID].Add(unpaid)
		}
	}

	var results []CustomerResponse
	for _, cust := range db.Customers {
		results = append(results, CustomerResponse{
			Customer:         cust,
			TotalReceivables: recMap[cust.ID],
		})
	}

	response.JSON(c, http.StatusOK, "Daftar pelanggan", results)
}

func (h *MasterHandler) CreateCustomer(c *gin.Context) {
	var req struct {
		Code             string `json:"code" binding:"required"`
		Name             string `json:"name" binding:"required"`
		Phone            string `json:"phone"`
		Email            string `json:"email"`
		Address          string `json:"address"`
		PaymentTermsDays int    `json:"payment_terms_days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data pelanggan tidak lengkap")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	for _, cust := range db.Customers {
		if cust.Code == req.Code {
			response.Conflict(c, "Kode pelanggan sudah digunakan")
			return
		}
	}

	now := time.Now().UTC()
	newCust := models.Customer{
		BaseUUIDModel:    models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FarmID:           farmID,
		Code:             req.Code,
		Name:             req.Name,
		Phone:            req.Phone,
		Email:            req.Email,
		Address:          req.Address,
		PaymentTermsDays: req.PaymentTermsDays,
		IsActive:         true,
	}
	db.Customers = append(db.Customers, newCust)
	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Data gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Pelanggan berhasil ditambahkan", newCust)
}

func (h *MasterHandler) ListSuppliers(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	payMap := make(map[uuid.UUID]decimal.Decimal)
	for _, bill := range db.SupplierBills {
		if bill.Status != "paid" && bill.Status != "cancelled" {
			unpaid := bill.TotalAmount.Sub(bill.PaidAmount)
			payMap[bill.SupplierID] = payMap[bill.SupplierID].Add(unpaid)
		}
	}

	var results []SupplierResponse
	for _, supp := range db.Suppliers {
		results = append(results, SupplierResponse{
			Supplier:      supp,
			TotalPayables: payMap[supp.ID],
		})
	}

	response.JSON(c, http.StatusOK, "Daftar pemasok", results)
}

func (h *MasterHandler) CreateSupplier(c *gin.Context) {
	var req struct {
		Code             string `json:"code" binding:"required"`
		Name             string `json:"name" binding:"required"`
		Phone            string `json:"phone"`
		Email            string `json:"email"`
		Address          string `json:"address"`
		PaymentTermsDays int    `json:"payment_terms_days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data pemasok tidak lengkap")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	for _, supp := range db.Suppliers {
		if supp.Code == req.Code {
			response.Conflict(c, "Kode pemasok sudah digunakan")
			return
		}
	}

	now := time.Now().UTC()
	newSupp := models.Supplier{
		BaseUUIDModel:    models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FarmID:           farmID,
		Code:             req.Code,
		Name:             req.Name,
		Phone:            req.Phone,
		Email:            req.Email,
		Address:          req.Address,
		PaymentTermsDays: req.PaymentTermsDays,
		IsActive:         true,
	}
	db.Suppliers = append(db.Suppliers, newSupp)
	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Data gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Pemasok berhasil ditambahkan", newSupp)
}
