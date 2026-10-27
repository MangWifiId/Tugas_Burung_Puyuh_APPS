package database

import (
	"fmt"
	"log"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SyncDataToPostgres menyinkronkan seluruh data dari JSONDatabase ke PostgreSQL.
// Setiap kegagalan per tabel dikumpulkan dan dikembalikan agar pemanggil tidak
// salah mengira seluruh data sudah termirror dengan baik.
func SyncDataToPostgres(db *gorm.DB, jdb *JSONDatabase) error {
	jdb.mu.RLock()
	defer jdb.mu.RUnlock()

	log.Println("🔄 Memulai sinkronisasi data ke PostgreSQL...")

	upsertClause := clause.OnConflict{UpdateAll: true}
	var failures []error

	syncTable := func(label string, value any) {
		if err := db.Clauses(upsertClause).Create(value).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi %s: %v\n", label, err)
			failures = append(failures, fmt.Errorf("%s: %w", label, err))
		}
	}

	// Urutan mengikuti dependensi foreign key: induk selalu lebih dulu.
	if len(jdb.Farms) > 0 {
		syncTable("farms", &jdb.Farms)
	}
	if len(jdb.Users) > 0 {
		syncTable("users", &jdb.Users)
	}
	if len(jdb.Coops) > 0 {
		syncTable("coops", &jdb.Coops)
	}
	if len(jdb.Units) > 0 {
		syncTable("units", &jdb.Units)
	}
	if len(jdb.Products) > 0 {
		syncTable("products", &jdb.Products)
	}
	if len(jdb.Customers) > 0 {
		syncTable("customers", &jdb.Customers)
	}
	if len(jdb.Suppliers) > 0 {
		syncTable("suppliers", &jdb.Suppliers)
	}
	if len(jdb.Flocks) > 0 {
		syncTable("flocks", &jdb.Flocks)
	}
	if len(jdb.FlockPlacements) > 0 {
		syncTable("flock placements", &jdb.FlockPlacements)
	}
	if len(jdb.FlockMovements) > 0 {
		syncTable("flock movements", &jdb.FlockMovements)
	}
	if len(jdb.ProductionRecords) > 0 {
		syncTable("production records", &jdb.ProductionRecords)
	}
	if len(jdb.InventoryMovements) > 0 {
		syncTable("inventory movements", &jdb.InventoryMovements)
	}
	if len(jdb.FeedUsages) > 0 {
		syncTable("feed usages", &jdb.FeedUsages)
	}
	if len(jdb.CashAccounts) > 0 {
		syncTable("cash accounts", &jdb.CashAccounts)
	}
	if len(jdb.CashTransactions) > 0 {
		syncTable("cash transactions", &jdb.CashTransactions)
	}
	if len(jdb.Expenses) > 0 {
		syncTable("expenses", &jdb.Expenses)
	}
	if len(jdb.Sales) > 0 {
		syncTable("sales", &jdb.Sales)
	}
	if len(jdb.Purchases) > 0 {
		syncTable("purchases", &jdb.Purchases)
	}
	if len(jdb.CustomerInvoices) > 0 {
		syncTable("customer invoices", &jdb.CustomerInvoices)
	}
	if len(jdb.SupplierBills) > 0 {
		syncTable("supplier bills", &jdb.SupplierBills)
	}
	if len(jdb.CustomerPayments) > 0 {
		syncTable("customer payments", &jdb.CustomerPayments)
	}
	if len(jdb.CustomerAllocations) > 0 {
		syncTable("customer allocations", &jdb.CustomerAllocations)
	}
	if len(jdb.SupplierPayments) > 0 {
		syncTable("supplier payments", &jdb.SupplierPayments)
	}
	if len(jdb.SupplierAllocations) > 0 {
		syncTable("supplier allocations", &jdb.SupplierAllocations)
	}
	if len(jdb.ProductPrices) > 0 {
		syncTable("product prices", &jdb.ProductPrices)
	}
	if len(jdb.StockAdjustments) > 0 {
		syncTable("stock adjustments", &jdb.StockAdjustments)
	}
	if len(jdb.AuditLogs) > 0 {
		syncTable("audit logs", &jdb.AuditLogs)
	}

	if len(failures) > 0 {
		return fmt.Errorf("%d tabel gagal disinkronkan ke PostgreSQL", len(failures))
	}

	log.Println("✓ Sinkronisasi PostgreSQL selesai")
	return nil
}
