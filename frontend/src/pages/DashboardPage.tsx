import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Bird,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Egg,
  Plus,
  Skull,
  TriangleAlert,
  Wallet,
  Wheat,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { SectionCard } from '../components/ui/Card'
import { ChartCard } from '../components/charts/ChartCard'
import { ChartTooltip, currencyTooltip, numberTooltip } from '../components/charts/ChartTooltip'
import { CHART_COLORS, axisStyle, chartMargins, gridStroke } from '../components/charts/theme'
import { LoadingBlock, ErrorBlock } from '../components/ui/Feedback'
import { EmptyState } from '../components/ui/EmptyState'
import { useApi } from '../hooks/useApi'
import { api, getErrorMessage } from '../services/api'
import { useToast } from '../providers/ToastProvider'
import { usePageTitle } from '../components/ProtectedRoute'
import type { DashboardData } from '../types'
import {
  addDaysISO,
  endOfMonthISO,
  formatDate,
  formatDateLong,
  formatDateShort,
  relativeDays,
  startOfMonthISO,
  todayISO,
} from '../utils/date'
import { formatCurrency, formatDecimal, formatNumber, formatPercent } from '../utils/format'
import { cn } from '../utils/cn'
import { eventTypeLabel } from '../utils/constants'

const presets = [
  { key: '7', label: '7 hari', from: addDaysISO(todayISO(), -6), to: todayISO() },
  { key: '30', label: '30 hari', from: addDaysISO(todayISO(), -29), to: todayISO() },
  { key: 'month', label: 'Bulan ini', from: startOfMonthISO(), to: todayISO() },
  {
    key: 'lastmonth',
    label: 'Bulan lalu',
    from: startOfMonthISO(addDaysISO(startOfMonthISO(), -1)),
    to: endOfMonthISO(addDaysISO(startOfMonthISO(), -1)),
  },
]

