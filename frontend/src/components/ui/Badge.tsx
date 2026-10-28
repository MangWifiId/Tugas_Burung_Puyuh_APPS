import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type Tone = 'emerald' | 'amber' | 'rose' | 'stone' | 'sky' | 'violet'

const tones: Record<Tone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/10',
  stone: 'bg-stone-100 text-stone-600 ring-stone-500/10',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/10',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/10',
}

interface BadgeProps {
  tone?: Tone
  children: ReactNode
  className?: string
  dot?: boolean
}

export function Badge({ tone = 'stone', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
