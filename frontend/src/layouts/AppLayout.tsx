import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bird,
  CalendarDays,
  ChevronDown,
  Egg,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Skull,
  TriangleAlert,
  Truck,
  Wheat,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useApi } from '../hooks/useApi'
import type { AppSetting } from '../types'
import { cn } from '../utils/cn'
import { formatDateLong } from '../utils/date'
import { usePageTitle } from '../components/ProtectedRoute'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/produksi': 'Produksi Telur',
  '/penjualan': 'Penjualan PT',
  '/pakan': 'Manajemen Pakan',
  '/populasi': 'Populasi Burung',
  '/kematian': 'Pencatatan Kematian',
  '/kalender': 'Kalender Kandang',
  '/warning': 'Warning',
  '/laporan': 'Laporan & Grafik',
  '/pengaturan': 'Pengaturan',
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const title = pageTitles[location.pathname] ?? 'Manajemen Puyuh'
  usePageTitle(title)

  const { data: settings } = useApi<AppSetting[]>('/settings')
  const { data: warningCounts, reload: reloadWarnings } = useApi<{ open: number; critical: number }>(
    '/warnings/counts',
  )

  useEffect(() => {
    const interval = window.setInterval(reloadWarnings, 120000)
    return () => window.clearInterval(interval)
  }, [reloadWarnings])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const farmName = settings?.find((item) => item.key === 'farm_name')?.value ?? 'Manajemen Puyuh'

  const groups: NavGroup[] = [
    {
      label: 'Ringkasan',
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/laporan', label: 'Laporan & Grafik', icon: BarChart3 },
      ],
    },
    {
      label: 'Operasional',
      items: [
        { to: '/produksi', label: 'Produksi Telur', icon: Egg },
        { to: '/penjualan', label: 'Penjualan PT', icon: Truck },
        { to: '/pakan', label: 'Manajemen Pakan', icon: Wheat },
        { to: '/populasi', label: 'Populasi Burung', icon: Bird },
        { to: '/kematian', label: 'Pencatatan Kematian', icon: Skull },
      ],
    },
    {
      label: 'Monitoring',
      items: [
        { to: '/kalender', label: 'Kalender Kandang', icon: CalendarDays },
        { to: '/warning', label: 'Warning', icon: TriangleAlert, badge: warningCounts?.open ?? 0 },
      ],
    },
    {
      label: 'Sistem',
      items: [{ to: '/pengaturan', label: 'Pengaturan', icon: Settings }],
    },
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-40 bg-stone-950/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col bg-gradient-to-b from-[#0d2f25] via-[#0a261e] to-[#071b15] text-emerald-50 transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 ring-1 ring-emerald-300/20">
            <Bird className="h-6 w-6 text-emerald-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400/70">
              Manajemen Kandang
            </p>
            <p className="truncate text-sm font-semibold text-white">{farmName}</p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-emerald-200/60 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 no-scrollbar">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/35">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-emerald-400/15 text-white ring-1 ring-inset ring-emerald-300/10'
                            : 'text-emerald-100/65 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn(
                              'h-[18px] w-[18px] shrink-0',
                              isActive ? 'text-emerald-300' : 'text-emerald-200/50',
                            )}
                          />
                          <span className="flex-1">{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="min-w-5 rounded-full bg-amber-400/90 px-1.5 py-0.5 text-center text-[10px] font-bold text-amber-950">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="rounded-xl bg-white/[0.04] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-200">
                {user?.name?.slice(0, 2).toUpperCase() ?? 'PY'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{user?.name}</p>
                <p className="truncate text-[10px] text-emerald-100/45">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Keluar"
                className="rounded-lg p-1.5 text-emerald-200/50 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-3 px-1 text-center text-[9px] font-medium tracking-wide text-emerald-100/25">
            Puyuh Manager · v1.0
          </p>
        </div>
      </aside>

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-[#f7f7f4]/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-stone-200 bg-white p-2 text-stone-600 shadow-sm lg:hidden"
              aria-label="Buka menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                Manajemen Kandang
              </p>
              <h1 className="truncate text-sm font-semibold text-stone-800">{title}</h1>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-[11px] font-medium text-stone-500">{formatDateLong(new Date().toISOString())}</p>
                <p className="text-[10px] text-stone-400">Waktu Indonesia Barat</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/pengaturan')}
                className="flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1 pl-1 pr-2.5 shadow-sm transition hover:border-stone-300"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">
                  {user?.name?.slice(0, 2).toUpperCase() ?? 'PY'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>

        <footer className="mx-auto max-w-[1500px] px-4 pb-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/70 pt-4 text-[11px] text-stone-400">
            <p>© {new Date().getFullYear()} {farmName}. Pencatatan & pemantauan usaha telur puyuh.</p>
            <p className="flex items-center gap-1.5">
              <Package className="h-3 w-3" /> Data tersimpan di database
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
