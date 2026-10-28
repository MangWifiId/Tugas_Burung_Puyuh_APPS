import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface SectionCardProps {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <Card className={className}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-tight text-stone-900">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-stone-400">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </Card>
  )
}
