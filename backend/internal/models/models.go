package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// BaseUUIDModel standardizes primary key and timestamp fields
type BaseUUIDModel struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CreatedAt time.Time      `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time      `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (b *BaseUUIDModel) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

// User represents system operators and farm owners
type User struct {
	BaseUUIDModel
	Name         string `gorm:"size:150;not null" json:"name"`
	Email        string `gorm:"size:150;uniqueIndex;not null" json:"email"`
	PasswordHash string `gorm:"size:255;not null" json:"password_hash,omitempty"`
	Role         string `gorm:"size:50;not null;default:'owner'" json:"role"` // 'owner', 'staff', 'admin'
	IsActive     bool   `gorm:"not null;default:true" json:"is_active"`
}

// Farm represents quail farm operational entity
type Farm struct {
	BaseUUIDModel
	Code     string `gorm:"size:50;uniqueIndex;not null" json:"code"`
	Name     string `gorm:"size:150;not null" json:"name"`
	Address  string `gorm:"type:text" json:"address"`
	Phone    string `gorm:"size:50" json:"phone"`
	IsActive bool   `gorm:"not null;default:true" json:"is_active"`
}

// Coop represents quail housing units
type Coop struct {
	BaseUUIDModel
	FarmID   uuid.UUID `gorm:"type:uuid;not null;index:idx_coop_farm_code,unique" json:"farm_id"`
	Farm     Farm      `gorm:"foreignKey:FarmID;constraint:OnDelete:CASCADE" json:"farm,omitempty"`
	Code     string    `gorm:"size:50;not null;index:idx_coop_farm_code,unique" json:"code"`
	Name     string    `gorm:"size:150;not null" json:"name"`
	Capacity int       `gorm:"not null;default:0" json:"capacity"`
	Status   string    `gorm:"size:50;not null;default:'active'" json:"status"` // 'active', 'maintenance', 'inactive'
	Notes    string    `gorm:"type:text" json:"notes"`
}

// Unit represents product units (BTR, RAK, KG, KRG, BTL, LTR)
type Unit struct {
	BaseUUIDModel
	Code       string `gorm:"size:30;uniqueIndex;not null" json:"code"`
	Name       string `gorm:"size:100;not null" json:"name"`
	IsBaseUnit bool   `gorm:"not null;default:false" json:"is_base_unit"`
}

// Product represents eggs, feed, quails, medicines, and supplies
type Product struct {
	BaseUUIDModel
	FarmID        uuid.UUID       `gorm:"type:uuid;not null;index:idx_prod_farm_sku,unique" json:"farm_id"`
	Farm          Farm            `gorm:"foreignKey:FarmID;constraint:OnDelete:CASCADE" json:"farm,omitempty"`
	SKU           string          `gorm:"size:60;not null;index:idx_prod_farm_sku,unique" json:"sku"`
	Name          string          `gorm:"size:150;not null" json:"name"`
	Category      string          `gorm:"size:50;not null;index" json:"category"` // 'egg', 'feed', 'medicine', 'quail', 'equipment'
	DefaultUnitID uuid.UUID       `gorm:"type:uuid;not null" json:"default_unit_id"`
	DefaultUnit   Unit            `gorm:"foreignKey:DefaultUnitID" json:"default_unit,omitempty"`
	MinStockAlert decimal.Decimal `gorm:"type:numeric(12,3);not null;default:0" json:"min_stock_alert"`
	IsActive      bool            `gorm:"not null;default:true" json:"is_active"`
	Description   string          `gorm:"type:text" json:"description"`
}

// ProductUnitConversion defines unit multipliers (e.g. 1 RAK = 30 BTR)
type ProductUnitConversion struct {
	BaseUUIDModel
	ProductID  uuid.UUID       `gorm:"type:uuid;not null;index:idx_prod_unit_conv,unique" json:"product_id"`
	Product    Product         `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"product,omitempty"`
	FromUnitID uuid.UUID       `gorm:"type:uuid;not null;index:idx_prod_unit_conv,unique" json:"from_unit_id"`
	FromUnit   Unit            `gorm:"foreignKey:FromUnitID" json:"from_unit,omitempty"`
	ToUnitID   uuid.UUID       `gorm:"type:uuid;not null;index:idx_prod_unit_conv,unique" json:"to_unit_id"`
	ToUnit     Unit            `gorm:"foreignKey:ToUnitID" json:"to_unit,omitempty"`
	Multiplier decimal.Decimal `gorm:"type:numeric(12,4);not null" json:"multiplier"`
}

