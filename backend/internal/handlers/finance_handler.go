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

type FinanceHandler struct{}

func NewFinanceHandler() *FinanceHandler {
	return &FinanceHandler{}
}

// ----------------- CUSTOMER INVOICES & PAYMENTS -----------------

type InvoiceDetailResponse struct {
	models.CustomerInvoice
	CustomerName    string          `json:"customer_name"`
	SaleNumber      string          `json:"sale_number"`
	RemainingUnpaid decimal.Decimal `json:"remaining_unpaid"`
}

func (h *FinanceHandler) ListCustomerInvoices(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	custMap := make(map[uuid.UUID]string)
	for _, cust := range db.Customers {
		custMap[cust.ID] = cust.Name
	}
	saleMap := make(map[uuid.UUID]string)
	for _, s := range db.Sales {
		saleMap[s.ID] = s.SaleNumber
	}

	var results []InvoiceDetailResponse
	for _, inv := range db.CustomerInvoices {
		unpaid := inv.TotalAmount.Sub(inv.PaidAmount)
		results = append(results, InvoiceDetailResponse{
			CustomerInvoice: inv,
			CustomerName:    custMap[inv.CustomerID],
			SaleNumber:      saleMap[inv.SaleID],
			RemainingUnpaid: unpaid,
		})
	}

	response.JSON(c, http.StatusOK, "Daftar faktur pelanggan", results)
}

type CreateCustomerPaymentRequest struct {
	CustomerID    string                          `json:"customer_id" binding:"required"`
	PaymentDate   string                          `json:"payment_date" binding:"required"`
	PaymentMethod string                          `json:"payment_method" binding:"required"`
	CashAccountID string                          `json:"cash_account_id" binding:"required"`
	Amount        decimal.Decimal                 `json:"amount" binding:"required"`
	Notes         string                          `json:"notes"`
	Allocations   []PaymentAllocationInputRequest `json:"allocations" binding:"required,min=1"`
}

type PaymentAllocationInputRequest struct {
	InvoiceID string          `json:"invoice_id" binding:"required"`
	Amount    decimal.Decimal `json:"amount" binding:"required"`
}

// SupplierBillAllocationInputRequest digunakan khusus untuk alokasi pembayaran tagihan pemasok.
// Menggunakan bill_id (bukan invoice_id) agar konsisten dengan konteks tagihan pemasok.
type SupplierBillAllocationInputRequest struct {
	BillID string          `json:"bill_id" binding:"required"`
	Amount decimal.Decimal `json:"amount" binding:"required"`
}

