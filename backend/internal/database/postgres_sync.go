package database

import (
	"log"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SyncDataToPostgres menyinkronkan seluruh data dari JSONDatabase ke PostgreSQL
func SyncDataToPostgres(db *gorm.DB, jdb *JSONDatabase) error {
	jdb.mu.RLock()
	defer jdb.mu.RUnlock()

	log.Println("🔄 Memulai sinkronisasi data ke PostgreSQL...")

	upsertClause := clause.OnConflict{UpdateAll: true}

	// 1. Farms
	if len(jdb.Farms) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.Farms).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi farms: %v\n", err)
		}
	}

	// 2. Users
	if len(jdb.Users) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.Users).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi users: %v\n", err)
		}
	}

	// 3. Coops
	if len(jdb.Coops) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.Coops).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi coops: %v\n", err)
		}
	}

	// 4. Units
	if len(jdb.Units) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.Units).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi units: %v\n", err)
		}
	}

	// 5. Products
	if len(jdb.Products) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.Products).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi products: %v\n", err)
		}
	}

	// 6. Customers & Suppliers
	if len(jdb.Customers) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.Customers).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi customers: %v\n", err)
		}
	}
	if len(jdb.Suppliers) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.Suppliers).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi suppliers: %v\n", err)
		}
	}

	// 7. Flocks & Placements & Movements
	if len(jdb.Flocks) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.Flocks).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi flocks: %v\n", err)
		}
	}
	if len(jdb.FlockPlacements) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.FlockPlacements).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi flock placements: %v\n", err)
		}
	}
	if len(jdb.FlockMovements) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.FlockMovements).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi flock movements: %v\n", err)
		}
	}

	// 8. Production Records
	if len(jdb.ProductionRecords) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.ProductionRecords).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi production records: %v\n", err)
		}
	}

	// 9. Inventory Movements & Feed Usages
	if len(jdb.InventoryMovements) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.InventoryMovements).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi inventory movements: %v\n", err)
		}
	}
	if len(jdb.FeedUsages) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.FeedUsages).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi feed usages: %v\n", err)
		}
	}

	// 10. Cash Accounts, Transactions, Expenses
	if len(jdb.CashAccounts) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.CashAccounts).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi cash accounts: %v\n", err)
		}
	}
	if len(jdb.CashTransactions) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.CashTransactions).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi cash transactions: %v\n", err)
		}
	}
	if len(jdb.Expenses) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.Expenses).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi expenses: %v\n", err)
		}
	}

	// 11. Sales & Purchases
	if len(jdb.Sales) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.Sales).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi sales: %v\n", err)
		}
	}
	if len(jdb.Purchases) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.Purchases).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi purchases: %v\n", err)
		}
	}

	// 12. Invoices & Bills
	if len(jdb.CustomerInvoices) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.CustomerInvoices).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi invoices: %v\n", err)
		}
	}
	if len(jdb.SupplierBills) > 0 {
		if err := db.Clauses(upsertClause).Create(&jdb.SupplierBills).Error; err != nil {
			log.Printf("⚠️ Gagal sinkronisasi bills: %v\n", err)
		}
	}

	log.Println("✓ Seluruh data awal berhasil disinkronkan ke PostgreSQL!")
	return nil
}
