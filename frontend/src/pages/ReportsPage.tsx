import { useMemo, useState } from 'react'
import {
  BarChart3,
  Bird,
  CalendarDays,
  CircleDollarSign,
  Egg,
  Layers,
  Package,
  Skull,
  TrendingUp,
  Wheat,
} from 'lucide-react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
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
import { Input, Select } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { SectionCard } from '../components/ui/Card'
import { Table, Td, Th } from '../components/ui/Table'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingBlock, ErrorBlock } from '../components/ui/Feedback'
import { ChartCard } from '../components/charts/ChartCard'
import { ChartTooltip, currencyTooltip, numberTooltip } from '../components/charts/ChartTooltip'
import { CHART_COLORS, axisStyle, chartMargins, gridStroke } from '../components/charts/theme'
import { useApi } from '../hooks/useApi'
import { usePageTitle } from '../components/ProtectedRoute'
import type { ReportResponse } from '../types'
import {
  addDaysISO,
  formatDate,
  startOfMonthISO,
  todayISO,
} from '../utils/date'
import { formatCurrency, formatDecimal, formatNumber, formatPercent } from '../utils/format'
import { cn } from '../utils/cn'

type Preset = 'month' | '30' | '90' | 'year'

const presetLabels: Record<Preset, string> = {
  month: 'Bulan ini',
  '30': '30 hari',
  '90': '90 hari',
  year: 'Tahun ini',
}