// Customer represents quail egg or bird buyers
type Customer struct {
	BaseUUIDModel
	FarmID           uuid.UUID `gorm:"type:uuid;not null;index:idx_cust_farm_code,unique" json:"farm_id"`
	Farm             Farm      `gorm:"foreignKey:FarmID;constraint:OnDelete:CASCADE" json:"farm,omitempty"`
	Code             string    `gorm:"size:50;not null;index:idx_cust_farm_code,unique" json:"code"`
	Name             string    `gorm:"size:150;not null" json:"name"`
	Phone            string    `gorm:"size:50" json:"phone"`
	Email            string    `gorm:"size:150" json:"email"`
	Address          string    `gorm:"type:text" json:"address"`
	PaymentTermsDays int       `gorm:"not null;default:0" json:"payment_terms_days"`
	IsActive         bool      `gorm:"not null;default:true" json:"is_active"`
}

// Supplier represents feed, chick, and medicine vendors
type Supplier struct {
	BaseUUIDModel
	FarmID           uuid.UUID `gorm:"type:uuid;not null;index:idx_supp_farm_code,unique" json:"farm_id"`
	Farm             Farm      `gorm:"foreignKey:FarmID;constraint:OnDelete:CASCADE" json:"farm,omitempty"`
	Code             string    `gorm:"size:50;not null;index:idx_supp_farm_code,unique" json:"code"`
	Name             string    `gorm:"size:150;not null" json:"name"`
	Phone            string    `gorm:"size:50" json:"phone"`
	Email            string    `gorm:"size:150" json:"email"`
	Address          string    `gorm:"type:text" json:"address"`
	PaymentTermsDays int       `gorm:"not null;default:0" json:"payment_terms_days"`
	IsActive         bool      `gorm:"not null;default:true" json:"is_active"`
}

// Flock represents quail batch/group
type Flock struct {
	BaseUUIDModel
	FarmID          uuid.UUID `gorm:"type:uuid;not null;index:idx_flock_farm_code,unique" json:"farm_id"`
	Farm            Farm      `gorm:"foreignKey:FarmID;constraint:OnDelete:CASCADE" json:"farm,omitempty"`
	Code            string    `gorm:"size:50;not null;index:idx_flock_farm_code,unique" json:"code"`
	Name            string    `gorm:"size:150;not null" json:"name"`
	EntryDate       time.Time `gorm:"type:date;not null" json:"entry_date"`
	InitialQuantity int       `gorm:"not null" json:"initial_quantity"`
	CurrentQuantity int       `gorm:"not null" json:"current_quantity"`
	InitialAgeDays  int       `gorm:"not null;default:1" json:"initial_age_days"`
	Status          string    `gorm:"size:50;not null;default:'active'" json:"status"` // 'brooding', 'growing', 'laying', 'culled', 'archived'
	Notes           string    `gorm:"type:text" json:"notes"`
}

// FlockPlacement tracks flock quantity inside a specific coop
type FlockPlacement struct {
	BaseUUIDModel
	FlockID  uuid.UUID `gorm:"type:uuid;not null;index:idx_flock_placement,unique" json:"flock_id"`
	Flock    Flock     `gorm:"foreignKey:FlockID;constraint:OnDelete:CASCADE" json:"flock,omitempty"`
	CoopID   uuid.UUID `gorm:"type:uuid;not null;index:idx_flock_placement,unique" json:"coop_id"`
	Coop     Coop      `gorm:"foreignKey:CoopID;constraint:OnDelete:RESTRICT" json:"coop,omitempty"`
	Quantity int       `gorm:"not null;default:0" json:"quantity"`
}

