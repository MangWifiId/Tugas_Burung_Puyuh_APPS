import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'
import { formatNumber } from '../../utils/format'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
}

export function Pagination({ page, totalPages, total, onChange }: PaginationProps) {
  if (total === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-3">
      <p className="text-xs text-stone-400">
        Total <span className="font-semibold text-stone-600">{formatNumber(total)}</span> data
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          icon={<ChevronLeft className="h-4 w-4" />}
        >
          Sebelumnya
        </Button>
        <span className="px-1 text-xs font-medium text-stone-500">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Berikutnya
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
