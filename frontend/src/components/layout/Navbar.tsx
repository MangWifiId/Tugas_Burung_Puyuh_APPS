import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/useAuth';

interface NavbarProps {
  onOpenSidebar: () => void;
}

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/analytics': 'Analisis & FCR',
  '/coops-flocks': 'Kandang & Populasi',
  '/production': 'Produksi Telur',
  '/inventory': 'Pakan & Persediaan',
  '/sales': 'Penjualan Telur',
  '/purchasing': 'Pembelian Pakan',
  '/finance': 'Keuangan & Kas',
};

const todayLabel = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date());

export const Navbar: React.FC<NavbarProps> = ({ onOpenSidebar }) => {
  const { user, farm, logout } = useAuth();
  const location = useLocation();

  const pageTitle = pageTitles[location.pathname] ?? 'Dashboard';
  const displayName = user?.name || 'Pemilik';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="flex h-[4.5rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Buka menu"
          >
            <Menu size={22} />
          </button>

          <div className="min-w-0">
            <div className="hidden items-center gap-1.5 text-[11px] font-semibold text-slate-400 sm:flex">
              <span>QuailFarm</span>
              <ChevronRight size={12} />
              <span className="truncate text-slate-500">{farm?.name || 'Peternakan Puyuh'}</span>
            </div>
            <h2 className="truncate text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
              {pageTitle}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 lg:inline-flex">
            {todayLabel}
          </span>

          <div className="hidden h-6 w-px bg-slate-200 sm:block" />

          <div className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 shadow-sm sm:pr-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[11px] font-extrabold text-slate-950">
              {initials || 'PF'}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="max-w-[9rem] truncate text-[12px] font-bold text-slate-800">
                {displayName}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                {user?.role || 'Owner'}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Keluar / Logout"
            className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut size={19} />
          </button>
        </div>
      </div>
    </header>
  );
};