func (h *FinanceHandler) RecordCustomerPayment(c *gin.Context) {
	var req CreateCustomerPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data pembayaran pelanggan tidak valid")
		return
	}

	if req.Amount.LessThanOrEqual(decimal.Zero) {
		response.BadRequest(c, "Nominal pembayaran harus lebih besar dari 0")
		return
	}

	payDate, err := time.Parse("2006-01-02", req.PaymentDate)
	if err != nil {
		response.BadRequest(c, "Format tanggal harus YYYY-MM-DD")
		return
	}

	custUUID, err := uuid.Parse(req.CustomerID)
	if err != nil {
		response.BadRequest(c, "ID pelanggan tidak valid")
		return
	}

	cashAccUUID, err := uuid.Parse(req.CashAccountID)
	if err != nil {
		response.BadRequest(c, "ID rekening/kas tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	if _, ok := findCustomer(db, custUUID); !ok {
		response.NotFound(c, "Pelanggan tidak ditemukan")
		return
	}

	// Verifikasi rekening kas
	cashAccIdx := -1
	for i, ca := range db.CashAccounts {
		if ca.ID == cashAccUUID {
			cashAccIdx = i
			break
		}
	}
	if cashAccIdx == -1 {
		response.NotFound(c, "Akun kas/bank tidak ditemukan")
		return
	}

	// Validasi total alokasi harus sesuai dengan total pembayaran
	totalAlloc := decimal.Zero
	for _, al := range req.Allocations {
		totalAlloc = totalAlloc.Add(al.Amount)
	}
	if !totalAlloc.Equal(req.Amount) {
		response.BadRequest(c, fmt.Sprintf("Total nominal alokasi (%s) tidak sama dengan nominal pembayaran (%s)", totalAlloc.String(), req.Amount.String()))
		return
	}

	// Validasi setiap alokasi: nominal positif, faktur ada, milik pelanggan ini,
	// dan tidak melebihi sisa piutang (termasuk jika satu faktur dialokasikan
	// lebih dari sekali dalam request yang sama).
	remainingByInvoice := make(map[uuid.UUID]decimal.Decimal)
	for _, al := range req.Allocations {
		if !al.Amount.GreaterThan(decimal.Zero) {
			response.BadRequest(c, "Nominal alokasi harus lebih besar dari 0")
			return
		}
		invUUID, err := uuid.Parse(al.InvoiceID)
		if err != nil {
			response.BadRequest(c, "ID faktur pada alokasi tidak valid")
			return
		}

		invoiceFound := false
		remaining, seen := remainingByInvoice[invUUID]
		for i := range db.CustomerInvoices {
			inv := db.CustomerInvoices[i]
			if inv.ID != invUUID {
				continue
			}
			if inv.CustomerID != custUUID {
				response.BadRequest(c, "Faktur yang dialokasikan bukan milik pelanggan ini")
				return
			}
			if inv.Status == "cancelled" {
				response.Unprocessable(c, "Faktur yang dibatalkan tidak dapat menerima pembayaran")
				return
			}
			if !seen {
				remaining = inv.TotalAmount.Sub(inv.PaidAmount)
			}
			invoiceFound = true
			break
		}
		if !invoiceFound {
			response.NotFound(c, "Faktur pada alokasi tidak ditemukan")
			return
		}
		if al.Amount.GreaterThan(remaining) {
			response.Unprocessable(c, fmt.Sprintf("Nominal alokasi (%s) melebihi sisa piutang faktur (%s)", al.Amount.String(), remaining.String()))
			return
		}
		remainingByInvoice[invUUID] = remaining.Sub(al.Amount)
	}

	now := time.Now().UTC()
	paymentID := uuid.New()
	payNumber := fmt.Sprintf("RCP-%s-%04d", time.Now().Format("20060102"), len(db.CustomerPayments)+1)

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	newPayment := models.CustomerPayment{
		BaseUUIDModel:  models.BaseUUIDModel{ID: paymentID, CreatedAt: now, UpdatedAt: now},
		FarmID:         farmID,
		CustomerID:     custUUID,
		PaymentNumber:  payNumber,
		PaymentDate:    payDate,
		Amount:         req.Amount,
		PaymentMethod:  req.PaymentMethod,
		CashAccountID:  &cashAccUUID,
		ReferenceNotes: req.Notes,
	}
	db.CustomerPayments = append(db.CustomerPayments, newPayment)

	// Single Source of Truth: Alokasikan ke faktur & hitung status faktur
	for _, al := range req.Allocations {
		invUUID, _ := uuid.Parse(al.InvoiceID)
		db.CustomerAllocations = append(db.CustomerAllocations, models.CustomerPaymentAllocation{
			BaseUUIDModel:   models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			PaymentID:       paymentID,
			InvoiceID:       invUUID,
			AllocatedAmount: al.Amount,
		})

		for i := range db.CustomerInvoices {
			if db.CustomerInvoices[i].ID == invUUID {
				db.CustomerInvoices[i].PaidAmount = db.CustomerInvoices[i].PaidAmount.Add(al.Amount)
				if db.CustomerInvoices[i].PaidAmount.GreaterThanOrEqual(db.CustomerInvoices[i].TotalAmount) {
					db.CustomerInvoices[i].Status = "paid"
				} else {
					db.CustomerInvoices[i].Status = "partially_paid"
				}
				db.CustomerInvoices[i].UpdatedAt = now
				break
			}
		}
	}

	// Tambahkan uang masuk ke Kas
	newBalance := db.CashAccounts[cashAccIdx].CurrentBalance.Add(req.Amount)
	db.CashAccounts[cashAccIdx].CurrentBalance = newBalance
	db.CashAccounts[cashAccIdx].UpdatedAt = now

	// Catat mutasi kas masuk
	db.CashTransactions = append(db.CashTransactions, models.CashTransaction{
		BaseUUIDModel:   models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		CashAccountID:   cashAccUUID,
		TransactionDate: payDate,
		TransactionType: "in",
		Amount:          req.Amount,
		BalanceAfter:    newBalance,
		SourceType:      "customer_payment",
		SourceID:        paymentID,
		Description:     fmt.Sprintf("Penerimaan pembayaran piutang no. %s", payNumber),
	})

	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Data gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Pembayaran pelanggan berhasil dicatat dan kas bertambah", newPayment)
}

