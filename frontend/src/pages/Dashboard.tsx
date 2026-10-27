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
  ArrowDownRight,
  Database,
  Sparkles,
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

const navActions = [
  {
    to: '/production',
    label: 'Input panen telur',
    hint: 'Catat hasil pagi / sore',
    icon: Egg,
    tone: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100',
  },
  {
    to: '/inventory',
    label: 'Catat pemakaian pakan',
    hint: 'Stok & konsumsi harian',
    icon: PackageCheck,
    tone: 'bg-sky-50 text-sky-600 group-hover:bg-sky-100',
  },
  {
    to: '/coops-flocks',
    label: 'Mutasi populasi',
    hint: 'Kematian, afkir, pindah kandang',
    icon: Bird,
    tone: 'bg-rose-50 text-rose-600 group-hover:bg-rose-100',
  },
];

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

  const eggReadyCount = summary?.egg_stock_ready
    ? parseFloat(summary.egg_stock_ready.toString())
    : 0;
  const eggTrays = Math.floor(eggReadyCount / 30);
  const eggRemain = eggReadyCount % 30;
  const trayProgress = eggRemain > 0 ? (eggRemain / 30) * 100 : eggTrays > 0 ? 100 : 0;

  const metrics = [
    {
      label: 'Populasi Aktif',
      value: loadingSummary ? '—' : formatNumber(summary?.active_population),
      unit: 'ekor',
      icon: Bird,
      tone: 'bg-sky-50 text-sky-600',
      note: `Tersebar di ${summary?.total_coops || 0} kandang`,
    },
    {
      label: 'Panen Hari Ini',
      value: loadingSummary ? '—' : formatNumber(summary?.today_saleable_eggs),
      unit: 'layak jual',
      icon: Egg,
      tone: 'bg-amber-50 text-amber-600',
      note: `Total ${formatNumber(summary?.today_production_eggs)} btr · pecah ${formatNumber(
        summary?.today_damaged_eggs
      )} btr`,
    },
    {
      label: 'Stok Telur Layak Jual',
      value: loadingSummary ? '—' : formatNumber(eggReadyCount),
      unit: 'butir',
      icon: PackageCheck,
      tone: 'bg-emerald-50 text-emerald-600',
      note: `≈ ${eggTrays} rak${eggRemain > 0 ? ` + ${eggRemain} butir` : ''}`,
    },
    {
      label: 'Saldo Kas Bersih',
      value: loadingSummary ? '—' : formatRupiah(summary?.total_cash_balance),
      icon: Wallet,
      tone: 'bg-violet-50 text-violet-600',
      note: `Piutang ${formatRupiah(summary?.total_receivables)} · Utang ${formatRupiah(
        summary?.total_payables
      )}`,
      wide: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" />
            Ringkasan real-time
          </p>
          <h1 className="page-title mt-1.5">Dashboard Operasional</h1>
          <p className="page-subtitle max-w-xl">
            Pantau populasi, produksi telur, persediaan, dan kesehatan kas peternakan Anda
            dalam satu tampilan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/production" className="btn-primary">
            <PlusCircle size={16} />
            <span>Panen Telur</span>
          </Link>
          <Link to="/sales" className="btn-dark">
            <ArrowUpRight size={16} />
            <span>Penjualan</span>
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="stat-card">
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {metric.label}
                  </span>
                  <div className={`stat-icon shrink-0 ${metric.tone}`}>
                    <Icon size={19} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
                  <h3
                    className={`font-extrabold tracking-tight text-slate-900 ${
                      metric.wide ? 'text-[1.35rem]' : 'text-[1.6rem]'
                    }`}
                  >
                    {metric.value}
                  </h3>
                  {metric.unit && (
                    <span className="text-xs font-semibold text-slate-500">{metric.unit}</span>
                  )}
                </div>

                <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-slate-500">
                  {metric.note}
                </p>

                {metric.label === 'Stok Telur Layak Jual' && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                      style={{ width: `${Math.min(trayProgress, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Low stock alert */}
      {summary && summary.low_stock_items_count > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {summary.low_stock_items_count} item persediaan di bawah stok minimum
              </p>
              <p className="mt-0.5 text-xs text-amber-700/80">
                Segera lakukan pembelian pakan atau obat agar operasional tidak terhenti.
              </p>
            </div>
          </div>
          <Link to="/inventory" className="btn-secondary shrink-0 !border-amber-200 !text-amber-900">
            Lihat Persediaan
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      {/* Chart & side panel */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card p-5 sm:p-6 xl:col-span-2">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <TrendingUp size={16} />
                </span>
                Tren Produksi Telur
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Hasil telur layak jual 7 hari terakhir
              </p>
            </div>
            <Link
              to="/analytics"
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100"
            >
              Analisis & FCR
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="h-64 w-full sm:h-72">
            {loadingTrends ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500" />
                  Memuat grafik...
                </div>
              </div>
            ) : trends && trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEggs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val: string) => {
                      const parts = val.split('-');
                      return `${parts[2]}/${parts[1]}`;
                    }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ stroke: '#fcd34d', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                      padding: '10px 12px',
                      boxShadow: '0 20px 40px -12px rgba(15,23,42,0.4)',
                    }}
                    labelFormatter={(val) => `Tanggal: ${val}`}
                    formatter={(val) => [`${val} butir`, 'Layak Jual']}
                  />
                  <Area
                    type="monotone"
                    dataKey="saleable_eggs"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorEggs)"
                    activeDot={{ r: 4, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-slate-400">
                <Egg size={26} className="text-slate-300" />
                Belum ada data produksi 7 hari terakhir.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Aksi Cepat Harian</h3>
              <span className="badge-neutral">Hari ini</span>
            </div>
            <div className="space-y-2">
              {navActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition-all hover:border-slate-200 hover:bg-white hover:shadow-sm"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${action.tone}`}
                      >
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-slate-700">
                          {action.label}
                        </span>
                        <span className="block truncate text-[11px] text-slate-400">
                          {action.hint}
                        </span>
                      </span>
                    </span>
                    <ArrowUpRight
                      size={15}
                      className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-600"
                    />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5 text-white shadow-lg shadow-slate-900/10">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Database size={15} className="text-amber-400" />
                <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-400">
                  Status Penyimpanan
                </h4>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-100">JSON File Database Aktif</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Setiap transaksi ditulis secara atomik dan aman. Siap diekspor atau
                disinkronkan ke PostgreSQL kapan saja.
              </p>
              <div className="mt-4 flex items-center gap-4 border-t border-white/10 pt-3 text-[11px]">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Tersimpan
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <ArrowDownRight size={13} />
                  Backup harian
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
