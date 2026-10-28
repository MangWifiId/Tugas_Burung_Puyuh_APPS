import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export function Table({ children, className, minWidth = 'min-w-[720px]' }: { children: ReactNode; className?: string; minWidth?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-left text-sm', minWidth, className)}>
        {children}
      </table>
    </div>
  )
}

export function Th({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'whitespace-nowrap border-b border-stone-100 bg-stone-50/60 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-stone-400',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function Td({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-stone-100 px-5 py-3.5 align-middle text-stone-600', className)} {...props}>
      {children}
    </td>
  )
}