// FlockMovement records mortality, culling, transfers, and additions
type FlockMovement struct {
	BaseUUIDModel
	FlockID      uuid.UUID  `gorm:"type:uuid;not null;index" json:"flock_id"`
	Flock        Flock      `gorm:"foreignKey:FlockID;constraint:OnDelete:CASCADE" json:"flock,omitempty"`
	MovementDate time.Time  `gorm:"type:date;not null;index" json:"movement_date"`
	MovementType string     `gorm:"size:50;not null" json:"movement_type"` // 'mortality', 'culling', 'transfer', 'addition'
	Quantity     int        `gorm:"not null" json:"quantity"`
	FromCoopID   *uuid.UUID `gorm:"type:uuid" json:"from_coop_id,omitempty"`
	FromCoop     *Coop      `gorm:"foreignKey:FromCoopID" json:"from_coop,omitempty"`
	ToCoopID     *uuid.UUID `gorm:"type:uuid" json:"to_coop_id,omitempty"`
	ToCoop       *Coop      `gorm:"foreignKey:ToCoopID" json:"to_coop,omitempty"`
	Reason       string     `gorm:"type:text" json:"reason"`
	RecordedBy   *uuid.UUID `gorm:"type:uuid" json:"recorded_by,omitempty"`
}

// ProductionRecord records daily harvested eggs
type ProductionRecord struct {
	BaseUUIDModel
	FarmID       uuid.UUID  `gorm:"type:uuid;not null;index" json:"farm_id"`
	FlockID      uuid.UUID  `gorm:"type:uuid;not null;index:idx_prod_record,unique" json:"flock_id"`
	Flock        Flock      `gorm:"foreignKey:FlockID" json:"flock,omitempty"`
	CoopID       uuid.UUID  `gorm:"type:uuid;not null;index:idx_prod_record,unique" json:"coop_id"`
	Coop         Coop       `gorm:"foreignKey:CoopID" json:"coop,omitempty"`
	RecordDate   time.Time  `gorm:"type:date;not null;index:idx_prod_record,unique" json:"record_date"`
	TotalEggs    int        `gorm:"not null" json:"total_eggs"`
	DamagedEggs  int        `gorm:"not null;default:0" json:"damaged_eggs"`
	SaleableEggs int        `gorm:"not null" json:"saleable_eggs"` // Calculated: TotalEggs - DamagedEggs
	Notes        string     `gorm:"type:text" json:"notes"`
	RecordedBy   *uuid.UUID `gorm:"type:uuid" json:"recorded_by,omitempty"`
}

// InventoryMovement is the single source of truth for stock balance
type InventoryMovement struct {
	BaseUUIDModel
	FarmID        uuid.UUID       `gorm:"type:uuid;not null;index" json:"farm_id"`
	ProductID     uuid.UUID       `gorm:"type:uuid;not null;index:idx_inv_product_date" json:"product_id"`
	Product       Product         `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	UnitID        uuid.UUID       `gorm:"type:uuid;not null" json:"unit_id"`
	Unit          Unit            `gorm:"foreignKey:UnitID" json:"unit,omitempty"`
	MovementDate  time.Time       `gorm:"type:date;not null;index:idx_inv_product_date" json:"movement_date"`
	MovementType  string          `gorm:"size:50;not null;index" json:"movement_type"` // 'production_in', 'purchase_in', 'sales_out', 'usage_out', 'adjustment_in', 'adjustment_out', 'return_in'
	Quantity      decimal.Decimal `gorm:"type:numeric(12,3);not null" json:"quantity"` // Positive for in, Negative for out
	UnitCost      decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"unit_cost"`
	ReferenceType string          `gorm:"size:50;not null;index:idx_inv_ref" json:"reference_type"`
	ReferenceID   uuid.UUID       `gorm:"type:uuid;not null;index:idx_inv_ref" json:"reference_id"`
	Notes         string          `gorm:"type:text" json:"notes"`
	CreatedBy     *uuid.UUID      `gorm:"type:uuid" json:"created_by,omitempty"`
}

