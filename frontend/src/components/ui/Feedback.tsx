import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-emerald-600', className)} />
}

export function LoadingBlock({ label = 'Memuat data...', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-14 text-sm text-stone-400', className)}>
      <Spinner />
      {label}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-sm font-medium text-rose-600">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
        >
          Coba lagi
        </button>
      )}
    </div>
  )
}
