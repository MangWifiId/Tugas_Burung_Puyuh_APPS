package database

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"golang.org/x/crypto/bcrypt"

	"quail-management/backend/internal/models"
)

type JSONDatabase struct {
	mu       sync.RWMutex
	filePath string

	Users                  []models.User                      `json:"users"`
	Farms                  []models.Farm                      `json:"farms"`
	Coops                  []models.Coop                      `json:"coops"`
	Units                  []models.Unit                      `json:"units"`
	Products               []models.Product                   `json:"products"`
	Conversions            []models.ProductUnitConversion     `json:"conversions"`
	Customers              []models.Customer                  `json:"customers"`
	Suppliers              []models.Supplier                  `json:"suppliers"`
	Flocks                 []models.Flock                     `json:"flocks"`
	FlockPlacements        []models.FlockPlacement            `json:"flock_placements"`
	FlockMovements         []models.FlockMovement             `json:"flock_movements"`
	ProductionRecords      []models.ProductionRecord          `json:"production_records"`
	InventoryMovements     []models.InventoryMovement         `json:"inventory_movements"`
	FeedUsages             []models.FeedUsage                 `json:"feed_usages"`
	ProductPrices          []models.ProductPrice              `json:"product_prices"`
	Sales                  []models.Sale                      `json:"sales"`
	Purchases              []models.Purchase                  `json:"purchases"`
	CustomerInvoices       []models.CustomerInvoice           `json:"customer_invoices"`
	CustomerPayments       []models.CustomerPayment           `json:"customer_payments"`
	CustomerAllocations    []models.CustomerPaymentAllocation `json:"customer_allocations"`
	SupplierBills          []models.SupplierBill              `json:"supplier_bills"`
	SupplierPayments       []models.SupplierPayment           `json:"supplier_payments"`
	SupplierAllocations    []models.SupplierPaymentAllocation `json:"supplier_allocations"`
	CashAccounts           []models.CashAccount               `json:"cash_accounts"`
	Expenses               []models.Expense                   `json:"expenses"`
	CashTransactions       []models.CashTransaction           `json:"cash_transactions"`
	StockAdjustments       []models.StockAdjustment           `json:"stock_adjustments"`
	AuditLogs              []models.AuditLog                  `json:"audit_logs"`
}

var DBInstance *JSONDatabase

func InitJSONDB(dataDir string) (*JSONDatabase, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("gagal membuat direktori data: %w", err)
	}

	filePath := filepath.Join(dataDir, "database.json")
	jdb := &JSONDatabase{
		filePath: filePath,
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		log.Println("database.json belum ada, melakukan inisialisasi awal...")
		jdb.seedDefaults()
		if err := jdb.persist(); err != nil {
			return nil, fmt.Errorf("gagal menyimpan database.json awal: %w", err)
		}
	} else {
		data, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("gagal membaca database.json: %w", err)
		}
		if err := json.Unmarshal(data, jdb); err != nil {
			return nil, fmt.Errorf("gagal membedah database.json: %w", err)
		}
	}

	DBInstance = jdb
	log.Println("✓ Berhasil memuat JSON File Database:", filePath)
	return jdb, nil
}

func (db *JSONDatabase) Lock() {
	db.mu.Lock()
}

func (db *JSONDatabase) Unlock() {
	db.mu.Unlock()
}

func (db *JSONDatabase) RLock() {
	db.mu.RLock()
}

func (db *JSONDatabase) RUnlock() {
	db.mu.RUnlock()
}

// Persist writes data safely to file (caller must hold lock)
func (db *JSONDatabase) Persist() error {
	return db.persist()
}