// FeedUsage tracks daily feed and medication consumed by flocks
type FeedUsage struct {
	BaseUUIDModel
	FarmID     uuid.UUID       `gorm:"type:uuid;not null;index" json:"farm_id"`
	FlockID    uuid.UUID       `gorm:"type:uuid;not null;index" json:"flock_id"`
	Flock      Flock           `gorm:"foreignKey:FlockID" json:"flock,omitempty"`
	CoopID     uuid.UUID       `gorm:"type:uuid;not null;index" json:"coop_id"`
	Coop       Coop            `gorm:"foreignKey:CoopID" json:"coop,omitempty"`
	ProductID  uuid.UUID       `gorm:"type:uuid;not null;index" json:"product_id"`
	Product    Product         `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	UnitID     uuid.UUID       `gorm:"type:uuid;not null" json:"unit_id"`
	Unit       Unit            `gorm:"foreignKey:UnitID" json:"unit,omitempty"`
	UsageDate  time.Time       `gorm:"type:date;not null;index" json:"usage_date"`
	Quantity   decimal.Decimal `gorm:"type:numeric(12,3);not null" json:"quantity"`
	Notes      string          `gorm:"type:text" json:"notes"`
	RecordedBy *uuid.UUID      `gorm:"type:uuid" json:"recorded_by,omitempty"`
}

// StockAdjustment represents physical inventory counts (stock opname)
type StockAdjustment struct {
	BaseUUIDModel
	FarmID           uuid.UUID             `gorm:"type:uuid;not null;index" json:"farm_id"`
	AdjustmentNumber string                `gorm:"size:60;not null;index:idx_stk_adj_num,unique" json:"adjustment_number"`
	AdjustmentDate   time.Time             `gorm:"type:date;not null;index" json:"adjustment_date"`
	Status           string                `gorm:"size:30;not null;default:'posted'" json:"status"`
	Reason           string                `gorm:"type:text;not null" json:"reason"`
	CreatedBy        *uuid.UUID            `gorm:"type:uuid" json:"created_by,omitempty"`
	Items            []StockAdjustmentItem `gorm:"foreignKey:AdjustmentID" json:"items,omitempty"`
}

// StockAdjustmentItem details individual product discrepancies
type StockAdjustmentItem struct {
	BaseUUIDModel
	AdjustmentID  uuid.UUID       `gorm:"type:uuid;not null;index" json:"adjustment_id"`
	ProductID     uuid.UUID       `gorm:"type:uuid;not null" json:"product_id"`
	Product       Product         `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	UnitID        uuid.UUID       `gorm:"type:uuid;not null" json:"unit_id"`
	Unit          Unit            `gorm:"foreignKey:UnitID" json:"unit,omitempty"`
	SystemQty     decimal.Decimal `gorm:"type:numeric(12,3);not null" json:"system_qty"`
	ActualQty     decimal.Decimal `gorm:"type:numeric(12,3);not null" json:"actual_qty"`
	DifferenceQty decimal.Decimal `gorm:"type:numeric(12,3);not null" json:"difference_qty"`
	Notes         string          `gorm:"type:text" json:"notes"`
}

// ProductPrice records price masters and validity date range
type ProductPrice struct {
	BaseUUIDModel
	ProductID uuid.UUID       `gorm:"type:uuid;not null;index:idx_price_lookup" json:"product_id"`
	Product   Product         `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	UnitID    uuid.UUID       `gorm:"type:uuid;not null" json:"unit_id"`
	Unit      Unit            `gorm:"foreignKey:UnitID" json:"unit,omitempty"`
	PriceType string          `gorm:"size:30;not null;index:idx_price_lookup" json:"price_type"` // 'sell', 'buy'
	Price     decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"price"`
	ValidFrom time.Time       `gorm:"type:date;not null;index:idx_price_lookup" json:"valid_from"`
	ValidTo   *time.Time      `gorm:"type:date" json:"valid_to,omitempty"`
	Notes     string          `gorm:"type:text" json:"notes"`
	CreatedBy *uuid.UUID      `gorm:"type:uuid" json:"created_by,omitempty"`
}

// Sale represents egg and bird sales transactions
type Sale struct {
	BaseUUIDModel
	FarmID         uuid.UUID       `gorm:"type:uuid;not null;index" json:"farm_id"`
	CustomerID     uuid.UUID       `gorm:"type:uuid;not null;index" json:"customer_id"`
	Customer       Customer        `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	SaleNumber     string          `gorm:"size:60;not null;index:idx_sale_num,unique" json:"sale_number"`
	SaleDate       time.Time       `gorm:"type:date;not null;index" json:"sale_date"`
	Status         string          `gorm:"size:30;not null;default:'draft';index" json:"status"` // 'draft', 'posted', 'cancelled'
	Subtotal       decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"subtotal"`
	DiscountAmount decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"discount_amount"`
	ShippingFee    decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"shipping_fee"`
	OtherFees      decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"other_fees"`
	GrandTotal     decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"grand_total"`
	Notes          string          `gorm:"type:text" json:"notes"`
	CreatedBy      *uuid.UUID      `gorm:"type:uuid" json:"created_by,omitempty"`
	Items          []SaleItem      `gorm:"foreignKey:SaleID" json:"items,omitempty"`
}