// ----------------- SUPPLIER BILLS & PAYMENTS -----------------

type BillDetailResponse struct {
	models.SupplierBill
	SupplierName    string          `json:"supplier_name"`
	PurchaseNumber  string          `json:"purchase_number"`
	RemainingUnpaid decimal.Decimal `json:"remaining_unpaid"`
}

func (h *FinanceHandler) ListSupplierBills(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	suppMap := make(map[uuid.UUID]string)
	for _, s := range db.Suppliers {
		suppMap[s.ID] = s.Name
	}
	purMap := make(map[uuid.UUID]string)
	for _, p := range db.Purchases {
		purMap[p.ID] = p.PurchaseNumber
	}

	var results []BillDetailResponse
	for _, bill := range db.SupplierBills {
		unpaid := bill.TotalAmount.Sub(bill.PaidAmount)
		results = append(results, BillDetailResponse{
			SupplierBill:    bill,
			SupplierName:    suppMap[bill.SupplierID],
			PurchaseNumber:  purMap[bill.PurchaseID],
			RemainingUnpaid: unpaid,
		})
	}

	response.JSON(c, http.StatusOK, "Daftar tagihan pemasok", results)
}

type CreateSupplierPaymentRequest struct {
	SupplierID    string                               `json:"supplier_id" binding:"required"`
	PaymentDate   string                               `json:"payment_date" binding:"required"`
	PaymentMethod string                               `json:"payment_method" binding:"required"`
	CashAccountID string                               `json:"cash_account_id" binding:"required"`
	Amount        decimal.Decimal                      `json:"amount" binding:"required"`
	Notes         string                               `json:"notes"`
	Allocations   []SupplierBillAllocationInputRequest `json:"allocations" binding:"required,min=1"`
}

