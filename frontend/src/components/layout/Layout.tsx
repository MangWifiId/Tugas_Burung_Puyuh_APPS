import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

const currentYear = new Date().getFullYear();

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen flex-col lg:pl-72">
        <Navbar onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>

        <footer className="mx-auto w-full max-w-7xl px-4 pb-6 text-[11px] font-medium text-slate-400 sm:px-6 lg:px-8">
          © {currentYear} QuailFarm · Sistem Manajemen Peternakan Puyuh
        </footer>
      </div>
    </div>
  );
};
