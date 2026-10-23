package routes

import (
	"github.com/gin-gonic/gin"

	"quail-management/backend/internal/config"
	"quail-management/backend/internal/handlers"
	"quail-management/backend/internal/middleware"
)

func RegisterRoutes(rg *gin.RouterGroup, cfg *config.Config) {
	authH := handlers.NewAuthHandler(cfg)
	coopH := handlers.NewCoopHandler()
	masterH := handlers.NewMasterHandler()
	flockH := handlers.NewFlockHandler()
	prodH := handlers.NewProductionHandler()
	invH := handlers.NewInventoryHandler()
	priceH := handlers.NewPricingHandler()
	salesH := handlers.NewSalesHandler()
	purchH := handlers.NewPurchasingHandler()
	finH := handlers.NewFinanceHandler()
	dashH := handlers.NewDashboardHandler()

	// Public Routes
	authGroup := rg.Group("/auth")
	{
		authGroup.POST("/login", authH.Login)
		authGroup.POST("/register", authH.Register)
	}

	// Protected Routes (JWT required)
	protected := rg.Group("")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		// Auth
		protected.GET("/auth/me", authH.Me)

		// Coops
		protected.GET("/coops", coopH.ListCoops)
		protected.POST("/coops", coopH.CreateCoop)
		protected.PUT("/coops/:id", coopH.UpdateCoop)

		// Master Data
		protected.GET("/units", masterH.ListUnits)
		protected.POST("/units", masterH.CreateUnit)
		protected.GET("/products", masterH.ListProducts)
		protected.POST("/products", masterH.CreateProduct)
		protected.GET("/customers", masterH.ListCustomers)
		protected.POST("/customers", masterH.CreateCustomer)
		protected.GET("/suppliers", masterH.ListSuppliers)
		protected.POST("/suppliers", masterH.CreateSupplier)

		// Flocks / Populasi
		protected.GET("/flocks", flockH.ListFlocks)
		protected.POST("/flocks", flockH.CreateFlock)
		protected.POST("/flocks/:id/movements", flockH.RecordMovement)

		// Produksi Telur
		protected.GET("/production", prodH.ListProduction)
		protected.POST("/production", prodH.RecordProduction)

		// Persediaan & Stok
		protected.GET("/inventory/summary", invH.GetSummary)
		protected.GET("/inventory/movements", invH.ListMovements)
		protected.POST("/inventory/feed-usage", invH.RecordFeedUsage)
		protected.POST("/inventory/adjustments", invH.RecordAdjustment)

		// Manajemen Harga
		protected.GET("/prices", priceH.ListPrices)
		protected.POST("/prices", priceH.SetPrice)

		// Penjualan
		protected.GET("/sales", salesH.ListSales)
		protected.POST("/sales", salesH.CreateSale)
		protected.POST("/sales/:id/post", salesH.PostSale)

		// Pembelian
		protected.GET("/purchases", purchH.ListPurchases)
		protected.POST("/purchases", purchH.CreatePurchase)
		protected.POST("/purchases/:id/post", purchH.PostPurchase)

		// Keuangan, Faktur & Kas
		protected.GET("/invoices", finH.ListCustomerInvoices)
		protected.POST("/customer-payments", finH.RecordCustomerPayment)
		protected.GET("/supplier-bills", finH.ListSupplierBills)
		protected.POST("/supplier-payments", finH.RecordSupplierPayment)
		protected.GET("/cash-accounts", finH.ListCashAccounts)
		protected.GET("/expenses", finH.ListExpenses)
		protected.POST("/expenses", finH.RecordExpense)
		protected.GET("/cash-transactions", finH.ListCashTransactions)

		// Dashboard & Laporan
		protected.GET("/dashboard/summary", dashH.GetSummary)
		protected.GET("/reports/production-trends", dashH.GetProductionTrends)
	}
}
