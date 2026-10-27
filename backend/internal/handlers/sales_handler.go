package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"quail-management/backend/internal/database"
	"quail-management/backend/internal/models"
	"quail-management/backend/internal/response"
)

type SalesHandler struct{}

func NewSalesHandler() *SalesHandler {
	return &SalesHandler{}
}

type SaleDetailResponse struct {
	models.Sale
	CustomerName string           `json:"customer_name"`
	ItemsDetail  []SaleItemDetail `json:"items_detail"`
}

type SaleItemDetail struct {
	models.SaleItem
	ProductName string `json:"product_name"`
	UnitCode    string `json:"unit_code"`
}

func (h *SalesHandler) ListSales(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	custMap := make(map[uuid.UUID]string)
	for _, cust := range db.Customers {
		custMap[cust.ID] = cust.Name
	}
	prodMap := make(map[uuid.UUID]string)
	for _, p := range db.Products {
		prodMap[p.ID] = p.Name
	}
	unitMap := make(map[uuid.UUID]string)
	for _, u := range db.Units {
		unitMap[u.ID] = u.Code
	}

	var results []SaleDetailResponse
	for _, sale := range db.Sales {
		var items []SaleItemDetail
		for _, item := range sale.Items {
			items = append(items, SaleItemDetail{
				SaleItem:    item,
				ProductName: prodMap[item.ProductID],
				UnitCode:    unitMap[item.UnitID],
			})
		}
		results = append(results, SaleDetailResponse{
			Sale:         sale,
			CustomerName: custMap[sale.CustomerID],
			ItemsDetail:  items,
		})
	}

	response.JSON(c, http.StatusOK, "Daftar penjualan", results)
}

type CreateSaleRequest struct {
	CustomerID     string                  `json:"customer_id" binding:"required"`
	SaleDate       string                  `json:"sale_date" binding:"required"`
	DiscountAmount decimal.Decimal         `json:"discount_amount"`
	ShippingFee    decimal.Decimal         `json:"shipping_fee"`
	OtherFees      decimal.Decimal         `json:"other_fees"`
	Notes          string                  `json:"notes"`
	AutoPost       bool                    `json:"auto_post"` // If true, instantly posted
	Items          []CreateSaleItemRequest `json:"items" binding:"required,min=1"`
}

type CreateSaleItemRequest struct {
	ProductID      string          `json:"product_id" binding:"required"`
	UnitID         string          `json:"unit_id" binding:"required"`
	Quantity       decimal.Decimal `json:"quantity" binding:"required"`
	UnitPrice      decimal.Decimal `json:"unit_price" binding:"required"`
	DiscountAmount decimal.Decimal `json:"discount_amount"`
	Notes          string          `json:"notes"`
}

