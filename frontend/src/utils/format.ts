const numberFormatter = new Intl.NumberFormat('id-ID')
const decimalFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })
const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0'
  return numberFormatter.format(value)
}

export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0'
  return decimalFormatter.format(value)
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Rp0'
  return currencyFormatter.format(value).replace('Rp', 'Rp ')
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${decimalFormatter.format(value / 1_000_000)} jt`
  if (value >= 1_000) return `${decimalFormatter.format(value / 1_000)} rb`
  return formatNumber(value)
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0%'
  return `${value.toFixed(digits).replace('.', ',')}%`
}
