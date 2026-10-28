import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '../components/ui/Button'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup dialog"
            className="absolute inset-0 bg-stone-950/45 backdrop-blur-[2px]"
            onClick={() => close(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex gap-4">
              <div
                className={
                  options.danger
                    ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600'
                    : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600'
                }
              >
                <TriangleAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-900">{options.title}</h2>
                {options.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
                    {options.description}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => close(false)}>
                {options.cancelLabel ?? 'Batal'}
              </Button>
              <Button
                variant={options.danger ? 'danger' : 'primary'}
                onClick={() => close(true)}
              >
                {options.confirmLabel ?? 'Lanjutkan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm harus dipakai di dalam ConfirmProvider')
  }
  return context
}