func (h *SalesHandler) CreateSale(c *gin.Context) {
	var req CreateSaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data transaksi penjualan tidak valid")
		return
	}

	saleDate, err := time.Parse("2006-01-02", req.SaleDate)
	if err != nil {
		response.BadRequest(c, "Format tanggal harus YYYY-MM-DD")
		return
	}

	custUUID, err := uuid.Parse(req.CustomerID)
	if err != nil {
		response.BadRequest(c, "ID pelanggan tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	if _, ok := findCustomer(db, custUUID); !ok {
		response.NotFound(c, "Pelanggan tidak ditemukan")
		return
	}

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	now := time.Now().UTC()
	saleID := uuid.New()
	saleNumber := fmt.Sprintf("SO-%s-%04d", time.Now().Format("20060102"), len(db.Sales)+1)

	subtotal := decimal.Zero
	var items []models.SaleItem

	for _, it := range req.Items {
		prodUUID, err := uuid.Parse(it.ProductID)
		if err != nil {
			response.BadRequest(c, "ID produk item tidak valid")
			return
		}
		unitUUID, err := uuid.Parse(it.UnitID)
		if err != nil {
			response.BadRequest(c, "ID satuan item tidak valid")
			return
		}

		product, ok := findProduct(db, prodUUID)
		if !ok {
			response.NotFound(c, "Produk pada item penjualan tidak ditemukan")
			return
		}
		if !it.Quantity.GreaterThan(decimal.Zero) {
			response.BadRequest(c, "Jumlah barang pada penjualan harus lebih besar dari 0")
			return
		}
		if it.UnitPrice.IsNegative() || it.DiscountAmount.IsNegative() {
			response.BadRequest(c, "Harga dan diskon tidak boleh bernilai negatif")
			return
		}
		if _, err := toBaseUnit(db, product, unitUUID, it.Quantity); err != nil {
			response.BadRequest(c, err.Error())
			return
		}

		lineSubtotal := it.Quantity.Mul(it.UnitPrice).Sub(it.DiscountAmount)
		if lineSubtotal.IsNegative() {
			lineSubtotal = decimal.Zero
		}
		subtotal = subtotal.Add(lineSubtotal)

		items = append(items, models.SaleItem{
			BaseUUIDModel:  models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			SaleID:         saleID,
			ProductID:      prodUUID,
			UnitID:         unitUUID,
			Quantity:       it.Quantity,
			UnitPrice:      it.UnitPrice, // Snapshot
			DiscountAmount: it.DiscountAmount,
			Subtotal:       lineSubtotal,
			Notes:          it.Notes,
		})
	}

	if req.DiscountAmount.IsNegative() || req.ShippingFee.IsNegative() || req.OtherFees.IsNegative() {
		response.BadRequest(c, "Diskon dan biaya tambahan tidak boleh bernilai negatif")
		return
	}

	grandTotal := subtotal.Sub(req.DiscountAmount).Add(req.ShippingFee).Add(req.OtherFees)
	if grandTotal.IsNegative() {
		grandTotal = decimal.Zero
	}

	newSale := models.Sale{
		BaseUUIDModel:  models.BaseUUIDModel{ID: saleID, CreatedAt: now, UpdatedAt: now},
		FarmID:         farmID,
		CustomerID:     custUUID,
		SaleNumber:     saleNumber,
		SaleDate:       saleDate,
		Status:         "draft",
		Subtotal:       subtotal,
		DiscountAmount: req.DiscountAmount,
		ShippingFee:    req.ShippingFee,
		OtherFees:      req.OtherFees,
		GrandTotal:     grandTotal,
		Notes:          req.Notes,
		Items:          items,
	}

	db.Sales = append(db.Sales, newSale)
	saleIdx := len(db.Sales) - 1

	// Jika AutoPost dipilih (Alur Fleksibel Langsung)
	if req.AutoPost {
		if err := executePostSale(db, &db.Sales[saleIdx], farmID, now); err != nil {
			// Tidak ada mutasi stok yang terjadi jika validasi gagal; buang draft.
			db.Sales = append(db.Sales[:saleIdx], db.Sales[saleIdx+1:]...)
			response.Unprocessable(c, err.Error())
			return
		}
	}

	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Transaksi gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Transaksi penjualan berhasil disimpan", db.Sales[saleIdx])
}

