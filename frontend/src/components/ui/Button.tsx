import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'amber'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-emerald-700 text-white shadow-sm shadow-emerald-900/15 hover:bg-emerald-800 focus-visible:outline-emerald-700 disabled:bg-emerald-700/60',
  secondary:
    'bg-white text-stone-700 border border-stone-200 shadow-sm hover:bg-stone-50 hover:text-stone-900 focus-visible:outline-stone-400',
  outline:
    'border border-emerald-200 bg-emerald-50/40 text-emerald-800 hover:bg-emerald-50 focus-visible:outline-emerald-600',
  ghost:
    'text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-stone-400',
  danger:
    'bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:outline-rose-600 disabled:bg-rose-600/60',
  amber:
    'bg-amber-500 text-amber-950 shadow-sm hover:bg-amber-400 focus-visible:outline-amber-500',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg justify-center',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}
