package handlers

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"quail-management/backend/internal/database"
	"quail-management/backend/internal/models"
)

// findProduct mengembalikan salinan produk berdasarkan ID.
func findProduct(db *database.JSONDatabase, id uuid.UUID) (*models.Product, bool) {
	for _, p := range db.Products {
		if p.ID == id {
			product := p
			return &product, true
		}
	}
	return nil, false
}

// findCustomer mengembalikan salinan pelanggan berdasarkan ID.
func findCustomer(db *database.JSONDatabase, id uuid.UUID) (*models.Customer, bool) {
	for _, c := range db.Customers {
		if c.ID == id {
			customer := c
			return &customer, true
		}
	}
	return nil, false
}

// findSupplier mengembalikan salinan pemasok berdasarkan ID.
func findSupplier(db *database.JSONDatabase, id uuid.UUID) (*models.Supplier, bool) {
	for _, s := range db.Suppliers {
		if s.ID == id {
			supplier := s
			return &supplier, true
		}
	}
	return nil, false
}

// findCoop mengembalikan salinan kandang berdasarkan ID.
func findCoop(db *database.JSONDatabase, id uuid.UUID) (*models.Coop, bool) {
	for _, c := range db.Coops {
		if c.ID == id {
			coop := c
			return &coop, true
		}
	}
	return nil, false
}

// findFlock mengembalikan salinan kelompok puyuh berdasarkan ID.
func findFlock(db *database.JSONDatabase, id uuid.UUID) (*models.Flock, bool) {
	for _, f := range db.Flocks {
		if f.ID == id {
			flock := f
			return &flock, true
		}
	}
	return nil, false
}

// toBaseUnit mengonversi kuantitas dari satuan tertentu ke satuan default produk.
// Mendukung konversi dua arah berdasarkan tabel product_unit_conversions.
func toBaseUnit(db *database.JSONDatabase, product *models.Product, unitID uuid.UUID, qty decimal.Decimal) (decimal.Decimal, error) {
	if unitID == product.DefaultUnitID {
		return qty, nil
	}

	for _, conv := range db.Conversions {
		if conv.ProductID != product.ID {
			continue
		}
		if conv.FromUnitID == unitID && conv.ToUnitID == product.DefaultUnitID {
			return qty.Mul(conv.Multiplier), nil
		}
		if conv.FromUnitID == product.DefaultUnitID && conv.ToUnitID == unitID {
			if conv.Multiplier.IsZero() {
				continue
			}
			return qty.Div(conv.Multiplier), nil
		}
	}

	return decimal.Zero, fmt.Errorf("satuan yang dipilih tidak memiliki konversi untuk produk %s", product.Name)
}

// currentStock menghitung saldo stok dalam satuan default produk.
func currentStock(db *database.JSONDatabase, productID uuid.UUID) decimal.Decimal {
	stock := decimal.Zero
	for _, mov := range db.InventoryMovements {
		if mov.ProductID == productID {
			stock = stock.Add(mov.Quantity)
		}
	}
	return stock
}

// averageUnitCost menghitung harga pokok rata-rata tertimbang dari mutasi masuk.
func averageUnitCost(db *database.JSONDatabase, productID uuid.UUID) decimal.Decimal {
	totalQty := decimal.Zero
	totalCost := decimal.Zero

	for _, mov := range db.InventoryMovements {
		if mov.ProductID != productID || !mov.Quantity.GreaterThan(decimal.Zero) || !mov.UnitCost.GreaterThan(decimal.Zero) {
			continue
		}
		totalQty = totalQty.Add(mov.Quantity)
		totalCost = totalCost.Add(mov.Quantity.Mul(mov.UnitCost))
	}

	if totalQty.IsZero() {
		return decimal.Zero
	}
	return totalCost.DivRound(totalQty, 2)
}
