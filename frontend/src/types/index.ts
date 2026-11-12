export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PageMeta {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  meta: PageMeta
}

export interface User {
  id: number
  tenant_id?: number
  name: string
  email: string
  role: string
  email_verified: boolean
  email_verified_at?: string | null
  last_login_at?: string | null
  created_at: string
  updated_at: string
}

export interface Batch {
  id: number
  name: string
  hatch_date: string
  entry_date?: string | null
  initial_population: number
  production_start_date?: string | null
  status: 'active' | 'inactive'
  notes: string
  created_at: string
  updated_at: string
}

export interface BatchStats extends Batch {
  current_population: number
  total_mortality: number
  total_reduction: number
  total_addition: number
  age_days: number
  age_weeks: number
  age_stage: string
  mortality_rate: number
  recent_eggs: number
  productivity: number
  productivity_7d: number
  standard_productivity: number
  productivity_gap: number
  production_trend: number
  productivity_status: 'no_data' | 'normal' | 'watch' | 'low' | 'stale'
  last_production_date?: string | null
}

export interface EggProduction {
  id: number
  batch_id?: number | null
  batch?: Batch | null
  production_date: string
  egg_count: number
  notes: string
  created_at: string
  updated_at: string
}

export interface MortalityRecord {
  id: number
  batch_id: number
  batch?: Batch
  record_date: string
  count: number
  cause: string
  notes: string
  created_at: string
  updated_at: string
}

export interface PopulationAdjustment {
  id: number
  batch_id: number
  batch?: Batch
  adjust_date: string
  type: 'reduction' | 'addition'
  quantity: number
  reason: string
  notes: string
  created_at: string
  updated_at: string
}

export interface PopulationPoint {
  date: string
  population: number
  mortality: number
  adjustment: number
}

export interface EggPickup {
  id: number
  pickup_date: string
  egg_count: number
  price_per_unit?: number | null
  status: 'pending' | 'invoiced'
  notes: string
  created_at: string
  updated_at: string
}

export interface SalesNote {
  id: number
  note_number: string
  note_date: string
  period_start?: string | null
  period_end?: string | null
  total_eggs: number
  total_amount: number
  feed_deduction: number
  notes: string
  pickups?: EggPickup[]
  created_at: string
  updated_at: string
}

export interface FeedReceipt {
  id: number
  received_date: string
  feed_type: string
  sacks: number
  price_per_sack: number
  notes: string
  created_at: string
  updated_at: string
}

export interface FeedPriceHistory {
  id: number
  feed_type: string
  price_per_sack: number
  effective_date: string
  feed_receipt_id?: number | null
  notes: string
  created_at: string
}

export interface CalendarEvent {
  id: number
  title: string
  event_date: string
  event_type: string
  batch_id?: number | null
  batch?: Batch | null
  notes: string
  reminder: boolean
  reminder_days: number
  status: 'planned' | 'done' | 'cancelled'
  batch_age_days?: number | null
  created_at: string
  updated_at: string
}

export interface WarningRule {
  id: number
  code: string
  name: string
  category: 'mortality' | 'production' | 'population' | 'feed'
  level: 'waspada' | 'kritis'
  threshold: number
  unit: string
  description: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface WarningEvent {
  id: number
  rule_id?: number | null
  rule?: WarningRule | null
  code: string
  category: string
  level: 'waspada' | 'kritis'
  title: string
  description: string
  metric_value: number
  threshold: number
  event_date: string
  detected_at: string
  status: 'open' | 'acknowledged'
  acknowledged_at?: string | null
  acknowledged_name?: string
  created_at: string
  updated_at: string
}

export interface ProductionPoint {
  period: string
  label: string
  eggs: number
  records: number
}

export interface ProductionSummary {
  total_eggs: number
  total_days: number
  average_eggs: number
  points: ProductionPoint[]
}

export interface MortalityPoint {
  period: string
  label: string
  count: number
  records: number
}

export interface MortalitySummary {
  total: number
  average_daily: number
  points: MortalityPoint[]
  by_batch: Array<{ batch_id: number; batch_name: string; total: number }>
}

export interface SalesSummary {
  total_pickups: number
  total_eggs: number
  average_eggs: number
  estimated_value: number
  pending_pickups: number
  note_count: number
  total_revenue: number
  feed_deduction: number
}

export interface FeedSummary {
  total_sacks: number
  total_spend: number
  receipts: number
  average_price: number
  latest_price: number
}

export interface ReportPoint {
  period: string
  label: string
  eggs: number
  sales_eggs: number
  revenue: number
  mortality: number
  sacks: number
  feed_spend: number
  feed_price: number
  population: number
  productivity: number
}

export interface ReportTotals {
  total_eggs: number
  average_eggs: number
  total_sales_eggs: number
  total_revenue: number
  total_mortality: number
  mortality_rate: number
  total_feed_sacks: number
  total_feed_spend: number
  latest_feed_price: number
  current_population: number
  productivity: number
}

export interface AgeProductivityPoint {
  age_weeks: number
  label: string
  eggs: number
  population: number
  productivity: number
  standard: number
  samples: number
}

export interface ReportResponse {
  from: string
  to: string
  group_by: string
  days: number
  totals: ReportTotals
  series: ReportPoint[]
  age_series: AgeProductivityPoint[]
  batches: BatchStats[]
}

export interface DashboardData {
  today_eggs: number
  today_mortality: number
  month_eggs: number
  month_mortality: number
  month_pickup_eggs: number
  month_revenue: number
  month_notes: number
  month_feed_sacks: number
  month_feed_spend: number
  current_population: number
  initial_population: number
  today_productivity: number
  month_productivity: number
  latest_feed_price: number
  open_warnings: number
  critical_warnings: number
  upcoming_events: CalendarEvent[]
  recent_warnings: WarningEvent[]
  charts: ReportPoint[]
  age_series: AgeProductivityPoint[]
  batches: BatchStats[]
}

export interface AppSetting {
  id: number
  key: string
  value: string
  label: string
  group: string
  updated_at: string
}

export interface ActivityLog {
  id: number
  user_id?: number | null
  user_name: string
  action: string
  entity: string
  entity_id: number
  description: string
  created_at: string
}

export interface LoginResult {
  token: string
  expires_at: string
  user: User
}

export interface RegisterResult {
  verification_required: boolean
  email_sent: boolean
  email: string
  message: string
  token?: string
  expires_at?: string
  user?: User
}
