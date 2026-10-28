export const EVENT_TYPES = [
  { value: 'naik_baterai', label: 'Naik baterai' },
  { value: 'vitamin', label: 'Pemberian vitamin' },
  { value: 'obat', label: 'Pemberian obat' },
  { value: 'vaksin', label: 'Pemberian vaksin' },
  { value: 'pakan', label: 'Perubahan pakan' },
  { value: 'lainnya', label: 'Kegiatan lainnya' },
]

export const EVENT_STATUSES = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'done', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

export const FEED_TYPES = [
  { value: 'layer', label: 'Pakan layer' },
  { value: 'starter', label: 'Pakan starter' },
  { value: 'grower', label: 'Pakan grower' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const WARNING_CATEGORIES: Record<string, string> = {
  mortality: 'Kematian',
  production: 'Produksi',
  population: 'Populasi',
  feed: 'Pakan',
}

export const WARNING_LEVELS: Record<string, string> = {
  waspada: 'Waspada',
  kritis: 'Kritis',
}

export const PICKUP_STATUSES = [
  { value: 'pending', label: 'Belum masuk nota' },
  { value: 'invoiced', label: 'Sudah masuk nota' },
]

export function eventTypeLabel(value: string): string {
  return EVENT_TYPES.find((item) => item.value === value)?.label ?? value
}

export function eventStatusLabel(value: string): string {
  return EVENT_STATUSES.find((item) => item.value === value)?.label ?? value
}

export function feedTypeLabel(value: string): string {
  return FEED_TYPES.find((item) => item.value === value)?.label ?? value
}