export function DashboardPage() {
  usePageTitle('Dashboard')
  const today = todayISO()
  const [from, setFrom] = useState(addDaysISO(today, -29))
  const [to, setTo] = useState(today)
  const [activePreset, setActivePreset] = useState('30')
  const [ackingId, setAckingId] = useState<number | null>(null)
  const navigate = useNavigate()
  const toast = useToast()

  const { data, loading, error, reload } = useApi<DashboardData>('/dashboard', {
    from,
    to,
    group_by: 'day',
  })

  const charts = data?.charts ?? []
  const warnings = data?.recent_warnings ?? []
  const events = data?.upcoming_events ?? []
  const batches = data?.batches ?? []

  const productionTotal = useMemo(
    () => charts.reduce((total, point) => total + point.eggs, 0),
    [charts],
  )
  const soldTotal = useMemo(
    () => charts.reduce((total, point) => total + point.sales_eggs, 0),
    [charts],
  )

  const applyPreset = (key: string) => {
    const preset = presets.find((item) => item.key === key)
    if (!preset) return
    setActivePreset(key)
    setFrom(preset.from)
    setTo(preset.to)
  }

  const handleAcknowledge = async (id: number) => {
    setAckingId(id)
    try {
      await api.post(`/warnings/${id}/acknowledge`)
      toast.success('Warning ditandai sudah diperiksa.')
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setAckingId(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Ringkasan kondisi usaha telur puyuh." />
        <LoadingBlock label="Menyiapkan ringkasan kandang..." />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Ringkasan kondisi usaha telur puyuh." />
        <ErrorBlock message={error} onRetry={reload} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ringkasan Usaha"
        title="Dashboard"
        description={`Pantau produksi, penjualan, populasi, dan kondisi kandang. Data sampai ${formatDateLong(today)}.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/laporan')}>
              Lihat laporan
            </Button>
            <Button onClick={() => navigate('/produksi')} icon={<Plus className="h-4 w-4" />}>
              Catat produksi
            </Button>
          </>
        }
      />

      {data && data.critical_warnings > 0 && (
        <Link
          to="/warning"
          className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 transition hover:border-rose-300"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <TriangleAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-900">
              {formatNumber(data.critical_warnings)} warning kritis perlu diperiksa
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-rose-700/70">
              Ada kondisi kandang yang melewati batas aman. Buka halaman warning untuk melihat detail dan
              menandainya sudah diperiksa.
            </p>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-rose-400" />
        </Link>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                activePreset === preset.key
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(event) => {
              setActivePreset('custom')
              setFrom(event.target.value)
            }}
            className="h-9 w-auto py-1.5 text-xs"
          />
          <span className="text-xs text-stone-400">sampai</span>
          <Input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(event) => {
              setActivePreset('custom')
              setTo(event.target.value)
            }}
            className="h-9 w-auto py-1.5 text-xs"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Telur hari ini"
          value={`${formatNumber(data?.today_eggs ?? 0)} butir`}
          hint={`Produktivitas ${formatPercent(data?.today_productivity ?? 0)} dari populasi aktif`}
          icon={Egg}
          tone="emerald"
        />
        <StatCard
          label="Populasi aktif"
          value={`${formatNumber(data?.current_population ?? 0)} ekor`}
          hint={`Awal ${formatNumber(data?.initial_population ?? 0)} ekor`}
          icon={Bird}
          tone="sky"
        />
        <StatCard
          label="Pendapatan bulan ini"
          value={formatCurrency(data?.month_revenue ?? 0)}
          hint={`${formatNumber(data?.month_notes ?? 0)} nota PT diterima`}
          icon={Wallet}
          tone="violet"
        />
        <StatCard
          label="Kematian bulan ini"
          value={`${formatNumber(data?.month_mortality ?? 0)} ekor`}
          hint={`Hari ini ${formatNumber(data?.today_mortality ?? 0)} ekor`}
          icon={Skull}
          tone="rose"
        />
        <StatCard
          label="Pakan bulan ini"
          value={`${formatNumber(data?.month_feed_sacks ?? 0)} sak`}
          hint={`Pengeluaran ${formatCurrency(data?.month_feed_spend ?? 0)}`}
          icon={Wheat}
          tone="amber"
        />
        <StatCard
          label="Warning aktif"
          value={formatNumber(data?.open_warnings ?? 0)}
          hint={`${formatNumber(data?.critical_warnings ?? 0)} level kritis`}
          icon={TriangleAlert}
          tone={(data?.critical_warnings ?? 0) > 0 ? 'rose' : 'stone'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Produksi & pengambilan telur"
          description={`Total ${formatNumber(productionTotal)} butir produksi · ${formatNumber(soldTotal)} butir diambil PT`}
          className="xl:col-span-2"
          action={<Badge tone="emerald">Harian</Badge>}
        >
          <ResponsiveContainer width="100%" height={286}>
            <ComposedChart data={charts} margin={chartMargins}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis
                dataKey="label"
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                minTickGap={22}
              />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={46} />
              <Tooltip content={<ChartTooltip valueFormatter={numberTooltip} />} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <Bar
                dataKey="eggs"
                name="Produksi"
                fill={CHART_COLORS.emerald}
                radius={[5, 5, 0, 0]}
                maxBarSize={28}
              />
              <Line
                type="monotone"
                dataKey="sales_eggs"
                name="Diambil PT"
                stroke={CHART_COLORS.amber}
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionCard
          title="Warning terbaru"
          description={
            data?.open_warnings
              ? `${formatNumber(data.open_warnings)} warning belum diperiksa`
              : 'Semua kondisi dalam batas normal'
          }
          action={
            <Link
              to="/warning"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"
            >
              Semua <ArrowRight className="h-3 w-3" />
            </Link>
          }
          bodyClassName="p-0"
        >
          {warnings.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Tidak ada warning aktif"
              description="Sistem belum menemukan kondisi yang melewati batas. Tetap periksa kandang secara langsung."
              className="py-9"
            />
          ) : (
            <div className="divide-y divide-stone-100">
              {warnings.map((warning) => (
                <div key={warning.id} className="flex gap-3 px-5 py-3.5">
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      warning.level === 'kritis'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-amber-50 text-amber-600',
                    )}
                  >
                    <TriangleAlert className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-semibold text-stone-800">{warning.title}</p>
                      <Badge tone={warning.level === 'kritis' ? 'rose' : 'amber'}>
                        {warning.level === 'kritis' ? 'Kritis' : 'Waspada'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-stone-500">
                      {warning.description}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-stone-400">{formatDate(warning.event_date)}</span>
                      <button
                        type="button"
                        disabled={ackingId === warning.id}
                        onClick={() => handleAcknowledge(warning.id)}
                        className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
                      >
                        {ackingId === warning.id ? 'Menyimpan...' : 'Tandai diperiksa'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Perkembangan populasi"
          description="Jumlah burung hidup berdasarkan data kematian dan penyesuaian."
          className="xl:col-span-2"
          action={<Badge tone="sky">Ekor</Badge>}
        >
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={charts} margin={chartMargins}>
              <defs>
                <linearGradient id="populationFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.sky} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART_COLORS.sky} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={22} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={46} />
              <Tooltip content={<ChartTooltip valueFormatter={numberTooltip} />} />
              <Area
                type="monotone"
                dataKey="population"
                name="Populasi"
                stroke={CHART_COLORS.sky}
                strokeWidth={2}
                fill="url(#populationFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionCard
          title="Kegiatan terdekat"
          description="7 hari ke depan"
          action={
            <Link
              to="/kalender"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"
            >
              Kalender <ArrowRight className="h-3 w-3" />
            </Link>
          }
          bodyClassName="p-0"
        >
          {events.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Belum ada kegiatan"
              description="Tambahkan jadwal vitamin, vaksin, atau kegiatan kandang lainnya."
              action={
                <Button size="sm" variant="outline" onClick={() => navigate('/kalender')}>
                  Buka kalender
                </Button>
              }
              className="py-9"
            />
          ) : (
            <div className="divide-y divide-stone-100">
              {events.map((event) => (
                <Link
                  key={event.id}
                  to="/kalender"
                  className="flex items-start gap-3 px-5 py-3 transition hover:bg-stone-50/70"
                >
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                    <span className="text-sm font-bold leading-none">{formatDateShort(event.event_date).split(' ')[0]}</span>
                    <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">
                      {formatDateShort(event.event_date).split(' ')[1]}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-stone-800">{event.title}</p>
                    <p className="mt-0.5 text-[10px] text-stone-400">
                      {eventTypeLabel(event.event_type)} · {relativeDays(event.event_date)}
                    </p>
                    {event.batch && (
                      <p className="mt-1 text-[10px] text-stone-400">
                        {event.batch.name}
                        {event.batch_age_days !== undefined && event.batch_age_days !== null
                          ? ` · umur ${event.batch_age_days} hari`
                          : ''}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Kematian harian" description="Jumlah burung mati per hari.">
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={charts} margin={chartMargins}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
              <Tooltip content={<ChartTooltip valueFormatter={numberTooltip} />} />
              <Bar dataKey="mortality" name="Kematian" fill={CHART_COLORS.rose} radius={[4, 4, 0, 0]} maxBarSize={20} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Harga pakan"
          description="Harga per sak dari riwayat penerimaan."
          action={<Badge tone="amber">{data?.latest_feed_price ? formatCurrency(data.latest_feed_price) : '-'}</Badge>}
        >
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={charts} margin={chartMargins}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(value) => `${Math.round(Number(value) / 1000)}rb`}
              />
              <Tooltip content={<ChartTooltip valueFormatter={currencyTooltip} />} />
              <Line
                type="stepAfter"
                dataKey="feed_price"
                name="Harga/sak"
                stroke={CHART_COLORS.amber}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionCard title="Produktivitas" description="Persentase telur terhadap populasi." bodyClassName="p-5">
          <div className="flex h-[180px] flex-col justify-center">
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold tracking-tight text-stone-900">
                {formatPercent(data?.today_productivity ?? 0)}
              </p>
              <span className="mb-1 text-xs text-stone-400">hari ini</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-all"
                style={{ width: `${Math.min(data?.today_productivity ?? 0, 100)}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-stone-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  Rata-rata bulan
                </p>
                <p className="mt-1 text-sm font-bold text-stone-800">
                  {formatPercent(data?.month_productivity ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-stone-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  Kematian hari ini
                </p>
                <p className="mt-1 text-sm font-bold text-stone-800">
                  {formatNumber(data?.today_mortality ?? 0)} ekor
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-stone-400">
              <Activity className="h-3 w-3" />
              Dihitung dari populasi aktif saat ini
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Kondisi kelompok puyuh"
        description="Populasi terkini, umur, dan tingkat kematian setiap batch."
        action={
          <Button size="sm" variant="outline" onClick={() => navigate('/populasi')} icon={<Plus className="h-3.5 w-3.5" />}>
            Kelola batch
          </Button>
        }
      >
        {batches.length === 0 ? (
          <EmptyState
            icon={Bird}
            title="Belum ada kelompok puyuh"
            description="Tambahkan batch pertama untuk mulai menghitung populasi dan umur puyuh."
            action={
              <Button size="sm" onClick={() => navigate('/populasi')}>
                Tambah kelompok
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {batches.map((batch) => (
              <div key={batch.id} className="rounded-xl border border-stone-200/80 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{batch.name}</p>
                    <p className="mt-0.5 text-[11px] text-stone-400">
                      Umur {formatNumber(batch.age_days)} hari · {batch.age_weeks} minggu
                    </p>
                  </div>
                  <Badge tone={batch.status === 'active' ? 'emerald' : 'stone'} dot>
                    {batch.status === 'active' ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                      Populasi hidup
                    </p>
                    <p className="text-xl font-bold text-stone-900">
                      {formatNumber(batch.current_population)}{' '}
                      <span className="text-xs font-medium text-stone-400">ekor</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-stone-400">dari {formatNumber(batch.initial_population)}</p>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[10px] text-stone-400">
                    <span>Kematian</span>
                    <span>{formatPercent(batch.mortality_rate, 2)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        batch.mortality_rate > 5 ? 'bg-rose-500' : batch.mortality_rate > 3 ? 'bg-amber-500' : 'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(batch.mortality_rate * 10, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {data && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200/70 bg-white/60 px-4 py-3 text-[11px] text-stone-400">
          <p>
            Menampilkan {formatDate(from)} – {formatDate(to)} · {formatDecimal(data.month_productivity)}% produktivitas
            bulan ini
          </p>
          <p className="flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            Data dihitung ulang setiap halaman dibuka
          </p>
        </div>
      )}
    </div>
  )
}
