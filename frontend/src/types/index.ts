export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  farm_id?: string;
}

export interface Farm {
  id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  is_active: boolean;
}

export interface Coop {
  id: string;
  code: string;
  name: string;
  capacity: number;
  status: 'active' | 'maintenance' | 'inactive';
  notes?: string;
  current_population?: number;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  is_base_unit: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: 'egg' | 'feed' | 'medicine' | 'quail' | 'equipment';
  default_unit_id: string;
  default_unit_name?: string;
  min_stock_alert: string | number;
  current_stock?: string | number;
  latest_sell_price?: string | number;
  is_active: boolean;
  description?: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  payment_terms_days: number;
  total_receivables?: string | number;
  is_active: boolean;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  payment_terms_days: number;
  total_payables?: string | number;
  is_active: boolean;
}

export interface CoopPlacementDetail {
  coop_id: string;
  coop_code: string;
  coop_name: string;
  quantity: number;
}

export interface Flock {
  id: string;
  code: string;
  name: string;
  entry_date: string;
  initial_quantity: number;
  current_quantity: number;
  initial_age_days: number;
  status: 'active' | 'culled' | 'archived';
  notes?: string;
  coop_placements?: CoopPlacementDetail[];
}

export interface ProductionRecord {
  id: string;
  flock_id: string;
  flock_name?: string;
  coop_id: string;
  coop_name?: string;
  record_date: string;
  total_eggs: number;
  damaged_eggs: number;
  saleable_eggs: number;
  notes?: string;
}

export interface StockSummaryItem {
  product_id: string;
  sku: string;
  name: string;
  category: string;
  unit_code: string;
  current_stock: string | number;
  min_stock_alert: string | number;
  is_low_stock: boolean;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name?: string;
  unit_id: string;
  unit_code?: string;
  movement_date: string;
  movement_type: string;
  quantity: string | number;
  unit_cost: string | number;
  notes?: string;
}

export interface SaleItem {
  id: string;
  product_id: string;
  product_name?: string;
  unit_id: string;
  unit_code?: string;
  quantity: string | number;
  unit_price: string | number;
  discount_amount: string | number;
  subtotal: string | number;
  notes?: string;
}

export interface Sale {
  id: string;
  customer_id: string;
  customer_name?: string;
  sale_number: string;
  sale_date: string;
  status: 'draft' | 'posted' | 'cancelled';
  subtotal: string | number;
  discount_amount: string | number;
  shipping_fee: string | number;
  other_fees: string | number;
  grand_total: string | number;
  notes?: string;
  items_detail?: SaleItem[];
}

export interface PurchaseItem {
  id: string;
  product_id: string;
  product_name?: string;
  unit_id: string;
  unit_code?: string;
  quantity: string | number;
  unit_price: string | number;
  discount_amount: string | number;
  subtotal: string | number;
  notes?: string;
}

export interface Purchase {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  purchase_number: string;
  purchase_date: string;
  status: 'draft' | 'posted' | 'cancelled';
  subtotal: string | number;
  discount_amount: string | number;
  shipping_fee: string | number;
  other_fees: string | number;
  grand_total: string | number;
  notes?: string;
  items_detail?: PurchaseItem[];
}

export interface CustomerInvoice {
  id: string;
  sale_id: string;
  sale_number?: string;
  customer_id: string;
  customer_name?: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: string | number;
  paid_amount: string | number;
  remaining_unpaid?: string | number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
}

export interface SupplierBill {
  id: string;
  purchase_id: string;
  purchase_number?: string;
  supplier_id: string;
  supplier_name?: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  total_amount: string | number;
  paid_amount: string | number;
  remaining_unpaid?: string | number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
}

export interface CashAccount {
  id: string;
  name: string;
  account_type: 'cash' | 'bank';
  account_number?: string;
  initial_balance: string | number;
  current_balance: string | number;
  is_active: boolean;
}

export interface Expense {
  id: string;
  expense_number: string;
  expense_date: string;
  category: string;
  amount: string | number;
  cash_account_id: string;
  cash_account_name?: string;
  recipient?: string;
  notes?: string;
}

export interface CashTransaction {
  id: string;
  cash_account_id: string;
  cash_account_name?: string;
  transaction_date: string;
  transaction_type: 'in' | 'out';
  amount: string | number;
  balance_after: string | number;
  source_type: string;
  description?: string;
}

export interface DashboardSummary {
  active_population: number;
  total_coops: number;
  today_production_eggs: number;
  today_damaged_eggs: number;
  today_saleable_eggs: number;
  egg_stock_ready: string | number;
  total_receivables: string | number;
  total_payables: string | number;
  total_cash_balance: string | number;
  low_stock_items_count: number;
}

export interface ProductionTrendPoint {
  date: string;
  total_eggs: number;
  saleable_eggs: number;
  damaged_eggs: number;
}
