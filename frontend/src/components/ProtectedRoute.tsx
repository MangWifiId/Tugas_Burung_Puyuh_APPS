import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { token, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f4]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
          </div>
          <p className="text-sm text-stone-500">Menyiapkan aplikasi...</p>
        </div>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children ? <>{children}</> : <Outlet />
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Manajemen Puyuh`
  }, [title])
}
