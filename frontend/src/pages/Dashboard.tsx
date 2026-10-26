import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bird,
  Egg,
  PackageCheck,
  Wallet,
  AlertTriangle,
  TrendingUp,
  PlusCircle,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { api } from '../services/api';
import type { DashboardSummary, ProductionTrendPoint } from '../types';

export const Dashboard: React.FC = () => {
  const { data: summary, isLoading: loadingSummary } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/dashboard/summary'),
  });

  const { data: trends, isLoading: loadingTrends } = useQuery<ProductionTrendPoint[]>({
    queryKey: ['production-trends'],
    queryFn: () => api.get('/reports/production-trends'),
  });

  const formatNumber = (val?: string | number) => {
    if (!val) return '0';
    const n = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('id-ID').format(n);
  };

  const formatRupiah = (val?: string | number) => {
    if (!val) return 'Rp 0';
    const n = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(n);
  };

  const eggReadyCount = summary?.egg_stock_ready ? parseFloat(summary.egg_stock_ready.toString()) : 0;
  const eggRacks = Math.floor(eggReadyCount / 30);
  const eggRemain = eggReadyCount % 30;

  return (
    <div className="space-y-6">
      {/* Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Operasional</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ringkasan populasi, produksi telur, dan keuangan peternakan puyuh secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/production"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all"
          >
            <PlusCircle size={16} />
            <span>Panen Telur</span>
          </Link>
          <Link
            to="/sales"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all"
          >
            <ArrowUpRight size={16} />
            <span>Penjualan</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Populasi Puyuh Aktif */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Populasi Aktif</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bird size={20} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900">
              {loadingSummary ? '...' : formatNumber(summary?.active_population)} <span className="text-sm font-semibold text-slate-500">ekor</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Tersebar di <span className="font-semibold text-slate-700">{summary?.total_coops || 0} kandang</span>
            </p>
          </div>
        </div>

        {/* Produksi Hari Ini */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Panen Hari Ini</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Egg size={20} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900">
              {loadingSummary ? '...' : formatNumber(summary?.today_saleable_eggs)}{' '}
              <span className="text-sm font-semibold text-slate-500">layak jual</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Total diambil: {formatNumber(summary?.today_production_eggs)} btr (Pecah: {formatNumber(summary?.today_damaged_eggs)} btr)
            </p>
          </div>
        </div>

        {/* Stok Telur Siap Jual */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stok Telur Layak Jual</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <PackageCheck size={20} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900">
              {loadingSummary ? '...' : formatNumber(eggReadyCount)}{' '}
              <span className="text-sm font-semibold text-slate-500">butir</span>
            </h3>
            <p className="text-xs text-emerald-700 font-medium mt-1">
              ≈ {eggRacks} Rak {eggRemain > 0 ? `+ ${eggRemain} butir` : ''}
            </p>
          </div>
        </div>

        {/* Kas & Keuangan */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Kas Bersih</span>
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Wallet size={20} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900">
              {loadingSummary ? '...' : formatRupiah(summary?.total_cash_balance)}
            </h3>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
              <span className="text-emerald-700">Piutang: {formatRupiah(summary?.total_receivables)}</span>
              <span className="text-red-600">Utang: {formatRupiah(summary?.total_payables)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Alert if items low in stock */}
      {summary && summary.low_stock_items_count > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-600 shrink-0" size={20} />
            <span className="text-sm font-semibold">
              Peringatan: Terdapat {summary.low_stock_items_count} barang persediaan (pakan/obat) yang telah mencapai batas stok minimum!
            </span>
          </div>
          <Link
            to="/inventory"
            className="text-xs font-bold text-amber-900 underline hover:text-amber-800 shrink-0"
          >
            Lihat Persediaan
          </Link>
        </div>
      )}

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production Trends Chart */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp size={18} className="text-amber-500" />
                Tren Produksi Telur (7 Hari Terakhir)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Grafik hasil telur layak jual harian</p>
            </div>
            <Link
              to="/analytics"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition-colors"
            >
              <span>Analisis & FCR</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="h-64 sm:h-72 w-full">
            {loadingTrends ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Memuat grafik...
              </div>
            ) : trends && trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEggs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={(val) => {
                      const parts = val.split('-');
                      return `${parts[2]}/${parts[1]}`;
                    }}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    labelFormatter={(val) => `Tanggal: ${val}`}
                    formatter={(val: any) => [`${val} butir`, 'Layak Jual']}
                  />
                  <Area
                    type="monotone"
                    dataKey="saleable_eggs"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorEggs)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Belum ada data produksi dalam 7 hari terakhir.
              </div>
            )}
          </div>
        </div>

        {/* Quick Summary Panels */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Aksi Cepat Harian</h3>
            <div className="space-y-2">
              <Link
                to="/production"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-amber-50 hover:border-amber-200 border border-slate-100 transition-all text-xs font-semibold text-slate-700"
              >
                <span className="flex items-center gap-2.5">
                  <Egg size={16} className="text-amber-600" />
                  Input Panen Telur Sore/Pagi
                </span>
                <ArrowUpRight size={15} className="text-slate-400" />
              </Link>

              <Link
                to="/inventory"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-100 transition-all text-xs font-semibold text-slate-700"
              >
                <span className="flex items-center gap-2.5">
                  <PackageCheck size={16} className="text-blue-600" />
                  Catat Pemakaian Pakan Harian
                </span>
                <ArrowUpRight size={15} className="text-slate-400" />
              </Link>

              <Link
                to="/coops-flocks"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-red-50 hover:border-red-200 border border-slate-100 transition-all text-xs font-semibold text-slate-700"
              >
                <span className="flex items-center gap-2.5">
                  <Bird size={16} className="text-red-600" />
                  Catat Kematian / Pindah Kandang
                </span>
                <ArrowUpRight size={15} className="text-slate-400" />
              </Link>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">Status Penyimpanan Data</h4>
            <p className="text-sm font-bold mt-1 text-slate-100">JSON File Database Aktif</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Seluruh transaksi tersimpan aman di berkas JSON terstruktur backend. Siap diekspor atau dialihkan ke PostgreSQL kelak.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
