import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Home,
  Egg,
  Package,
  ShoppingCart,
  Truck,
  Wallet,
  TrendingUp,
  X,
  Feather,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navGroups: Array<{
  label: string;
  items: Array<{ to: string; label: string; icon: React.ElementType }>;
}> = [
  {
    label: 'Ringkasan',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/analytics', label: 'Analisis & FCR', icon: TrendingUp },
    ],
  },
  {
    label: 'Operasional',
    items: [
      { to: '/coops-flocks', label: 'Kandang & Populasi', icon: Home },
      { to: '/production', label: 'Produksi Telur', icon: Egg },
      { to: '/inventory', label: 'Pakan & Persediaan', icon: Package },
    ],
  },
  {
    label: 'Bisnis',
    items: [
      { to: '/sales', label: 'Penjualan Telur', icon: ShoppingCart },
      { to: '/purchasing', label: 'Pembelian Pakan', icon: Truck },
      { to: '/finance', label: 'Keuangan & Kas', icon: Wallet },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/5 bg-slate-950 text-white transition-transform duration-300 ease-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-amber-500/15 via-amber-500/0 to-transparent" />

        {/* Branding */}
        <div className="relative flex h-[4.5rem] items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20">
              <Feather size={21} strokeWidth={2.4} />
            </div>
            <div>
              <h1 className="text-[15px] font-extrabold leading-none tracking-tight text-white">
                QuailFarm
              </h1>
              <span className="mt-1 block text-[11px] font-medium text-amber-400/90">
                Manajemen Puyuh
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                          isActive
                            ? 'bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                            : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-amber-400 transition-all duration-200 ${
                              isActive ? 'opacity-100' : 'opacity-0'
                            }`}
                          />
                          <Icon
                            size={18}
                            className={
                              isActive
                                ? 'text-amber-400'
                                : 'text-slate-500 transition-colors group-hover:text-slate-300'
                            }
                          />
                          <span>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="relative px-3 pb-4">
          <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-3.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <p className="text-[11px] font-bold text-slate-200">Sistem Berjalan Normal</p>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Penyimpanan JSON aktif · Versi 1.0.0
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