// SaleItem represents line items with SNAPSHOT price
type SaleItem struct {
	BaseUUIDModel
	SaleID         uuid.UUID       `gorm:"type:uuid;not null;index" json:"sale_id"`
	ProductID      uuid.UUID       `gorm:"type:uuid;not null" json:"product_id"`
	Product        Product         `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	UnitID         uuid.UUID       `gorm:"type:uuid;not null" json:"unit_id"`
	Unit           Unit            `gorm:"foreignKey:UnitID" json:"unit,omitempty"`
	Quantity       decimal.Decimal `gorm:"type:numeric(12,3);not null" json:"quantity"`
	UnitPrice      decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"unit_price"` // SNAPSHOT
	DiscountAmount decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"discount_amount"`
	Subtotal       decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"subtotal"`
	Notes          string          `gorm:"type:text" json:"notes"`
}

// Purchase represents feed and supplies procurement
type Purchase struct {
	BaseUUIDModel
	FarmID         uuid.UUID       `gorm:"type:uuid;not null;index" json:"farm_id"`
	SupplierID     uuid.UUID       `gorm:"type:uuid;not null;index" json:"supplier_id"`
	Supplier       Supplier        `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	PurchaseNumber string          `gorm:"size:60;not null;index:idx_purch_num,unique" json:"purchase_number"`
	PurchaseDate   time.Time       `gorm:"type:date;not null;index" json:"purchase_date"`
	Status         string          `gorm:"size:30;not null;default:'draft';index" json:"status"` // 'draft', 'posted', 'cancelled'
	Subtotal       decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"subtotal"`
	DiscountAmount decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"discount_amount"`
	ShippingFee    decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"shipping_fee"`
	OtherFees      decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"other_fees"`
	GrandTotal     decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"grand_total"`
	Notes          string          `gorm:"type:text" json:"notes"`
	CreatedBy      *uuid.UUID      `gorm:"type:uuid" json:"created_by,omitempty"`
	Items          []PurchaseItem  `gorm:"foreignKey:PurchaseID" json:"items,omitempty"`
}

// PurchaseItem represents purchase line items with SNAPSHOT cost
type PurchaseItem struct {
	BaseUUIDModel
	PurchaseID     uuid.UUID       `gorm:"type:uuid;not null;index" json:"purchase_id"`
	ProductID      uuid.UUID       `gorm:"type:uuid;not null" json:"product_id"`
	Product        Product         `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	UnitID         uuid.UUID       `gorm:"type:uuid;not null" json:"unit_id"`
	Unit           Unit            `gorm:"foreignKey:UnitID" json:"unit,omitempty"`
	Quantity       decimal.Decimal `gorm:"type:numeric(12,3);not null" json:"quantity"`
	UnitPrice      decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"unit_price"` // SNAPSHOT
	DiscountAmount decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"discount_amount"`
	Subtotal       decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"subtotal"`
	Notes          string          `gorm:"type:text" json:"notes"`
}

