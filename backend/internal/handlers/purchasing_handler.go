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

type PurchasingHandler struct{}

func NewPurchasingHandler() *PurchasingHandler {
	return &PurchasingHandler{}
}

type PurchaseDetailResponse struct {
	models.Purchase
	SupplierName string               `json:"supplier_name"`
	ItemsDetail  []PurchaseItemDetail `json:"items_detail"`
}

type PurchaseItemDetail struct {
	models.PurchaseItem
	ProductName string `json:"product_name"`
	UnitCode    string `json:"unit_code"`
}

func (h *PurchasingHandler) ListPurchases(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	suppMap := make(map[uuid.UUID]string)
	for _, supp := range db.Suppliers {
		suppMap[supp.ID] = supp.Name
	}
	prodMap := make(map[uuid.UUID]string)
	for _, p := range db.Products {
		prodMap[p.ID] = p.Name
	}
	unitMap := make(map[uuid.UUID]string)
	for _, u := range db.Units {
		unitMap[u.ID] = u.Code
	}

	var results []PurchaseDetailResponse
	for _, pur := range db.Purchases {
		var items []PurchaseItemDetail
		for _, item := range pur.Items {
			items = append(items, PurchaseItemDetail{
				PurchaseItem: item,
				ProductName:  prodMap[item.ProductID],
				UnitCode:     unitMap[item.UnitID],
			})
		}
		results = append(results, PurchaseDetailResponse{
			Purchase:     pur,
			SupplierName: suppMap[pur.SupplierID],
			ItemsDetail:  items,
		})
	}

	response.JSON(c, http.StatusOK, "Daftar pembelian", results)
}

type CreatePurchaseRequest struct {
	SupplierID     string                     `json:"supplier_id" binding:"required"`
	PurchaseDate   string                     `json:"purchase_date" binding:"required"`
	DiscountAmount decimal.Decimal            `json:"discount_amount"`
	ShippingFee    decimal.Decimal            `json:"shipping_fee"`
	OtherFees      decimal.Decimal            `json:"other_fees"`
	Notes          string                     `json:"notes"`
	AutoPost       bool                       `json:"auto_post"`
	Items          []CreatePurchaseItemRequest `json:"items" binding:"required,min=1"`
}

type CreatePurchaseItemRequest struct {
	ProductID      string          `json:"product_id" binding:"required"`
	UnitID         string          `json:"unit_id" binding:"required"`
	Quantity       decimal.Decimal `json:"quantity" binding:"required"`
	UnitPrice      decimal.Decimal `json:"unit_price" binding:"required"`
	DiscountAmount decimal.Decimal `json:"discount_amount"`
	Notes          string          `json:"notes"`
}

func (h *PurchasingHandler) CreatePurchase(c *gin.Context) {
	var req CreatePurchaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data transaksi pembelian tidak valid")
		return
	}

	purDate, err := time.Parse("2006-01-02", req.PurchaseDate)
	if err != nil {
		response.BadRequest(c, "Format tanggal harus YYYY-MM-DD")
		return
	}

	suppUUID, err := uuid.Parse(req.SupplierID)
	if err != nil {
		response.BadRequest(c, "ID pemasok tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	now := time.Now().UTC()
	purID := uuid.New()
	purNumber := fmt.Sprintf("PO-%s-%04d", time.Now().Format("20060102"), len(db.Purchases)+1)

	subtotal := decimal.Zero
	var items []models.PurchaseItem

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

		lineSubtotal := it.Quantity.Mul(it.UnitPrice).Sub(it.DiscountAmount)
		if lineSubtotal.IsNegative() {
			lineSubtotal = decimal.Zero
		}
		subtotal = subtotal.Add(lineSubtotal)

		items = append(items, models.PurchaseItem{
			BaseUUIDModel:  models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			PurchaseID:     purID,
			ProductID:      prodUUID,
			UnitID:         unitUUID,
			Quantity:       it.Quantity,
			UnitPrice:      it.UnitPrice, // Snapshot
			DiscountAmount: it.DiscountAmount,
			Subtotal:       lineSubtotal,
			Notes:          it.Notes,
		})
	}

	grandTotal := subtotal.Sub(req.DiscountAmount).Add(req.ShippingFee).Add(req.OtherFees)
	if grandTotal.IsNegative() {
		grandTotal = decimal.Zero
	}

	newPurchase := models.Purchase{
		BaseUUIDModel:  models.BaseUUIDModel{ID: purID, CreatedAt: now, UpdatedAt: now},
		FarmID:         farmID,
		SupplierID:     suppUUID,
		PurchaseNumber: purNumber,
		PurchaseDate:   purDate,
		Status:         "draft",
		Subtotal:       subtotal,
		DiscountAmount: req.DiscountAmount,
		ShippingFee:    req.ShippingFee,
		OtherFees:      req.OtherFees,
		GrandTotal:     grandTotal,
		Notes:          req.Notes,
		Items:          items,
	}
	db.Purchases = append(db.Purchases, newPurchase)

	if req.AutoPost {
		executePostPurchase(db, &newPurchase, farmID, now)
	}

	_ = db.Persist()

	response.JSON(c, http.StatusCreated, "Transaksi pembelian berhasil disimpan", newPurchase)
}