func (h *SalesHandler) PostSale(c *gin.Context) {
	saleIDStr := c.Param("id")
	saleID, err := uuid.Parse(saleIDStr)
	if err != nil {
		response.BadRequest(c, "ID penjualan tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	saleIdx := -1
	for i, s := range db.Sales {
		if s.ID == saleID {
			saleIdx = i
			break
		}
	}
	if saleIdx == -1 {
		response.NotFound(c, "Penjualan tidak ditemukan")
		return
	}

	if db.Sales[saleIdx].Status == "posted" {
		response.BadRequest(c, "Transaksi ini sudah disahkan (posted)")
		return
	}

	now := time.Now().UTC()
	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	if err := executePostSale(db, &db.Sales[saleIdx], farmID, now); err != nil {
		response.Unprocessable(c, err.Error())
		return
	}

	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Penjualan gagal disahkan karena masalah penyimpanan")
		return
	}
	response.JSON(c, http.StatusOK, "Penjualan berhasil disahkan (stok berkurang dan faktur tagihan terbit)", db.Sales[saleIdx])
}

func executePostSale(db *database.JSONDatabase, sale *models.Sale, farmID uuid.UUID, now time.Time) error {
	// 1. Konversi seluruh item ke satuan dasar produk lalu agregasi permintaan
	//    per produk. Ini mencegah dua baris produk yang sama lolos cek stok.
	type convertedItem struct {
		item    models.SaleItem
		baseQty decimal.Decimal
		cost    decimal.Decimal
	}

	converted := make([]convertedItem, 0, len(sale.Items))
	demand := make(map[uuid.UUID]decimal.Decimal)

	for _, item := range sale.Items {
		product, ok := findProduct(db, item.ProductID)
		if !ok {
			return fmt.Errorf("produk pada transaksi penjualan tidak ditemukan")
		}
		if !item.Quantity.GreaterThan(decimal.Zero) {
			return fmt.Errorf("jumlah barang pada penjualan harus lebih besar dari 0")
		}

		baseQty, err := toBaseUnit(db, product, item.UnitID, item.Quantity)
		if err != nil {
			return err
		}

		demand[item.ProductID] = demand[item.ProductID].Add(baseQty)
		converted = append(converted, convertedItem{
			item:    item,
			baseQty: baseQty,
			cost:    averageUnitCost(db, item.ProductID),
		})
	}

	for productID, required := range demand {
		available := currentStock(db, productID)
		if available.LessThan(required) {
			product, _ := findProduct(db, productID)
			name := "produk"
			if product != nil {
				name = product.Name
			}
			return fmt.Errorf("stok %s tidak mencukupi (tersedia: %s, diminta: %s)", name, available.String(), required.String())
		}
	}

	// 2. Sahkan status
	sale.Status = "posted"
	sale.UpdatedAt = now

	// 3. Single Source of Truth: pengurangan stok dalam satuan default produk
	for _, c := range converted {
		product, _ := findProduct(db, c.item.ProductID)
		baseUnitID := c.item.UnitID
		if product != nil {
			baseUnitID = product.DefaultUnitID
		}

		db.InventoryMovements = append(db.InventoryMovements, models.InventoryMovement{
			BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			FarmID:        farmID,
			ProductID:     c.item.ProductID,
			UnitID:        baseUnitID,
			MovementDate:  sale.SaleDate,
			MovementType:  "sales_out",
			Quantity:      c.baseQty.Neg(),
			UnitCost:      c.cost,
			ReferenceType: "sales",
			ReferenceID:   sale.ID,
			Notes:         fmt.Sprintf("Penjualan no. %s", sale.SaleNumber),
		})
	}

	// 4. Buat Faktur Tagihan Pelanggan (Customer Invoice)
	invNumber := fmt.Sprintf("INV-%s-%04d", time.Now().Format("20060102"), len(db.CustomerInvoices)+1)
	dueDate := sale.SaleDate.AddDate(0, 0, 7) // default 7 hari

	// Cek payment_terms_days dari customer
	for _, cust := range db.Customers {
		if cust.ID == sale.CustomerID && cust.PaymentTermsDays > 0 {
			dueDate = sale.SaleDate.AddDate(0, 0, cust.PaymentTermsDays)
			break
		}
	}

	newInvoice := models.CustomerInvoice{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FarmID:        farmID,
		SaleID:        sale.ID,
		CustomerID:    sale.CustomerID,
		InvoiceNumber: invNumber,
		InvoiceDate:   sale.SaleDate,
		DueDate:       dueDate,
		TotalAmount:   sale.GrandTotal,
		PaidAmount:    decimal.Zero,
		Status:        "unpaid",
	}
	db.CustomerInvoices = append(db.CustomerInvoices, newInvoice)

	return nil
}
