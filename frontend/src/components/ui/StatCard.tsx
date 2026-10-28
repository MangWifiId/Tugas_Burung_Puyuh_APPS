import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

type Tone = 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'stone'

const toneStyles: Record<Tone, { icon: string; ring: string }> = {
  emerald: { icon: 'bg-emerald-50 text-emerald-700', ring: 'ring-emerald-600/5' },
  amber: { icon: 'bg-amber-50 text-amber-700', ring: 'ring-amber-600/5' },
  rose: { icon: 'bg-rose-50 text-rose-600', ring: 'ring-rose-600/5' },
  sky: { icon: 'bg-sky-50 text-sky-700', ring: 'ring-sky-600/5' },
  violet: { icon: 'bg-violet-50 text-violet-700', ring: 'ring-violet-600/5' },
  stone: { icon: 'bg-stone-100 text-stone-600', ring: 'ring-stone-500/5' },
}

interface StatCardProps {
  label: string
  value: string
  hint?: ReactNode
  icon: LucideIcon
  tone?: Tone
  className?: string
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'emerald', className }: StatCardProps) {
  const styles = toneStyles[tone]
  return (
    <div
      className={cn(
        'rounded-2xl border border-stone-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ring-1 ring-inset',
        styles.ring,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">{label}</p>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', styles.icon)}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-stone-900">{value}</p>
      {hint && <div className="mt-1 text-xs leading-relaxed text-stone-400">{hint}</div>}
    </div>
  )
}