func (h *FinanceHandler) RecordSupplierPayment(c *gin.Context) {
	var req CreateSupplierPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data pembayaran tagihan tidak valid")
		return
	}

	if req.Amount.LessThanOrEqual(decimal.Zero) {
		response.BadRequest(c, "Nominal pembayaran harus lebih besar dari 0")
		return
	}

	payDate, err := time.Parse("2006-01-02", req.PaymentDate)
	if err != nil {
		response.BadRequest(c, "Format tanggal harus YYYY-MM-DD")
		return
	}

	suppUUID, err := uuid.Parse(req.SupplierID)
	if err != nil {
		response.BadRequest(c, "ID pemasok tidak valid")
		return
	}

	cashAccUUID, err := uuid.Parse(req.CashAccountID)
	if err != nil {
		response.BadRequest(c, "ID rekening/kas tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	if _, ok := findSupplier(db, suppUUID); !ok {
		response.NotFound(c, "Pemasok tidak ditemukan")
		return
	}

	cashAccIdx := -1
	for i, ca := range db.CashAccounts {
		if ca.ID == cashAccUUID {
			cashAccIdx = i
			break
		}
	}
	if cashAccIdx == -1 {
		response.NotFound(c, "Akun kas/bank tidak ditemukan")
		return
	}

	// Cek saldo kas cukup
	if db.CashAccounts[cashAccIdx].CurrentBalance.LessThan(req.Amount) {
		response.Unprocessable(c, fmt.Sprintf("Saldo kas tidak mencukupi untuk pembayaran (tersedia: %s, dibutuhkan: %s)",
			db.CashAccounts[cashAccIdx].CurrentBalance.String(), req.Amount.String()))
		return
	}

	totalAlloc := decimal.Zero
	for _, al := range req.Allocations {
		totalAlloc = totalAlloc.Add(al.Amount)
	}
	if !totalAlloc.Equal(req.Amount) {
		response.BadRequest(c, fmt.Sprintf("Total nominal alokasi (%s) tidak sama dengan nominal pembayaran (%s)", totalAlloc.String(), req.Amount.String()))
		return
	}

	remainingByBill := make(map[uuid.UUID]decimal.Decimal)
	for _, al := range req.Allocations {
		if !al.Amount.GreaterThan(decimal.Zero) {
			response.BadRequest(c, "Nominal alokasi harus lebih besar dari 0")
			return
		}
		billUUID, err := uuid.Parse(al.BillID)
		if err != nil {
			response.BadRequest(c, "ID tagihan pada alokasi tidak valid")
			return
		}

		billFound := false
		remaining, seen := remainingByBill[billUUID]
		for i := range db.SupplierBills {
			bill := db.SupplierBills[i]
			if bill.ID != billUUID {
				continue
			}
			if bill.SupplierID != suppUUID {
				response.BadRequest(c, "Tagihan yang dialokasikan bukan milik pemasok ini")
				return
			}
			if bill.Status == "cancelled" {
				response.Unprocessable(c, "Tagihan yang dibatalkan tidak dapat menerima pembayaran")
				return
			}
			if !seen {
				remaining = bill.TotalAmount.Sub(bill.PaidAmount)
			}
			billFound = true
			break
		}
		if !billFound {
			response.NotFound(c, "Tagihan pada alokasi tidak ditemukan")
			return
		}
		if al.Amount.GreaterThan(remaining) {
			response.Unprocessable(c, fmt.Sprintf("Nominal alokasi (%s) melebihi sisa utang tagihan (%s)", al.Amount.String(), remaining.String()))
			return
		}
		remainingByBill[billUUID] = remaining.Sub(al.Amount)
	}

	now := time.Now().UTC()
	paymentID := uuid.New()
	payNumber := fmt.Sprintf("PMT-%s-%04d", time.Now().Format("20060102"), len(db.SupplierPayments)+1)

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	newPayment := models.SupplierPayment{
		BaseUUIDModel:  models.BaseUUIDModel{ID: paymentID, CreatedAt: now, UpdatedAt: now},
		FarmID:         farmID,
		SupplierID:     suppUUID,
		PaymentNumber:  payNumber,
		PaymentDate:    payDate,
		Amount:         req.Amount,
		PaymentMethod:  req.PaymentMethod,
		CashAccountID:  &cashAccUUID,
		ReferenceNotes: req.Notes,
	}
	db.SupplierPayments = append(db.SupplierPayments, newPayment)

	// Alokasi ke tagihan
	for _, al := range req.Allocations {
		billUUID, _ := uuid.Parse(al.BillID)
		db.SupplierAllocations = append(db.SupplierAllocations, models.SupplierPaymentAllocation{
			BaseUUIDModel:   models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
			PaymentID:       paymentID,
			BillID:          billUUID,
			AllocatedAmount: al.Amount,
		})

		for i := range db.SupplierBills {
			if db.SupplierBills[i].ID == billUUID {
				db.SupplierBills[i].PaidAmount = db.SupplierBills[i].PaidAmount.Add(al.Amount)
				if db.SupplierBills[i].PaidAmount.GreaterThanOrEqual(db.SupplierBills[i].TotalAmount) {
					db.SupplierBills[i].Status = "paid"
				} else {
					db.SupplierBills[i].Status = "partially_paid"
				}
				db.SupplierBills[i].UpdatedAt = now
				break
			}
		}
	}

	// Potong kas keluar
	newBalance := db.CashAccounts[cashAccIdx].CurrentBalance.Sub(req.Amount)
	db.CashAccounts[cashAccIdx].CurrentBalance = newBalance
	db.CashAccounts[cashAccIdx].UpdatedAt = now

	// Catat mutasi kas keluar
	db.CashTransactions = append(db.CashTransactions, models.CashTransaction{
		BaseUUIDModel:   models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		CashAccountID:   cashAccUUID,
		TransactionDate: payDate,
		TransactionType: "out",
		Amount:          req.Amount,
		BalanceAfter:    newBalance,
		SourceType:      "supplier_payment",
		SourceID:        paymentID,
		Description:     fmt.Sprintf("Pembayaran utang pemasok no. %s", payNumber),
	})

	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Data gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Pembayaran tagihan pemasok berhasil dicatat dan kas berkurang", newPayment)
}

// ----------------- CASH & EXPENSES -----------------

func (h *FinanceHandler) ListCashAccounts(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()
	response.JSON(c, http.StatusOK, "Daftar rekening kas", db.CashAccounts)
}

func (h *FinanceHandler) ListExpenses(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	cashAccMap := make(map[uuid.UUID]string)
	for _, ca := range db.CashAccounts {
		cashAccMap[ca.ID] = ca.Name
	}

	type ExpenseDetailResponse struct {
		models.Expense
		CashAccountName string `json:"cash_account_name"`
	}

	var results []ExpenseDetailResponse
	for _, exp := range db.Expenses {
		results = append(results, ExpenseDetailResponse{
			Expense:         exp,
			CashAccountName: cashAccMap[exp.CashAccountID],
		})
	}

	response.JSON(c, http.StatusOK, "Daftar pengeluaran operasional", results)
}