func (h *PurchasingHandler) PostPurchase(c *gin.Context) {
	purIDStr := c.Param("id")
	purID, err := uuid.Parse(purIDStr)
	if err != nil {
		response.BadRequest(c, "ID pembelian tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	purIdx := -1
	for i, p := range db.Purchases {
		if p.ID == purID {
			purIdx = i
			break
		}
	}
	if purIdx == -1 {
		response.NotFound(c, "Pembelian tidak ditemukan")
		return
	}

	if db.Purchases[purIdx].Status == "posted" {
		response.BadRequest(c, "Transaksi pembelian ini sudah disahkan (posted)")
		return
	}

	now := time.Now().UTC()
	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	executePostPurchase(db, &db.Purchases[purIdx], farmID, now)
	_ = db.Persist()

	response.JSON(c, http.StatusOK, "Pembelian berhasil disahkan (stok bertambah dan tagihan pemasok terbit)", db.Purchases[purIdx])
}

func executePostPurchase(db *database.JSONDatabase, purchase *models.Purchase, farmID uuid.UUID, now time.Time) {
	purchase.Status = "posted"
	purchase.UpdatedAt = now

	// 1. Single Source of Truth: Menambah stok di inventory_movements
	for _, item := range purchase.Items {
		db.InventoryMovements = append(db.InventoryMovements, models.InventoryMovement{
			BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			FarmID:        farmID,
			ProductID:     item.ProductID,
			UnitID:        item.UnitID,
			MovementDate:  purchase.PurchaseDate,
			MovementType:  "purchase_in",
			Quantity:      item.Quantity, // Nilai positif untuk penerimaan stok
			UnitCost:      item.UnitPrice,
			ReferenceType: "purchases",
			ReferenceID:   purchase.ID,
			Notes:         fmt.Sprintf("Penerimaan barang dari PO %s", purchase.PurchaseNumber),
		})
	}

	// 2. Terbitkan Tagihan Pemasok (Supplier Bill)
	billNumber := fmt.Sprintf("BILL-%s-%04d", time.Now().Format("20060102"), len(db.SupplierBills)+1)
	dueDate := purchase.PurchaseDate.AddDate(0, 0, 14) // default 14 hari

	for _, supp := range db.Suppliers {
		if supp.ID == purchase.SupplierID && supp.PaymentTermsDays > 0 {
			dueDate = purchase.PurchaseDate.AddDate(0, 0, supp.PaymentTermsDays)
			break
		}
	}

	newBill := models.SupplierBill{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FarmID:        farmID,
		PurchaseID:    purchase.ID,
		SupplierID:    purchase.SupplierID,
		BillNumber:    billNumber,
		BillDate:      purchase.PurchaseDate,
		DueDate:       dueDate,
		TotalAmount:   purchase.GrandTotal,
		PaidAmount:    decimal.Zero,
		Status:        "unpaid",
	}
	db.SupplierBills = append(db.SupplierBills, newBill)
}
