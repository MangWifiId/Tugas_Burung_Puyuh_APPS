import type { ReactNode } from 'react'
import { Card } from '../ui/Card'
import { cn } from '../../utils/cn'

interface ChartCardProps {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function ChartCard({ title, description, action, children, className, bodyClassName }: ChartCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-stone-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-stone-400">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn('px-2 pb-4 pt-4', bodyClassName)}>{children}</div>
    </Card>
  )
}