// CustomerInvoice tracks customer receivables
type CustomerInvoice struct {
	BaseUUIDModel
	FarmID        uuid.UUID       `gorm:"type:uuid;not null;index" json:"farm_id"`
	SaleID        uuid.UUID       `gorm:"type:uuid;not null;index" json:"sale_id"`
	Sale          Sale            `gorm:"foreignKey:SaleID" json:"sale,omitempty"`
	CustomerID    uuid.UUID       `gorm:"type:uuid;not null;index" json:"customer_id"`
	Customer      Customer        `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	InvoiceNumber string          `gorm:"size:60;not null;index:idx_cinv_num,unique" json:"invoice_number"`
	InvoiceDate   time.Time       `gorm:"type:date;not null" json:"invoice_date"`
	DueDate       time.Time       `gorm:"type:date;not null;index" json:"due_date"`
	TotalAmount   decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"total_amount"`
	PaidAmount    decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"paid_amount"`
	Status        string          `gorm:"size:30;not null;default:'unpaid';index" json:"status"` // 'unpaid', 'partially_paid', 'paid', 'cancelled'
}

// SupplierBill tracks supplier payables
type SupplierBill struct {
	BaseUUIDModel
	FarmID      uuid.UUID       `gorm:"type:uuid;not null;index" json:"farm_id"`
	PurchaseID  uuid.UUID       `gorm:"type:uuid;not null;index" json:"purchase_id"`
	Purchase    Purchase        `gorm:"foreignKey:PurchaseID" json:"purchase,omitempty"`
	SupplierID  uuid.UUID       `gorm:"type:uuid;not null;index" json:"supplier_id"`
	Supplier    Supplier        `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	BillNumber  string          `gorm:"size:60;not null;index:idx_sbill_num,unique" json:"bill_number"`
	BillDate    time.Time       `gorm:"type:date;not null" json:"bill_date"`
	DueDate     time.Time       `gorm:"type:date;not null;index" json:"due_date"`
	TotalAmount decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"total_amount"`
	PaidAmount  decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"paid_amount"`
	Status      string          `gorm:"size:30;not null;default:'unpaid';index" json:"status"` // 'unpaid', 'partially_paid', 'paid', 'cancelled'
}

// CashAccount represents cash in hand and farm bank accounts
type CashAccount struct {
	BaseUUIDModel
	FarmID         uuid.UUID       `gorm:"type:uuid;not null;index" json:"farm_id"`
	Name           string          `gorm:"size:100;not null" json:"name"`
	AccountType    string          `gorm:"size:50;not null;default:'cash'" json:"account_type"` // 'cash', 'bank'
	AccountNumber  string          `gorm:"size:100" json:"account_number"`
	InitialBalance decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"initial_balance"`
	CurrentBalance decimal.Decimal `gorm:"type:numeric(15,2);not null;default:0" json:"current_balance"`
	IsActive       bool            `gorm:"not null;default:true" json:"is_active"`
}

// CustomerPayment records money received from customers
type CustomerPayment struct {
	BaseUUIDModel
	FarmID         uuid.UUID                   `gorm:"type:uuid;not null;index" json:"farm_id"`
	CustomerID     uuid.UUID                   `gorm:"type:uuid;not null;index" json:"customer_id"`
	Customer       Customer                    `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	PaymentNumber  string                      `gorm:"size:60;not null;index:idx_cpymt_num,unique" json:"payment_number"`
	PaymentDate    time.Time                   `gorm:"type:date;not null;index" json:"payment_date"`
	Amount         decimal.Decimal             `gorm:"type:numeric(15,2);not null" json:"amount"`
	PaymentMethod  string                      `gorm:"size:50;not null" json:"payment_method"` // 'cash', 'bank_transfer'
	CashAccountID  *uuid.UUID                  `gorm:"type:uuid" json:"cash_account_id,omitempty"`
	CashAccount    *CashAccount                `gorm:"foreignKey:CashAccountID" json:"cash_account,omitempty"`
	ReferenceNotes string                      `gorm:"type:text" json:"reference_notes"`
	CreatedBy      *uuid.UUID                  `gorm:"type:uuid" json:"created_by,omitempty"`
	Allocations    []CustomerPaymentAllocation `gorm:"foreignKey:PaymentID" json:"allocations,omitempty"`
}

