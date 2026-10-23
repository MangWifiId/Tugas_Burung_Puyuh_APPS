package database

import (
	"log"

	"gorm.io/gorm"
	"quail-management/backend/internal/models"
)

// AutoMigrate applies schema changes across all defined models
func AutoMigrate(db *gorm.DB) error {
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
		&models.AuditLog{},
	)

	if err != nil {
		return err
	}

	log.Println("✓ Migrasi skema database berhasil diselesaikan")

	// Seed base units if not exist
	seedInitialUnits(db)

	return nil
}

func seedInitialUnits(db *gorm.DB) {
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
		var count int64
		db.Model(&models.Unit{}).Where("code = ?", unit.Code).Count(&count)
		if count == 0 {
			if err := db.Create(&unit).Error; err != nil {
				log.Printf("Gagal seed satuan %s: %v\n", unit.Code, err)
			}
		}
	}
}
