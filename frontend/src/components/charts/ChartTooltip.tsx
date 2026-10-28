import { formatCurrency, formatNumber } from '../../utils/format'

interface TooltipEntry {
  name?: string | number
  value?: number | string
  color?: string
  dataKey?: string | number
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  valueFormatter?: (value: number) => string
}

export function ChartTooltip({ active, payload, label, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[150px] rounded-xl border border-stone-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label !== undefined && (
        <p className="mb-1.5 font-semibold text-stone-700">{String(label)}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const value = Number(entry.value ?? 0)
          return (
            <div key={`${entry.dataKey ?? index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-stone-500">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color ?? '#059669' }}
                />
                {String(entry.name ?? '')}
              </span>
              <span className="font-semibold text-stone-800">
                {valueFormatter ? valueFormatter(value) : formatNumber(value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const currencyTooltip = (value: number) => formatCurrency(value)
export const numberTooltip = (value: number) => formatNumber(value)