func (h *FinanceHandler) RecordExpense(c *gin.Context) {
	var req struct {
		ExpenseDate   string          `json:"expense_date" binding:"required"`
		Category      string          `json:"category" binding:"required"` // electricity, labor, maintenance, bedding, other
		Amount        decimal.Decimal `json:"amount" binding:"required"`
		CashAccountID string          `json:"cash_account_id" binding:"required"`
		Recipient     string          `json:"recipient"`
		Notes         string          `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidationError(c, "Data beban pengeluaran tidak lengkap")
		return
	}

	if req.Amount.LessThanOrEqual(decimal.Zero) {
		response.BadRequest(c, "Nominal biaya harus lebih besar dari 0")
		return
	}

	expDate, err := time.Parse("2006-01-02", req.ExpenseDate)
	if err != nil {
		response.BadRequest(c, "Format tanggal harus YYYY-MM-DD")
		return
	}

	cashUUID, err := uuid.Parse(req.CashAccountID)
	if err != nil {
		response.BadRequest(c, "ID rekening kas tidak valid")
		return
	}

	db := database.DBInstance
	db.Lock()
	defer db.Unlock()

	cashAccIdx := -1
	for i, ca := range db.CashAccounts {
		if ca.ID == cashUUID {
			cashAccIdx = i
			break
		}
	}
	if cashAccIdx == -1 {
		response.NotFound(c, "Akun kas tidak ditemukan")
		return
	}

	if db.CashAccounts[cashAccIdx].CurrentBalance.LessThan(req.Amount) {
		response.Unprocessable(c, fmt.Sprintf("Saldo kas tidak cukup untuk pengeluaran ini (tersedia: %s, diminta: %s)",
			db.CashAccounts[cashAccIdx].CurrentBalance.String(), req.Amount.String()))
		return
	}

	now := time.Now().UTC()
	expID := uuid.New()
	expNumber := fmt.Sprintf("EXP-%s-%04d", time.Now().Format("20060102"), len(db.Expenses)+1)

	var farmID uuid.UUID
	if len(db.Farms) > 0 {
		farmID = db.Farms[0].ID
	}

	newExpense := models.Expense{
		BaseUUIDModel: models.BaseUUIDModel{ID: expID, CreatedAt: now, UpdatedAt: now},
		FarmID:        farmID,
		ExpenseNumber: expNumber,
		ExpenseDate:   expDate,
		Category:      req.Category,
		Amount:        req.Amount,
		CashAccountID: cashUUID,
		Recipient:     req.Recipient,
		Notes:         req.Notes,
	}
	db.Expenses = append(db.Expenses, newExpense)

	// Potong kas keluar
	newBalance := db.CashAccounts[cashAccIdx].CurrentBalance.Sub(req.Amount)
	db.CashAccounts[cashAccIdx].CurrentBalance = newBalance
	db.CashAccounts[cashAccIdx].UpdatedAt = now

	// Catat ke transaksi kas
	db.CashTransactions = append(db.CashTransactions, models.CashTransaction{
		BaseUUIDModel:   models.BaseUUIDModel{ID: uuid.New(), CreatedAt: now, UpdatedAt: now},
		CashAccountID:   cashUUID,
		TransactionDate: expDate,
		TransactionType: "out",
		Amount:          req.Amount,
		BalanceAfter:    newBalance,
		SourceType:      "expense",
		SourceID:        expID,
		Description:     fmt.Sprintf("Beban operasional [%s]: %s (%s)", req.Category, req.Notes, expNumber),
	})

	if err := db.Persist(); err != nil {
		response.InternalServerError(c, "Data gagal disimpan, silakan coba lagi")
		return
	}

	response.JSON(c, http.StatusCreated, "Pengeluaran operasional berhasil dicatat", newExpense)
}

func (h *FinanceHandler) ListCashTransactions(c *gin.Context) {
	db := database.DBInstance
	db.RLock()
	defer db.RUnlock()

	cashAccMap := make(map[uuid.UUID]string)
	for _, ca := range db.CashAccounts {
		cashAccMap[ca.ID] = ca.Name
	}

	type CashTransResponse struct {
		models.CashTransaction
		CashAccountName string `json:"cash_account_name"`
	}

	var results []CashTransResponse
	for _, ct := range db.CashTransactions {
		results = append(results, CashTransResponse{
			CashTransaction: ct,
			CashAccountName: cashAccMap[ct.CashAccountID],
		})
	}

	response.JSON(c, http.StatusOK, "Buku mutasi kas", results)
}