func (db *JSONDatabase) persist() error {
	data, err := json.MarshalIndent(db, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(db.filePath, data, 0644)
}

func (db *JSONDatabase) seedDefaults() {
	now := time.Now().UTC()

	// 1. Default Farm
	farmID := uuid.New()
	farm := models.Farm{
		BaseUUIDModel: models.BaseUUIDModel{ID: farmID, CreatedAt: now, UpdatedAt: now},
		Code:          "FARM01",
		Name:          "Peternakan Puyuh Barokah",
		Address:       "Jl. Peternakan Mandiri No. 12, Jawa Barat",
		Phone:         "081234567890",
		IsActive:      true,
	}
	db.Farms = append(db.Farms, farm)

	// 2. Default Owner User (owner@puyuh.com / password123)
	passHash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	owner := models.User{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		Name:          "Pemilik Peternakan",
		Email:         "owner@puyuh.com",
		PasswordHash:  string(passHash),
		Role:          "owner",
		IsActive:      true,
	}
	db.Users = append(db.Users, owner)

	// 3. Default Units
	btrID := uuid.New()
	rakID := uuid.New()
	kgID := uuid.New()
	krgID := uuid.New()
	btlID := uuid.New()
	ltrID := uuid.New()
	ekrID := uuid.New()

	units := []models.Unit{
		{BaseUUIDModel: models.BaseUUIDModel{ID: btrID, CreatedAt: now, UpdatedAt: now}, Code: "BTR", Name: "Butir", IsBaseUnit: true},
		{BaseUUIDModel: models.BaseUUIDModel{ID: rakID, CreatedAt: now, UpdatedAt: now}, Code: "RAK", Name: "Rak / Tray (30 butir)", IsBaseUnit: false},
		{BaseUUIDModel: models.BaseUUIDModel{ID: kgID, CreatedAt: now, UpdatedAt: now}, Code: "KG", Name: "Kilogram", IsBaseUnit: true},
		{BaseUUIDModel: models.BaseUUIDModel{ID: krgID, CreatedAt: now, UpdatedAt: now}, Code: "KRG", Name: "Karung (50 kg)", IsBaseUnit: false},
		{BaseUUIDModel: models.BaseUUIDModel{ID: btlID, CreatedAt: now, UpdatedAt: now}, Code: "BTL", Name: "Botol", IsBaseUnit: true},
		{BaseUUIDModel: models.BaseUUIDModel{ID: ltrID, CreatedAt: now, UpdatedAt: now}, Code: "LTR", Name: "Liter", IsBaseUnit: true},
		{BaseUUIDModel: models.BaseUUIDModel{ID: ekrID, CreatedAt: now, UpdatedAt: now}, Code: "EKR", Name: "Ekor", IsBaseUnit: true},
	}
	db.Units = append(db.Units, units...)

	// 4. Default Coops (Kandang)
	coops := []models.Coop{
		{
			BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			FarmID:        farmID,
			Code:          "KND-01",
			Name:          "Kandang A1 (Layer)",
			Capacity:      1500,
			Status:        "active",
			Notes:         "Kandang utama puyuh petelur masa produksi",
		},
		{
			BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			FarmID:        farmID,
			Code:          "KND-02",
			Name:          "Kandang A2 (Grower)",
			Capacity:      1200,
			Status:        "active",
			Notes:         "Kandang pembesaran",
		},
	}
	db.Coops = append(db.Coops, coops...)

	// 5. Default Products (Telur, Pakan, Vitamin)
	eggProdID := uuid.New()
	feedProdID := uuid.New()
	products := []models.Product{
		{
			BaseUUIDModel: models.BaseUUIDModel{ID: eggProdID, CreatedAt: now, UpdatedAt: now},
			FarmID:        farmID,
			SKU:           "TLR-01",
			Name:          "Telur Puyuh Segar Layak Jual",
			Category:      "egg",
			DefaultUnitID: btrID,
			MinStockAlert: decimal.NewFromInt(300),
			IsActive:      true,
			Description:   "Telur puyuh segar panen harian siap distribusi",
		},
		{
			BaseUUIDModel: models.BaseUUIDModel{ID: feedProdID, CreatedAt: now, UpdatedAt: now},
			FarmID:        farmID,
			SKU:           "PKN-01",
			Name:          "Pakan Puyuh Petelur Super (Layer Feed)",
			Category:      "feed",
			DefaultUnitID: kgID,
			MinStockAlert: decimal.NewFromInt(100),
			IsActive:      true,
			Description:   "Pakan konsentrat puyuh petelur kadar protein 20%",
		},
	}
	db.Products = append(db.Products, products...)

	// Unit conversion: 1 RAK = 30 BTR
	db.Conversions = append(db.Conversions, models.ProductUnitConversion{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		ProductID:     eggProdID,
		FromUnitID:    rakID,
		ToUnitID:      btrID,
		Multiplier:    decimal.NewFromInt(30),
	})

	// 6. Default Cash Account
	db.CashAccounts = append(db.CashAccounts, models.CashAccount{
		BaseUUIDModel:  models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FarmID:         farmID,
		Name:           "Kas Utama Kandang",
		AccountType:    "cash",
		InitialBalance: decimal.NewFromInt(5000000),
		CurrentBalance: decimal.NewFromInt(5000000),
		IsActive:       true,
	})

	// 7. Default Customer & Supplier
	db.Customers = append(db.Customers, models.Customer{
		BaseUUIDModel:    models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FarmID:           farmID,
		Code:             "CUST-01",
		Name:             "Toko Berkah Telur (Pak Haji Joko)",
		Phone:            "081399887766",
		Email:            "berkah.telur@gmail.com",
		Address:          "Pasar Induk Kramat Jati, Kios B-12",
		PaymentTermsDays: 7,
		IsActive:         true,
	})

	db.Suppliers = append(db.Suppliers, models.Supplier{
		BaseUUIDModel:    models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FarmID:           farmID,
		Code:             "SUPP-01",
		Name:             "PT Pakan Ternak Nusantara",
		Phone:            "081122334455",
		Email:            "sales@pakannusantara.co.id",
		Address:          "Kawasan Industri Jababeka, Cikarang",
		PaymentTermsDays: 14,
		IsActive:         true,
	})
}
