package database

import (
	"fmt"
	"log"

	"quail-management/backend/internal/models"

	"gorm.io/gorm"
)

// AutoMigrate membuat atau memperbarui skema tabel PostgreSQL.
func AutoMigrate(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("koneksi database PostgreSQL tidak tersedia")
	}

	log.Println("Memulai migrasi skema database...")

	err := db.AutoMigrate(
		&models.User{},
		&models.Farm{},
		&models.Coop{},
		&models.Unit{},
		&models.Product{},
		&models.ProductUnitConversion{},
		&models.Customer{},
		&models.Supplier{},
		&models.Flock{},
		&models.FlockPlacement{},
		&models.FlockMovement{},
		&models.ProductionRecord{},
		&models.InventoryMovement{},
		&models.FeedUsage{},
		&models.ProductPrice{},
		&models.Sale{},
		&models.SaleItem{},
		&models.Purchase{},
		&models.PurchaseItem{},
		&models.CustomerInvoice{},
		&models.CustomerPayment{},
		&models.CustomerPaymentAllocation{},
		&models.SupplierBill{},
		&models.SupplierPayment{},
		&models.SupplierPaymentAllocation{},
		&models.CashAccount{},
		&models.Expense{},
		&models.CashTransaction{},
		&models.StockAdjustment{},
		&models.StockAdjustmentItem{},
		&models.AuditLog{},
	)
	if err != nil {
		return fmt.Errorf("gagal migrasi skema database: %w", err)
	}

	log.Println("Migrasi skema database berhasil diselesaikan")

	if err := seedInitialUnits(db); err != nil {
		return fmt.Errorf("gagal menyiapkan data satuan awal: %w", err)
	}

	return nil
}

// seedInitialUnits menambahkan satuan dasar jika belum tersedia.
func seedInitialUnits(db *gorm.DB) error {
	initialUnits := []models.Unit{
		{Code: "BTR", Name: "Butir", IsBaseUnit: true},
		{Code: "RAK", Name: "Rak / Tray (30 butir)", IsBaseUnit: false},
		{Code: "KG", Name: "Kilogram", IsBaseUnit: true},
		{Code: "KRG", Name: "Karung (50 kg)", IsBaseUnit: false},
		{Code: "BTL", Name: "Botol", IsBaseUnit: true},
		{Code: "LTR", Name: "Liter", IsBaseUnit: true},
		{Code: "EKR", Name: "Ekor", IsBaseUnit: true},
	}

	for _, unit := range initialUnits {
		err := db.Where("code = ?", unit.Code).
			FirstOrCreate(&unit).Error
		if err != nil {
			return fmt.Errorf(
				"gagal menyiapkan satuan %s: %w",
				unit.Code,
				err,
			)
		}
	}

	log.Println("Data satuan awal berhasil diperiksa")
	return nil
}