// CustomerPaymentAllocation links payment to invoices (supports multi-invoice & partial payment)
type CustomerPaymentAllocation struct {
	BaseUUIDModel
	PaymentID       uuid.UUID       `gorm:"type:uuid;not null;index" json:"payment_id"`
	InvoiceID       uuid.UUID       `gorm:"type:uuid;not null;index" json:"invoice_id"`
	Invoice         CustomerInvoice `gorm:"foreignKey:InvoiceID" json:"invoice,omitempty"`
	AllocatedAmount decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"allocated_amount"`
}

// SupplierPayment records money paid to vendors
type SupplierPayment struct {
	BaseUUIDModel
	FarmID         uuid.UUID                   `gorm:"type:uuid;not null;index" json:"farm_id"`
	SupplierID     uuid.UUID                   `gorm:"type:uuid;not null;index" json:"supplier_id"`
	Supplier       Supplier                    `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	PaymentNumber  string                      `gorm:"size:60;not null;index:idx_spymt_num,unique" json:"payment_number"`
	PaymentDate    time.Time                   `gorm:"type:date;not null;index" json:"payment_date"`
	Amount         decimal.Decimal             `gorm:"type:numeric(15,2);not null" json:"amount"`
	PaymentMethod  string                      `gorm:"size:50;not null" json:"payment_method"`
	CashAccountID  *uuid.UUID                  `gorm:"type:uuid" json:"cash_account_id,omitempty"`
	CashAccount    *CashAccount                `gorm:"foreignKey:CashAccountID" json:"cash_account,omitempty"`
	ReferenceNotes string                      `gorm:"type:text" json:"reference_notes"`
	CreatedBy      *uuid.UUID                  `gorm:"type:uuid" json:"created_by,omitempty"`
	Allocations    []SupplierPaymentAllocation `gorm:"foreignKey:PaymentID" json:"allocations,omitempty"`
}

// SupplierPaymentAllocation links supplier payment to bills
type SupplierPaymentAllocation struct {
	BaseUUIDModel
	PaymentID       uuid.UUID       `gorm:"type:uuid;not null;index" json:"payment_id"`
	BillID          uuid.UUID       `gorm:"type:uuid;not null;index" json:"bill_id"`
	Bill            SupplierBill    `gorm:"foreignKey:BillID" json:"bill,omitempty"`
	AllocatedAmount decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"allocated_amount"`
}

// Expense tracks operational farm costs (electricity, labor, repairs, etc.)
type Expense struct {
	BaseUUIDModel
	FarmID        uuid.UUID       `gorm:"type:uuid;not null;index" json:"farm_id"`
	ExpenseNumber string          `gorm:"size:60;not null;index:idx_exp_num,unique" json:"expense_number"`
	ExpenseDate   time.Time       `gorm:"type:date;not null;index" json:"expense_date"`
	Category      string          `gorm:"size:80;not null;index" json:"category"` // 'electricity', 'labor', 'maintenance', 'bedding', 'other'
	Amount        decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"amount"`
	CashAccountID uuid.UUID       `gorm:"type:uuid;not null;index" json:"cash_account_id"`
	CashAccount   CashAccount     `gorm:"foreignKey:CashAccountID" json:"cash_account,omitempty"`
	Recipient     string          `gorm:"size:150" json:"recipient"`
	Notes         string          `gorm:"type:text" json:"notes"`
	CreatedBy     *uuid.UUID      `gorm:"type:uuid" json:"created_by,omitempty"`
}

// CashTransaction records all ledger cash inflows and outflows
type CashTransaction struct {
	BaseUUIDModel
	CashAccountID   uuid.UUID       `gorm:"type:uuid;not null;index" json:"cash_account_id"`
	CashAccount     CashAccount     `gorm:"foreignKey:CashAccountID" json:"cash_account,omitempty"`
	TransactionDate time.Time       `gorm:"type:date;not null;index" json:"transaction_date"`
	TransactionType string          `gorm:"size:20;not null" json:"transaction_type"` // 'in', 'out'
	Amount          decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"amount"`
	BalanceAfter    decimal.Decimal `gorm:"type:numeric(15,2);not null" json:"balance_after"`
	SourceType      string          `gorm:"size:50;not null;index" json:"source_type"` // 'customer_payment', 'supplier_payment', 'expense', 'transfer'
	SourceID        uuid.UUID       `gorm:"type:uuid;not null;index" json:"source_id"`
	Description     string          `gorm:"type:text" json:"description"`
}

// AuditLog tracks critical modifications
type AuditLog struct {
	BaseUUIDModel
	UserID     *uuid.UUID `gorm:"type:uuid;index" json:"user_id,omitempty"`
	Action     string     `gorm:"size:50;not null;index" json:"action"` // 'CREATE', 'UPDATE', 'POST', 'CANCEL', 'DELETE'
	EntityName string     `gorm:"size:60;not null;index" json:"entity_name"`
	EntityID   uuid.UUID  `gorm:"type:uuid;not null;index" json:"entity_id"`
	Changes    string     `gorm:"type:text" json:"changes"` // JSON formatted string
	IPAddress  string     `gorm:"size:50" json:"ip_address"`
}
