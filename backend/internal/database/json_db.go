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

	if len(jdb.Flocks) == 0 && len(jdb.Farms) > 0 && len(jdb.Coops) >= 2 {
		jdb.seedSampleFlocksAndRecords()
		_ = jdb.persist()
	}

	// Pastikan user memiliki password hash bawaan (password123)
	needsPersist := false
	for i := range jdb.Users {
		if jdb.Users[i].PasswordHash == "" {
			hash, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
			if err == nil {
				jdb.Users[i].PasswordHash = string(hash)
				needsPersist = true
			}
		}
	}
	if needsPersist {
		_ = jdb.persist()
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
	if err := os.WriteFile(db.filePath, data, 0644); err != nil {
		return err
	}
	if DB != nil {
		go func() {
			_ = SyncDataToPostgres(DB, db)
		}()
	}
	return nil
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

	db.seedSampleFlocksAndRecords()
}

func (db *JSONDatabase) seedSampleFlocksAndRecords() {
	now := time.Now().UTC()
	if len(db.Farms) == 0 || len(db.Coops) < 2 {
		return
	}

	farmID := db.Farms[0].ID
	coopA1 := db.Coops[0]
	coopA2 := db.Coops[1]

	var eggProduct *models.Product
	var feedProduct *models.Product
	for _, p := range db.Products {
		if p.Category == "egg" && eggProduct == nil {
			pCopy := p
			eggProduct = &pCopy
		} else if p.Category == "feed" && feedProduct == nil {
			pCopy := p
			feedProduct = &pCopy
		}
	}

	// 1. Tambah Master Harga
	if eggProduct != nil {
		db.ProductPrices = append(db.ProductPrices, models.ProductPrice{
			BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			ProductID:     eggProduct.ID,
			UnitID:        eggProduct.DefaultUnitID,
			PriceType:     "sell",
			Price:         decimal.NewFromInt(450),
			ValidFrom:     now.AddDate(0, -1, 0),
			Notes:         "Harga jual standar eceran per butir",
		})
	}

	if feedProduct != nil {
		db.ProductPrices = append(db.ProductPrices, models.ProductPrice{
			BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			ProductID:     feedProduct.ID,
			UnitID:        feedProduct.DefaultUnitID,
			PriceType:     "buy",
			Price:         decimal.NewFromInt(7500),
			ValidFrom:     now.AddDate(0, -1, 0),
			Notes:         "Harga beli ransum pakan layer super per kg",
		})
	}

	// 2. Tambah Stok Awal Persediaan
	if feedProduct != nil {
		db.InventoryMovements = append(db.InventoryMovements, models.InventoryMovement{
			BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			FarmID:        farmID,
			ProductID:     feedProduct.ID,
			UnitID:        feedProduct.DefaultUnitID,
			MovementDate:  now.AddDate(0, 0, -15),
			MovementType:  "purchase_in",
			Quantity:      decimal.NewFromInt(1200),
			UnitCost:      decimal.NewFromInt(7500),
			ReferenceType: "initial_setup",
			ReferenceID:   uuid.New(),
			Notes:         "Saldo stok awal pakan 1.200 kg",
		})
	}

	// 3. Tambah Flocks (Kelompok Puyuh)
	flock1ID := uuid.New()
	flock1 := models.Flock{
		BaseUUIDModel:   models.BaseUUIDModel{ID: flock1ID, CreatedAt: now, UpdatedAt: now},
		FarmID:          farmID,
		Code:            "FLOCK-A1",
		Name:            "Puyuh Petelur Unggul Batch 01",
		EntryDate:       now.AddDate(0, -3, 0),
		InitialQuantity: 1200,
		CurrentQuantity: 1180,
		InitialAgeDays:  60,
		Status:          "active",
		Notes:           "Kelompok utama puyuh petelur di Kandang A1, kondisi sangat produktif",
	}
	db.Flocks = append(db.Flocks, flock1)
	db.FlockPlacements = append(db.FlockPlacements, models.FlockPlacement{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FlockID:       flock1ID,
		CoopID:        coopA1.ID,
		Quantity:      1180,
	})

	flock2ID := uuid.New()
	flock2 := models.Flock{
		BaseUUIDModel:   models.BaseUUIDModel{ID: flock2ID, CreatedAt: now, UpdatedAt: now},
		FarmID:          farmID,
		Code:            "FLOCK-A2",
		Name:            "Puyuh Petelur Siap Telur Batch 02",
		EntryDate:       now.AddDate(0, -1, 0),
		InitialQuantity: 800,
		CurrentQuantity: 792,
		InitialAgeDays:  45,
		Status:          "active",
		Notes:           "Kelompok puyuh petelur muda di Kandang A2, baru memasuki masa bertelur",
	}
	db.Flocks = append(db.Flocks, flock2)
	db.FlockPlacements = append(db.FlockPlacements, models.FlockPlacement{
		BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		FlockID:       flock2ID,
		CoopID:        coopA2.ID,
		Quantity:      792,
	})

	// 4. Tambah Riwayat Panen & Pemakaian Pakan 14 Hari Terakhir
	prodPatternA1 := []int{980, 995, 1010, 990, 1005, 1020, 985, 1015, 1000, 995, 1025, 1010, 1005, 1018}
	damagedPatternA1 := []int{15, 18, 12, 19, 14, 20, 16, 15, 18, 14, 21, 16, 17, 15}
	feedPatternA1 := []float64{28.5, 29.0, 28.8, 29.2, 28.6, 29.5, 28.9, 29.1, 28.7, 29.3, 28.8, 29.4, 29.0, 29.2}

	prodPatternA2 := []int{540, 560, 555, 570, 580, 595, 590, 610, 605, 620, 615, 630, 625, 640}
	damagedPatternA2 := []int{8, 11, 9, 10, 12, 8, 11, 13, 10, 9, 12, 11, 8, 10}
	feedPatternA2 := []float64{18.2, 18.5, 18.4, 18.6, 18.8, 18.9, 18.7, 19.0, 18.9, 19.1, 19.0, 19.2, 19.1, 19.3}

	for i := 13; i >= 0; i-- {
		dayDate := now.AddDate(0, 0, -i)
		idx := 13 - i

		// Panen A1
		totA1 := prodPatternA1[idx]
		damA1 := damagedPatternA1[idx]
		salA1 := totA1 - damA1
		recIDA1 := uuid.New()
		db.ProductionRecords = append(db.ProductionRecords, models.ProductionRecord{
			BaseUUIDModel: models.BaseUUIDModel{ID: recIDA1, CreatedAt: dayDate, UpdatedAt: dayDate},
			FarmID:        farmID,
			FlockID:       flock1ID,
			CoopID:        coopA1.ID,
			RecordDate:    dayDate,
			TotalEggs:     totA1,
			DamagedEggs:   damA1,
			SaleableEggs:  salA1,
			Notes:         "Panen telur rutin pagi & sore Kandang A1",
		})
		if eggProduct != nil {
			db.InventoryMovements = append(db.InventoryMovements, models.InventoryMovement{
				BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: dayDate, UpdatedAt: dayDate},
				FarmID:        farmID,
				ProductID:     eggProduct.ID,
				UnitID:        eggProduct.DefaultUnitID,
				MovementDate:  dayDate,
				MovementType:  "production_in",
				Quantity:      decimal.NewFromInt(int64(salA1)),
				ReferenceType: "production_records",
				ReferenceID:   recIDA1,
				Notes:         "Hasil panen telur layak jual Kandang A1",
			})
		}

		// Pakan A1
		fQtyA1 := decimal.NewFromFloat(feedPatternA1[idx])
		useIDA1 := uuid.New()
		if feedProduct != nil {
			db.FeedUsages = append(db.FeedUsages, models.FeedUsage{
				BaseUUIDModel: models.BaseUUIDModel{ID: useIDA1, CreatedAt: dayDate, UpdatedAt: dayDate},
				FarmID:        farmID,
				FlockID:       flock1ID,
				CoopID:        coopA1.ID,
				ProductID:     feedProduct.ID,
				UnitID:        feedProduct.DefaultUnitID,
				UsageDate:     dayDate,
				Quantity:      fQtyA1,
				Notes:         "Pemberian ransum pakan harian puyuh A1",
			})
			db.InventoryMovements = append(db.InventoryMovements, models.InventoryMovement{
				BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: dayDate, UpdatedAt: dayDate},
				FarmID:        farmID,
				ProductID:     feedProduct.ID,
				UnitID:        feedProduct.DefaultUnitID,
				MovementDate:  dayDate,
				MovementType:  "usage_out",
				Quantity:      fQtyA1.Neg(),
				ReferenceType: "feed_usages",
				ReferenceID:   useIDA1,
				Notes:         "Konsumsi pakan harian Kandang A1",
			})
		}

		// Panen A2
		totA2 := prodPatternA2[idx]
		damA2 := damagedPatternA2[idx]
		salA2 := totA2 - damA2
		recIDA2 := uuid.New()
		db.ProductionRecords = append(db.ProductionRecords, models.ProductionRecord{
			BaseUUIDModel: models.BaseUUIDModel{ID: recIDA2, CreatedAt: dayDate, UpdatedAt: dayDate},
			FarmID:        farmID,
			FlockID:       flock2ID,
			CoopID:        coopA2.ID,
			RecordDate:    dayDate,
			TotalEggs:     totA2,
			DamagedEggs:   damA2,
			SaleableEggs:  salA2,
			Notes:         "Panen telur rutin Kandang A2",
		})
		if eggProduct != nil {
			db.InventoryMovements = append(db.InventoryMovements, models.InventoryMovement{
				BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: dayDate, UpdatedAt: dayDate},
				FarmID:        farmID,
				ProductID:     eggProduct.ID,
				UnitID:        eggProduct.DefaultUnitID,
				MovementDate:  dayDate,
				MovementType:  "production_in",
				Quantity:      decimal.NewFromInt(int64(salA2)),
				ReferenceType: "production_records",
				ReferenceID:   recIDA2,
				Notes:         "Hasil panen telur layak jual Kandang A2",
			})
		}

		// Pakan A2
		fQtyA2 := decimal.NewFromFloat(feedPatternA2[idx])
		useIDA2 := uuid.New()
		if feedProduct != nil {
			db.FeedUsages = append(db.FeedUsages, models.FeedUsage{
				BaseUUIDModel: models.BaseUUIDModel{ID: useIDA2, CreatedAt: dayDate, UpdatedAt: dayDate},
				FarmID:        farmID,
				FlockID:       flock2ID,
				CoopID:        coopA2.ID,
				ProductID:     feedProduct.ID,
				UnitID:        feedProduct.DefaultUnitID,
				UsageDate:     dayDate,
				Quantity:      fQtyA2,
				Notes:         "Pemberian ransum pakan harian puyuh A2",
			})
			db.InventoryMovements = append(db.InventoryMovements, models.InventoryMovement{
				BaseUUIDModel: models.BaseUUIDModel{ID: uuid.New(), CreatedAt: dayDate, UpdatedAt: dayDate},
				FarmID:        farmID,
				ProductID:     feedProduct.ID,
				UnitID:        feedProduct.DefaultUnitID,
				MovementDate:  dayDate,
				MovementType:  "usage_out",
				Quantity:      fQtyA2.Neg(),
				ReferenceType: "feed_usages",
				ReferenceID:   useIDA2,
				Notes:         "Konsumsi pakan harian Kandang A2",
			})
		}
	}
}
