import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Activity,
  Wheat,
  Egg,
  AlertTriangle,
  CheckCircle2,
  Info,
  DollarSign,
  HelpCircle,
  BarChart3,
  Scale,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { api } from '../services/api';
import type { PerformanceAnalyticsResponse, Coop } from '../types';

const todayISO = new Date().toISOString().slice(0, 10);
const todayEpoch = Date.now();

export const Analytics: React.FC = () => {
  const [daysFilter, setDaysFilter] = useState<number>(14);
  const [selectedCoopId, setSelectedCoopId] = useState<string>('');

  // Fetch list coops for dropdown filter
  const { data: coops } = useQuery<Coop[]>({
    queryKey: ['coops-list'],
    queryFn: () => api.get('/coops'),
  });

  // Calculate dates based on daysFilter
  const endDateStr = todayISO;
  const startDateStr = new Date(
    todayEpoch - (daysFilter - 1) * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const queryParams = new URLSearchParams({
    start_date: startDateStr,
    end_date: endDateStr,
    ...(selectedCoopId ? { coop_id: selectedCoopId } : {}),
  }).toString();

  const { data: analytics, isLoading } = useQuery<PerformanceAnalyticsResponse>({
    queryKey: ['performance-analytics', daysFilter, selectedCoopId],
    queryFn: () => api.get(`/analytics/performance?${queryParams}`),
  });

  const formatNumber = (val?: string | number) => {
    if (val === undefined || val === null) return '0';
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

  const summary = analytics?.summary;
  const insights = analytics?.insights || [];
  const dailyTrends = analytics?.daily_trends || [];
  const coopComparison = analytics?.coop_comparison || [];

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
              <TrendingUp size={22} />
            </span>
            <h1 className="page-title">
              Analisis Performa & FCR Puyuh
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Pantau efisiensi pakan (FCR), tingkat bertelur (Hen-Day %), konsumsi harian, dan HPP telur per butir.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Preset Buttons */}
          <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1 shadow-sm">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDaysFilter(d)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  daysFilter === d
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {d} Hari
              </button>
            ))}
          </div>

          {/* Coop Dropdown Filter */}
          <select
            value={selectedCoopId}
            onChange={(e) => setSelectedCoopId(e.target.value)}
            className="text-xs font-medium bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700"
          >
            <option value="">Semua Kandang</option>
            {coops?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Hen-Day (Laying Rate) */}
        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Hen-Day (Laying Rate)
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Egg size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-extrabold text-slate-900">
                {isLoading ? '...' : `${summary?.hen_day_pct || 0}%`}
              </h3>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  (summary?.hen_day_pct || 0) >= 80
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : (summary?.hen_day_pct || 0) >= 70
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {(summary?.hen_day_pct || 0) >= 80 ? 'Optimal' : (summary?.hen_day_pct || 0) >= 70 ? 'Normal' : 'Perlu Evaluasi'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Total {formatNumber(summary?.total_eggs_produced)} butir ({formatNumber(Math.floor((summary?.total_eggs_produced || 0) / 30))} rak) dalam {analytics?.period.days_count || daysFilter} hari.
            </p>
          </div>
        </div>

        {/* 2. FCR (Feed Conversion Ratio) */}
        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              FCR Pakan
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Scale size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-extrabold text-slate-900">
                {isLoading ? '...' : summary?.fcr_per_100_eggs || 0}
              </h3>
              <span className="text-xs font-semibold text-slate-500">kg/100 butir</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
              <span>Setara per Rak:</span>
              <span className="font-bold text-slate-700">{summary?.fcr_per_tray || 0} kg / rak (30 butir)</span>
            </div>
          </div>
        </div>

        {/* 3. Konsumsi Pakan Harian (Daily Intake) */}
        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Konsumsi Pakan Rata-rata
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wheat size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-extrabold text-slate-900">
                {isLoading ? '...' : summary?.daily_feed_intake_g || 0}
              </h3>
              <span className="text-xs font-semibold text-slate-500">gram/ekor/hari</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Total pakan habis: <span className="font-semibold text-slate-800">{formatNumber(summary?.total_feed_kg)} kg</span> (Standar: 22-25g)
            </p>
          </div>
        </div>

        {/* 4. HPP Pakan & Margin Telur */}
        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              HPP Pakan / Butir
            </span>
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-extrabold text-slate-900">
                {isLoading ? '...' : formatRupiah(summary?.feed_cost_per_egg)}
              </h3>
              <span className="text-xs font-semibold text-slate-500">/ butir</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
              <span>Margin Kotor:</span>
              <span className="font-bold text-emerald-600">
                +{summary?.gross_margin_pct || 0}% ({formatRupiah(summary?.gross_margin_per_egg)}/btr)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ringkasan Sekunder: Telur Rusak, Biaya Pakan & Mortalitas */}
      <div className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block uppercase">Telur Rusak / Retak</span>
          <span className="text-sm font-bold text-slate-800 mt-0.5 block">
            {formatNumber(summary?.total_damaged_eggs)} butir ({summary?.damaged_rate_pct || 0}%)
          </span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block uppercase">Total Biaya Pakan</span>
          <span className="text-sm font-bold text-slate-800 mt-0.5 block">
            {formatRupiah(summary?.total_feed_cost)}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block uppercase">Harga Jual Rata-rata</span>
          <span className="text-sm font-bold text-slate-800 mt-0.5 block">
            {formatRupiah(summary?.avg_egg_price)} / butir
          </span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block uppercase">Kematian (Mortalitas)</span>
          <span className="text-sm font-bold text-slate-800 mt-0.5 block">
            {summary?.total_mortality || 0} ekor ({summary?.mortality_rate_pct || 0}%)
          </span>
        </div>
      </div>

      {/* Actionable Smart Insights Card */}
      {insights.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-50 border border-amber-200/60 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Insight & Evaluasi Cerdas Peternakan</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-white/90 border border-slate-200/60 shadow-xs"
              >
                <div className="shrink-0 mt-0.5">
                  {item.type === 'success' && <CheckCircle2 size={18} className="text-emerald-500" />}
                  {item.type === 'warning' && <AlertTriangle size={18} className="text-amber-500" />}
                  {item.type === 'info' && <Info size={18} className="text-blue-500" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{item.title}</h4>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Produksi Telur vs Hen-Day % */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Tren Produksi Telur & Hen-Day (%)</h3>
              <p className="text-xs text-slate-500">Panen harian (butir) dibandingkan rasio bertelur</p>
            </div>
            <span className="p-2 rounded-xl bg-slate-50 text-slate-600">
              <BarChart3 size={18} />
            </span>
          </div>

          <div className="h-72 w-full">
            {dailyTrends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada data rekaman panen pada rentang tanggal ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => val.slice(5)}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    formatter={(val: any, name: any) => {
                      if (name === 'Hen-Day (%)') return [`${val}%`, name];
                      return [formatNumber(val), name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="saleable_eggs"
                    name="Telur Layak Jual (Btr)"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="damaged_eggs"
                    name="Telur Rusak (Btr)"
                    fill="#f87171"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="hen_day_pct"
                    name="Hen-Day (%)"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Pakan Terpakai vs FCR */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Tren Pakan & FCR (Feed Conversion Ratio)</h3>
              <p className="text-xs text-slate-500">Jumlah pakan habis (kg) vs FCR per 100 butir</p>
            </div>
            <span className="p-2 rounded-xl bg-slate-50 text-slate-600">
              <Activity size={18} />
            </span>
          </div>

          <div className="h-72 w-full">
            {dailyTrends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada data rekaman pakan pada rentang tanggal ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => val.slice(5)}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <YAxis
                    yAxisId="left"
                    unit=" kg"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 4]}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    formatter={(val: any, name: any) => {
                      if (name === 'FCR per 100 Btr') return [`${val} kg`, name];
                      return [`${val} kg`, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="feed_kg"
                    name="Pakan Terpakai (kg)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="fcr_per_100"
                    name="FCR per 100 Btr"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Komparasi Efisiensi Antar Kandang */}
      <div className="table-shell">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">Perbandingan Efisiensi Antar Kandang</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluasi kandang yang paling efisien dalam konversi pakan dan produksi telur.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Kandang</th>
                <th className="py-3 px-4">Populasi</th>
                <th className="py-3 px-4">Panen Telur</th>
                <th className="py-3 px-4">Hen-Day (%)</th>
                <th className="py-3 px-4">Pakan Habis</th>
                <th className="py-3 px-4">Pakan / Ekor</th>
                <th className="py-3 px-4">FCR (kg/100 btr)</th>
                <th className="py-3 px-4">HPP Pakan</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {coopComparison.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Belum ada data kandang yang tersedia.
                  </td>
                </tr>
              ) : (
                coopComparison.map((c) => (
                  <tr key={c.coop_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {c.coop_name}
                      <span className="block text-[11px] font-normal text-slate-400">{c.coop_code}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900">{formatNumber(c.population)}</span>
                      <span className="text-slate-400 text-[11px]"> / {formatNumber(c.capacity)}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900">{formatNumber(c.eggs_produced)}</span> butir
                      <span className="block text-[11px] text-slate-400">
                        {Math.floor(c.eggs_produced / 30)} rak
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold">
                      <span
                        className={
                          c.hen_day_pct >= 80
                            ? 'text-emerald-600'
                            : c.hen_day_pct >= 70
                            ? 'text-blue-600'
                            : 'text-amber-600'
                        }
                      >
                        {c.hen_day_pct}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {formatNumber(c.feed_kg)} kg
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {c.feed_per_bird_g} g/hari
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {c.fcr_per_100}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800">
                      {formatRupiah(c.cost_per_egg)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          c.status === 'optimal'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'good'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : c.status === 'warning'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.status_label}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standar Acuan Teknis Puyuh Petelur (Benchmark Reference Guide) */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <HelpCircle size={18} className="text-amber-500" />
          <span>Panduan Standar Teknis Budidaya Puyuh Petelur (Coturnix japonica)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-600 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-bold text-slate-800 block text-xs">Hen-Day (Laying Rate)</span>
            <p className="text-[11px] text-slate-500">
              <strong>Peak (Puncak):</strong> 80% – 90% pada umur 8–24 minggu. Standar ekonomis minimum adalah 70%.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-bold text-slate-800 block text-xs">Konsumsi Pakan Ransum</span>
            <p className="text-[11px] text-slate-500">
              <strong>Ideal:</strong> 22 – 25 gram per ekor per hari (Protein kasar ransum disarankan 20% – 22%).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-bold text-slate-800 block text-xs">Target Nilai FCR</span>
            <p className="text-[11px] text-slate-500">
              <strong>Efisien:</strong> 2.3 – 2.8 kg pakan per 100 butir telur (setara 0.70 – 0.85 kg per rak 30 butir).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-bold text-slate-800 block text-xs">Toleransi Telur Rusak</span>
            <p className="text-[11px] text-slate-500">
              <strong>Maksimal:</strong> &lt; 2.5%. Bila lebih dari 3%, pastikan tambahan grit kalsium/vitamin D3 dan alas telur miring landai.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Analytics;
