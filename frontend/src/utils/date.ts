const DAY_MS = 24 * 60 * 60 * 1000

export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value
  if (value.length <= 10) {
    return new Date(`${value}T00:00:00`)
  }
  return new Date(value)
}

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDaysISO(value: string, days: number): string {
  const date = toDate(value)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function startOfMonthISO(value: string = todayISO()): string {
  const date = toDate(value)
  return toISODate(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function endOfMonthISO(value: string = todayISO()): string {
  const date = toDate(value)
  return toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export function startOfWeekISO(value: string = todayISO()): string {
  const date = toDate(value)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return toISODate(date)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS) + 1
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(toDate(value))
}

export function formatDateLong(value: string | null | undefined): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(toDate(value))
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(toDate(value))
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(toDate(value))
}

export function weekdayName(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(toDate(value))
}

export function monthLabel(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(toDate(value))
}

export function isPickupDay(value: string): boolean {
  const day = toDate(value).getDay()
  return day === 1 || day === 4
}

export function buildMonthGrid(monthISO: string): Array<{ date: string; inMonth: boolean }> {
  const base = toDate(startOfMonthISO(monthISO))
  const firstWeekday = (base.getDay() + 6) % 7
  const gridStart = new Date(base)
  gridStart.setDate(base.getDate() - firstWeekday)
  const cells = []
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    cells.push({
      date: toISODate(date),
      inMonth: date.getMonth() === base.getMonth(),
    })
  }
  return cells
}

export function relativeDays(value: string): string {
  const diff = Math.round(
    (toDate(value).getTime() - toDate(todayISO()).getTime()) / DAY_MS,
  )
  if (diff === 0) return 'Hari ini'
  if (diff === 1) return 'Besok'
  if (diff === -1) return 'Kemarin'
  if (diff > 1) return `${diff} hari lagi`
  return `${Math.abs(diff)} hari lalu`
}