export function ReportsPage() {
  usePageTitle('Laporan & Grafik')
  const today = todayISO()
  const [from, setFrom] = useState(startOfMonthISO(today))
  const [to, setTo] = useState(today)
  const [groupBy, setGroupBy] = useState('day')
  const [preset, setPreset] = useState<Preset>('month')
  const [activeChart, setActiveChart] = useState<'production' | 'finance'>('production')

  const report = useApi<ReportResponse>('/reports', { from, to, group_by: groupBy })
  const data = report.data
  const totals = data?.totals
  const series = useMemo(() => data?.series ?? [], [data?.series])
  const batchRows = data?.batches ?? []

  const applyPreset = (next: Preset) => {
    setPreset(next)
    if (next === 'month') {
      setFrom(startOfMonthISO(today))
      setTo(today)
      setGroupBy('day')
    } else if (next === '30') {
      setFrom(addDaysISO(today, -29))
      setTo(today)
      setGroupBy('day')
    } else if (next === '90') {
      setFrom(addDaysISO(today, -89))
      setTo(today)
      setGroupBy('week')
    } else {
      setFrom(`${today.slice(0, 4)}-01-01`)
      setTo(today)
      setGroupBy('month')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ringkasan"
        title="Laporan & Grafik"
        description="Analisis produksi, penjualan, pakan, populasi, dan kematian dalam satu tampilan. Data dihitung langsung dari catatan operasional."
        actions={
          <Button
            variant="secondary"
            onClick={() => window.print()}
            icon={<Layers className="h-4 w-4" />}
          >
            Cetak laporan
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-3 shadow-sm xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4 text-stone-400" />
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(event) => {
              setFrom(event.target.value)
              setPreset('month')
            }}
            className="h-9 w-auto py-1.5 text-xs"
          />
          <span className="text-xs text-stone-400">sampai</span>
          <Input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 w-auto py-1.5 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(presetLabels) as Preset[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition',
                preset === key
                  ? 'bg-emerald-700 text-white'
                  : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800',
              )}
            >
              {presetLabels[key]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 xl:ml-auto">
          <span className="text-[11px] text-stone-400">Kelompokkan</span>
          <Select
            value={groupBy}
            onChange={(event) => {
              setGroupBy(event.target.value)
              setPreset('month')
            }}
            className="h-9 py-1.5 text-xs xl:w-32"
          >
            <option value="day">Harian</option>
            <option value="week">Mingguan</option>
            <option value="month">Bulanan</option>
          </Select>
        </div>
      </div>

      {report.error ? (
        <ErrorBlock message={report.error} onRetry={report.reload} />
      ) : report.loading && !data ? (
        <LoadingBlock label="Menghitung laporan..." className="py-24" />
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total produksi"
              value={`${formatNumber(totals?.total_eggs ?? 0)} butir`}
              hint={`Rata-rata ${formatNumber(Math.round(totals?.average_eggs ?? 0))} butir/hari`}
              icon={Egg}
              tone="emerald"
            />
            <StatCard
              label="Telur terjual"
              value={`${formatNumber(totals?.total_sales_eggs ?? 0)} butir`}
              hint="Berdasarkan pengambilan PT"
              icon={Package}
              tone="sky"
            />
            <StatCard
              label="Pendapatan nota"
              value={formatCurrency(totals?.total_revenue ?? 0)}
              hint={`${formatNumber(data.days)} hari dalam periode`}
              icon={CircleDollarSign}
              tone="violet"
            />
            <StatCard
              label="Pengeluaran pakan"
              value={formatCurrency(totals?.total_feed_spend ?? 0)}
              hint={`${formatDecimal(totals?.total_feed_sacks ?? 0)} sak diterima`}
              icon={Wheat}
              tone="amber"
            />
            <StatCard
              label="Populasi aktif"
              value={`${formatNumber(totals?.current_population ?? 0)} ekor`}
              hint={`${formatNumber(batchRows.filter((batch) => batch.status === 'active').length)} kelompok aktif`}
              icon={Bird}
              tone="emerald"
            />
            <StatCard
              label="Produktivitas"
              value={formatPercent(totals?.productivity ?? 0, 2)}
              hint="Telur per populasi per hari"
              icon={TrendingUp}
              tone="sky"
            />
            <StatCard
              label="Total kematian"
              value={`${formatNumber(totals?.total_mortality ?? 0)} ekor`}
              hint={`Laju ${formatPercent(totals?.mortality_rate ?? 0, 2)}`}
              icon={Skull}
              tone="rose"
            />
            <StatCard
              label="Harga pakan terakhir"
              value={formatCurrency(totals?.latest_feed_price ?? 0)}
              hint="Per sak, riwayat terbaru"
              icon={BarChart3}
              tone="stone"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              className="xl:col-span-2"
              title="Produksi dan penjualan telur"
              description={`Perbandingan jumlah telur diproduksi dan telur yang diambil PT per ${groupBy === 'day' ? 'hari' : groupBy === 'week' ? 'minggu' : 'bulan'}.`}
              action={
                <div className="flex gap-1 rounded-lg bg-stone-100 p-0.5">
                  {([
                    { key: 'production', label: 'Produksi' },
                    { key: 'finance', label: 'Keuangan' },
                  ] as const).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveChart(item.key)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                        activeChart === item.key
                          ? 'bg-white text-stone-900 shadow-sm'
                          : 'text-stone-500 hover:text-stone-800',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              }
            >
              {series.length === 0 ? (
                <EmptyState icon={BarChart3} title="Belum ada data" description="Tidak ada data pada periode ini." />
              ) : activeChart === 'production' ? (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={series} margin={chartMargins}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                    <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={20} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="eggs"
                      name="Produksi"
                      fill={CHART_COLORS.emeraldSoft}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={26}
                    />
                    <Line
                      type="monotone"
                      dataKey="sales_eggs"
                      name="Terjual / diambil"
                      stroke={CHART_COLORS.amber}
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={series} margin={chartMargins}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                    <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={20} />
                    <YAxis
                      tick={axisStyle}
                      axisLine={false}
                      tickLine={false}
                      width={54}
                      tickFormatter={(value) => `${Math.round(Number(value) / 1000)}rb`}
                    />
                    <Tooltip content={<ChartTooltip valueFormatter={currencyTooltip} />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Pendapatan"
                      stroke={CHART_COLORS.violet}
                      fill={CHART_COLORS.violet}
                      fillOpacity={0.12}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="feed_spend"
                      name="Belanja pakan"
                      stroke={CHART_COLORS.rose}
                      fill={CHART_COLORS.rose}
                      fillOpacity={0.08}
                      strokeWidth={2}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Populasi dan kematian"
              description="Populasi akhir periode dibandingkan jumlah kematian."
            >
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={series} margin={chartMargins}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis
                    yAxisId="population"
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    yAxisId="mortality"
                    orientation="right"
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    yAxisId="mortality"
                    dataKey="mortality"
                    name="Kematian"
                    fill={CHART_COLORS.rose}
                    opacity={0.55}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={16}
                  />
                  <Line
                    yAxisId="population"
                    type="monotone"
                    dataKey="population"
                    name="Populasi"
                    stroke={CHART_COLORS.emerald}
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Produktivitas telur"
              description="Persentase telur terhadap populasi per hari."
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={series} margin={chartMargins}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<ChartTooltip valueFormatter={(value) => formatPercent(value, 2)} />} />
                  <Line
                    type="monotone"
                    dataKey="productivity"
                    name="Produktivitas"
                    stroke={CHART_COLORS.sky}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Penerimaan pakan"
              description="Jumlah sak diterima dan harga pakan per sak."
            >
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={series} margin={chartMargins}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis yAxisId="sacks" tick={axisStyle} axisLine={false} tickLine={false} width={34} />
                  <YAxis
                    yAxisId="price"
                    orientation="right"
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                    width={46}
                    tickFormatter={(value) => `${Math.round(Number(value) / 1000)}rb`}
                  />
                  <Tooltip content={<ChartTooltip valueFormatter={numberTooltip} />} />
                  <Bar
                    yAxisId="sacks"
                    dataKey="sacks"
                    name="Sak"
                    fill={CHART_COLORS.amber}
                    opacity={0.75}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  />
                  <Line
                    yAxisId="price"
                    type="stepAfter"
                    dataKey="feed_price"
                    name="Harga/sak"
                    stroke={CHART_COLORS.stone}
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <SectionCard
            title="Kinerja per kelompok"
            description="Ringkasan populasi dan kematian setiap kelompok pada periode ini."
            bodyClassName="p-0"
            action={<Badge tone="stone">{formatNumber(batchRows.length)} kelompok</Badge>}
          >
            {batchRows.length === 0 ? (
              <EmptyState
                icon={Bird}
                title="Belum ada kelompok"
                description="Tambahkan kelompok puyuh untuk melihat kinerja per kelompok."
              />
            ) : (
              <Table minWidth="min-w-[900px]">
                <thead>
                  <tr>
                    <Th>Kelompok</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Umur</Th>
                    <Th className="text-right">Populasi awal</Th>
                    <Th className="text-right">Populasi saat ini</Th>
                    <Th className="text-right">Kematian</Th>
                    <Th className="text-right">Laju kematian</Th>
                    <Th className="text-right">Penyesuaian</Th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map((batch) => (
                    <tr key={batch.id} className="transition hover:bg-stone-50/60">
                      <Td>
                        <p className="text-xs font-semibold text-stone-800">{batch.name}</p>
                        <p className="text-[10px] text-stone-400">Menetas {formatDate(batch.hatch_date)}</p>
                      </Td>
                      <Td>
                        <Badge tone={batch.status === 'active' ? 'emerald' : 'stone'} dot>
                          {batch.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </Td>
                      <Td className="text-right text-xs text-stone-600">{formatNumber(batch.age_weeks)} minggu</Td>
                      <Td className="text-right text-xs text-stone-600">{formatNumber(batch.initial_population)}</Td>
                      <Td className="text-right text-xs font-bold text-stone-800">
                        {formatNumber(batch.current_population)}
                      </Td>
                      <Td className="text-right text-xs text-rose-600">{formatNumber(batch.total_mortality)}</Td>
                      <Td className="text-right text-xs font-semibold text-stone-700">
                        {formatPercent(batch.mortality_rate, 2)}
                      </Td>
                      <Td className="text-right text-[11px] text-stone-500">
                        <span className="text-emerald-700">+{formatNumber(batch.total_addition)}</span>
                        {' / '}
                        <span className="text-rose-600">−{formatNumber(batch.total_reduction)}</span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </SectionCard>

          <p className="text-center text-[10px] text-stone-400">
            Laporan dihitung dari catatan produksi, pengambilan PT, nota penjualan, penerimaan pakan,
            kematian, dan penyesuaian populasi pada periode {formatDate(from)} – {formatDate(to)}.
          </p>
        </>
      ) : null}
    </div>
  )
}
