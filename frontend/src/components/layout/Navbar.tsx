import React from 'react';
import { Menu, LogOut, UserCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  onOpenSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSidebar }) => {
  const { user, farm, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          aria-label="Buka menu"
        >
          <Menu size={22} />
        </button>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-800">
            {farm?.name || 'Peternakan Puyuh Barokah'}
          </h2>
          <p className="text-[11px] text-slate-600 hidden sm:block">
            {farm?.address || 'Jl. Peternakan Mandiri No. 12'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700">
          <UserCircle2 size={18} className="text-amber-600" />
          <span className="font-semibold hidden sm:inline">{user?.name || 'Pemilik'}</span>
          <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold bg-amber-100 text-amber-800 rounded">
            {user?.role || 'Owner'}
          </span>
        </div>

        <button
          onClick={logout}
          title="Keluar / Logout"
          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};
