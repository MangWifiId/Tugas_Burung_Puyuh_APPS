import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bird,
  CalendarDays,
  Info,
  Pencil,
  Plus,
  Scale,
  Skull,
  Trash2,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { SectionCard } from '../components/ui/Card'
import { Table, Td, Th } from '../components/ui/Table'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingBlock, ErrorBlock } from '../components/ui/Feedback'
import { ChartCard } from '../components/charts/ChartCard'
import { ChartTooltip } from '../components/charts/ChartTooltip'
import { CHART_COLORS, axisStyle, chartMargins, gridStroke } from '../components/charts/theme'
import { useApi } from '../hooks/useApi'
import { useConfirm } from '../providers/ConfirmProvider'
import { useToast } from '../providers/ToastProvider'
import { usePageTitle } from '../components/ProtectedRoute'
import { api, getErrorMessage } from '../services/api'
import type { BatchStats, PopulationAdjustment, PopulationPoint } from '../types'
import { addDaysISO, formatDate, formatDateShort, todayISO } from '../utils/date'
import { formatNumber, formatPercent } from '../utils/format'
import { cn } from '../utils/cn'

interface BatchForm {
  name: string
  hatch_date: string
  entry_date: string
  initial_population: string
  production_start_date: string
  status: string
  notes: string
}

interface AdjustmentForm {
  batch_id: string
  adjust_date: string
  type: string
  quantity: string
  reason: string
  notes: string
}

const emptyBatch = (): BatchForm => ({
  name: '',
  hatch_date: todayISO(),
  entry_date: '',
  initial_population: '',
  production_start_date: '',
  status: 'active',
  notes: '',
})

const emptyAdjustment = (batchId = ''): AdjustmentForm => ({
  batch_id: batchId,
  adjust_date: todayISO(),
  type: 'reduction',
  quantity: '',
  reason: '',
  notes: '',
})

export function PopulationPage() {
  usePageTitle('Populasi Burung')
  const toast = useToast()
  const { confirm } = useConfirm()

  const batches = useApi<BatchStats[]>('/batches', { status: 'all' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [historyDays, setHistoryDays] = useState(30)
  const [batchModal, setBatchModal] = useState(false)
  const [editingBatch, setEditingBatch] = useState<BatchStats | null>(null)
  const [batchForm, setBatchForm] = useState<BatchForm>(emptyBatch)
  const [adjustModal, setAdjustModal] = useState(false)
  const [editingAdjustment, setEditingAdjustment] = useState<PopulationAdjustment | null>(null)
  const [adjustForm, setAdjustForm] = useState<AdjustmentForm>(emptyAdjustment)
  const [adjustBatchFilter, setAdjustBatchFilter] = useState('')
  const [adjustFrom, setAdjustFrom] = useState(addDaysISO(todayISO(), -179))
  const [adjustTo, setAdjustTo] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  const historyFrom = addDaysISO(todayISO(), -(historyDays - 1))
  const history = useApi<PopulationPoint[]>(
    selectedId ? `/batches/${selectedId}/history` : null,
    { from: historyFrom, to: todayISO() },
  )
  const adjustments = useApi<PopulationAdjustment[]>('/population-adjustments', {
    batch_id: adjustBatchFilter || undefined,
    from: adjustFrom,
    to: adjustTo,
  })

  const batchRows = batches.data ?? []

  useEffect(() => {
    if (selectedId === null && batchRows.length > 0) {
      const active = batchRows.find((batch) => batch.status === 'active')
      setSelectedId(active?.id ?? batchRows[0].id)
    }
  }, [batchRows, selectedId])

  const selectedBatch = batchRows.find((batch) => batch.id === selectedId) ?? null

  const totals = useMemo(() => {
    const active = batchRows.filter((batch) => batch.status === 'active')
    const population = active.reduce((sum, batch) => sum + batch.current_population, 0)
    const initial = batchRows.reduce((sum, batch) => sum + batch.initial_population, 0)
    const mortality = batchRows.reduce((sum, batch) => sum + batch.total_mortality, 0)
    const rate = initial > 0 ? (mortality / initial) * 100 : 0
    return { population, initial, mortality, rate, active: active.length }
  }, [batchRows])

  const historyRows = useMemo(
    () =>
      (history.data ?? []).map((point) => ({
        ...point,
        label: formatDateShort(point.date),
      })),
    [history.data],
  )

  const openCreateBatch = () => {
    setEditingBatch(null)
    setBatchForm(emptyBatch())
    setBatchModal(true)
  }

  const openEditBatch = (batch: BatchStats) => {
    setEditingBatch(batch)
    setBatchForm({
      name: batch.name,
      hatch_date: batch.hatch_date.slice(0, 10),
      entry_date: batch.entry_date ? batch.entry_date.slice(0, 10) : '',
      initial_population: String(batch.initial_population),
      production_start_date: batch.production_start_date
        ? batch.production_start_date.slice(0, 10)
        : '',
      status: batch.status,
      notes: batch.notes ?? '',
    })
    setBatchModal(true)
  }

  const submitBatch = async (event: FormEvent) => {
    event.preventDefault()
    if (!batchForm.name.trim()) {
      toast.error('Nama kelompok wajib diisi.')
      return
    }
    if (Number(batchForm.initial_population) <= 0) {
      toast.error('Populasi awal harus lebih besar dari 0.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: batchForm.name.trim(),
        hatch_date: batchForm.hatch_date,
        entry_date: batchForm.entry_date || null,
        initial_population: Number(batchForm.initial_population),
        production_start_date: batchForm.production_start_date || null,
        status: batchForm.status,
        notes: batchForm.notes,
      }
      if (editingBatch) {
        await api.put(`/batches/${editingBatch.id}`, payload)
        toast.success('Data kelompok diperbarui.')
      } else {
        const response = await api.post('/batches', payload)
        toast.success('Kelompok puyuh ditambahkan.')
        setSelectedId(response.data.data.id)
      }
      setBatchModal(false)
      batches.reload()
      history.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const deleteBatch = async (batch: BatchStats) => {
    const approved = await confirm({
      title: 'Hapus kelompok puyuh?',
      description: `Kelompok "${batch.name}" akan dihapus. Kelompok yang sudah memiliki produksi, kematian, atau penyesuaian tidak dapat dihapus.`,
      confirmLabel: 'Hapus kelompok',
      danger: true,
    })
    if (!approved) return
    try {
      await api.delete(`/batches/${batch.id}`)
      toast.success('Kelompok puyuh dihapus.')
      if (selectedId === batch.id) setSelectedId(null)
      batches.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const openCreateAdjustment = () => {
    setEditingAdjustment(null)
    setAdjustForm(emptyAdjustment(adjustBatchFilter || (selectedId ? String(selectedId) : '')))
    setAdjustModal(true)
  }

  const openEditAdjustment = (adjustment: PopulationAdjustment) => {
    setEditingAdjustment(adjustment)
    setAdjustForm({
      batch_id: String(adjustment.batch_id),
      adjust_date: adjustment.adjust_date.slice(0, 10),
      type: adjustment.type,
      quantity: String(adjustment.quantity),
      reason: adjustment.reason ?? '',
      notes: adjustment.notes ?? '',
    })
    setAdjustModal(true)
  }

  const submitAdjustment = async (event: FormEvent) => {
    event.preventDefault()
    if (!adjustForm.batch_id) {
      toast.error('Pilih kelompok puyuh terlebih dahulu.')
      return
    }
    if (Number(adjustForm.quantity) <= 0) {
      toast.error('Jumlah penyesuaian harus lebih besar dari 0.')
      return
    }
    if (!adjustForm.reason.trim()) {
      toast.error('Alasan penyesuaian wajib diisi.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        batch_id: Number(adjustForm.batch_id),
        adjust_date: adjustForm.adjust_date,
        type: adjustForm.type,
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason.trim(),
        notes: adjustForm.notes,
      }
      if (editingAdjustment) {
        await api.put(`/population-adjustments/${editingAdjustment.id}`, payload)
        toast.success('Penyesuaian populasi diperbarui.')
      } else {
        await api.post('/population-adjustments', payload)
        toast.success('Penyesuaian populasi dicatat.')
      }
      setAdjustModal(false)
      adjustments.reload()
      batches.reload()
      history.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const deleteAdjustment = async (adjustment: PopulationAdjustment) => {
    const approved = await confirm({
      title: 'Hapus penyesuaian populasi?',
      description: `${adjustment.type === 'reduction' ? 'Pengurangan' : 'Penambahan'} ${formatNumber(adjustment.quantity)} ekor tanggal ${formatDate(adjustment.adjust_date)} akan dihapus. Populasi dihitung ulang.`,
      confirmLabel: 'Hapus',
      danger: true,
    })
    if (!approved) return
    try {
      await api.delete(`/population-adjustments/${adjustment.id}`)
      toast.success('Penyesuaian populasi dihapus.')
      adjustments.reload()
      batches.reload()
      history.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operasional"
        title="Populasi Burung"
        description="Kelola kelompok puyuh dan pantau perubahan populasi. Populasi saat ini dihitung dari populasi awal dikurangi kematian dan pengurangan, ditambah penambahan."
        actions={
          <Button onClick={openCreateBatch} icon={<Plus className="h-4 w-4" />}>
            Tambah kelompok
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Populasi aktif"
          value={`${formatNumber(totals.population)} ekor`}
          hint={`${formatNumber(totals.active)} kelompok aktif`}
          icon={Bird}
          tone="emerald"
        />
        <StatCard
          label="Populasi awal tercatat"
          value={`${formatNumber(totals.initial)} ekor`}
          hint={`${formatNumber(batchRows.length)} kelompok terdaftar`}
          icon={Scale}
          tone="sky"
        />
        <StatCard
          label="Total kematian"
          value={`${formatNumber(totals.mortality)} ekor`}
          hint="Akumulasi seluruh kelompok"
          icon={Skull}
          tone="rose"
        />
        <StatCard
          label="Laju kematian"
          value={formatPercent(totals.rate, 2)}
          hint="Terhadap populasi awal seluruh kelompok"
          icon={ArrowDownRight}
          tone="amber"
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-xs leading-relaxed text-emerald-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <p>
          Rumus populasi: <strong>populasi awal − kematian − pengurangan + penambahan</strong>. Setiap
          perubahan dicatat sebagai riwayat dan tidak menghapus data sebelumnya.
        </p>
      </div>

      {batches.loading && batchRows.length === 0 ? (
        <LoadingBlock label="Memuat kelompok puyuh..." />
      ) : batches.error ? (
        <ErrorBlock message={batches.error} onRetry={batches.reload} />
      ) : batchRows.length === 0 ? (
        <SectionCard bodyClassName="p-0">
          <EmptyState
            icon={Bird}
            title="Belum ada kelompok puyuh"
            description="Tambahkan kelompok pertama untuk mulai mencatat populasi, produksi, dan kematian."
            action={
              <Button size="sm" variant="outline" onClick={openCreateBatch} icon={<Plus className="h-3.5 w-3.5" />}>
                Tambah kelompok
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {batchRows.map((batch) => {
            const active = selectedId === batch.id
            return (
              <div
                key={batch.id}
                className={cn(
                  'group relative rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition',
                  active
                    ? 'border-emerald-500/60 ring-2 ring-emerald-500/10'
                    : 'border-stone-200/80 hover:border-stone-300',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(batch.id)}
                  className="w-full text-left"
                  aria-label={`Pilih kelompok ${batch.name}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-stone-900">{batch.name}</h3>
                        <Badge tone={batch.status === 'active' ? 'emerald' : 'stone'} dot>
                          {batch.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-stone-400">
                        Menetas {formatDate(batch.hatch_date)} · {formatNumber(batch.age_weeks)} minggu ·{' '}
                        {batch.age_stage}
                      </p>
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Bird className="h-[18px] w-[18px]" />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-stone-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                        Populasi saat ini
                      </p>
                      <p className="mt-0.5 text-lg font-bold tracking-tight text-stone-900">
                        {formatNumber(batch.current_population)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-stone-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                        Populasi awal
                      </p>
                      <p className="mt-0.5 text-lg font-bold tracking-tight text-stone-900">
                        {formatNumber(batch.initial_population)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-500">
                    <span>Kematian {formatNumber(batch.total_mortality)} ekor</span>
                    <span>Pengurangan {formatNumber(batch.total_reduction)}</span>
                    <span>Penambahan {formatNumber(batch.total_addition)}</span>
                    <span className="font-semibold text-rose-600">{formatPercent(batch.mortality_rate, 2)}</span>
                  </div>

                  {batch.notes && (
                    <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-stone-400">
                      {batch.notes}
                    </p>
                  )}
                </button>

                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                  <span className="text-[10px] font-medium text-stone-400">
                    {active ? 'Kelompok dipilih' : 'Klik untuk melihat riwayat'}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit kelompok"
                      onClick={() => openEditBatch(batch)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Hapus kelompok"
                      className="text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => deleteBatch(batch)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ChartCard
        title={selectedBatch ? `Riwayat populasi · ${selectedBatch.name}` : 'Riwayat populasi'}
        description="Garis menunjukkan populasi pada akhir hari, batang menunjukkan kematian harian."
        action={
          <div className="flex gap-1 rounded-lg bg-stone-100 p-0.5">
            {[30, 90, 180].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setHistoryDays(days)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                  historyDays === days
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800',
                )}
              >
                {days} hari
              </button>
            ))}
          </div>
        }
      >
        {!selectedId ? (
          <EmptyState
            icon={Bird}
            title="Pilih kelompok"
            description="Pilih salah satu kelompok di atas untuk melihat riwayat populasi."
            className="py-12"
          />
        ) : history.loading && historyRows.length === 0 ? (
          <LoadingBlock label="Memuat riwayat populasi..." />
        ) : history.error ? (
          <ErrorBlock message={history.error} onRetry={history.reload} />
        ) : historyRows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Belum ada riwayat"
            description="Riwayat akan muncul setelah ada kematian atau penyesuaian populasi."
            className="py-12"
          />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={historyRows} margin={chartMargins}>
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
                width={34}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                yAxisId="mortality"
                dataKey="mortality"
                name="Kematian"
                fill={CHART_COLORS.rose}
                opacity={0.55}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
              <Line
                yAxisId="population"
                type="monotone"
                dataKey="population"
                name="Populasi"
                stroke={CHART_COLORS.emerald}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <SectionCard
        title="Penyesuaian populasi"
        description="Catat pengurangan atau penambahan di luar kematian, misalnya afkir, penjualan burung, atau pemindahan kelompok."
        bodyClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={adjustBatchFilter}
              onChange={(event) => setAdjustBatchFilter(event.target.value)}
              className="h-8 w-auto py-1 text-xs"
            >
              <option value="">Semua kelompok</option>
              {batchRows.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="outline" onClick={openCreateAdjustment} icon={<Plus className="h-3.5 w-3.5" />}>
              Catat penyesuaian
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3">
          <CalendarDays className="h-4 w-4 text-stone-400" />
          <Input
            type="date"
            value={adjustFrom}
            max={adjustTo}
            onChange={(event) => setAdjustFrom(event.target.value)}
            className="h-8 w-auto py-1 text-xs"
          />
          <span className="text-xs text-stone-400">sampai</span>
          <Input
            type="date"
            value={adjustTo}
            min={adjustFrom}
            max={todayISO()}
            onChange={(event) => setAdjustTo(event.target.value)}
            className="h-8 w-auto py-1 text-xs"
          />
          <span className="ml-auto text-[11px] text-stone-400">
            {formatNumber(adjustments.data?.length ?? 0)} penyesuaian
          </span>
        </div>

        {adjustments.loading && !adjustments.data ? (
          <LoadingBlock label="Memuat penyesuaian populasi..." />
        ) : adjustments.error ? (
          <ErrorBlock message={adjustments.error} onRetry={adjustments.reload} />
        ) : (adjustments.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={ArrowUpRight}
            title="Belum ada penyesuaian"
            description="Populasi saat ini hanya dipengaruhi kematian. Catat penyesuaian bila ada pengurangan atau penambahan burung."
            action={
              <Button size="sm" variant="outline" onClick={openCreateAdjustment} icon={<Plus className="h-3.5 w-3.5" />}>
                Catat penyesuaian
              </Button>
            }
          />
        ) : (
          <Table minWidth="min-w-[760px]">
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>Kelompok</Th>
                <Th>Jenis</Th>
                <Th className="text-right">Jumlah</Th>
                <Th>Alasan</Th>
                <Th>Catatan</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {adjustments.data?.map((adjustment) => (
                <tr key={adjustment.id} className="transition hover:bg-stone-50/60">
                  <Td className="text-xs font-medium text-stone-700">{formatDate(adjustment.adjust_date)}</Td>
                  <Td className="text-xs text-stone-600">
                    {adjustment.batch?.name ?? batchRows.find((batch) => batch.id === adjustment.batch_id)?.name ?? `#${adjustment.batch_id}`}
                  </Td>
                  <Td>
                    {adjustment.type === 'addition' ? (
                      <Badge tone="emerald">
                        <ArrowUpRight className="h-3 w-3" /> Penambahan
                      </Badge>
                    ) : (
                      <Badge tone="rose">
                        <ArrowDownRight className="h-3 w-3" /> Pengurangan
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-right text-xs font-bold text-stone-800">
                    {adjustment.type === 'addition' ? '+' : '−'}
                    {formatNumber(adjustment.quantity)}
                  </Td>
                  <Td className="max-w-[220px]">
                    <p className="truncate text-xs text-stone-600">{adjustment.reason}</p>
                  </Td>
                  <Td className="max-w-[180px]">
                    <p className="truncate text-xs text-stone-400">{adjustment.notes || '—'}</p>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Edit penyesuaian"
                        onClick={() => openEditAdjustment(adjustment)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Hapus penyesuaian"
                        className="text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => deleteAdjustment(adjustment)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal
        open={batchModal}
        onClose={() => setBatchModal(false)}
        title={editingBatch ? 'Edit kelompok puyuh' : 'Tambah kelompok puyuh'}
        description="Kelompok dapat berupa satu kandang atau satu angkatan umur. Populasi awal tidak boleh diubah jika sudah ada data produksi atau kematian."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBatchModal(false)}>
              Batal
            </Button>
            <Button type="submit" form="batch-form" loading={saving}>
              {editingBatch ? 'Simpan perubahan' : 'Tambah kelompok'}
            </Button>
          </>
        }
      >
        <form id="batch-form" onSubmit={submitBatch} className="space-y-4">
          <Field label="Nama kelompok" htmlFor="batch-name" required>
            <Input
              id="batch-name"
              required
              value={batchForm.name}
              onChange={(event) => setBatchForm({ ...batchForm, name: event.target.value })}
              placeholder="Contoh: Kandang A · Angkatan Januari"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal menetas" htmlFor="batch-hatch" required>
              <Input
                id="batch-hatch"
                type="date"
                required
                max={todayISO()}
                value={batchForm.hatch_date}
                onChange={(event) => setBatchForm({ ...batchForm, hatch_date: event.target.value })}
              />
            </Field>
            <Field label="Tanggal masuk kandang" htmlFor="batch-entry" hint="Opsional, tidak boleh sebelum tanggal menetas.">
              <Input
                id="batch-entry"
                type="date"
                min={batchForm.hatch_date}
                max={todayISO()}
                value={batchForm.entry_date}
                onChange={(event) => setBatchForm({ ...batchForm, entry_date: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Populasi awal (ekor)"
              htmlFor="batch-population"
              required
              hint={editingBatch ? 'Perubahan populasi awal akan memengaruhi perhitungan populasi saat ini.' : undefined}
            >
              <Input
                id="batch-population"
                type="number"
                min={1}
                required
                value={batchForm.initial_population}
                onChange={(event) => setBatchForm({ ...batchForm, initial_population: event.target.value })}
                placeholder="Contoh: 1000"
              />
            </Field>
            <Field label="Tanggal mulai produksi" htmlFor="batch-production" hint="Opsional. Digunakan untuk memperkirakan umur produksi.">
              <Input
                id="batch-production"
                type="date"
                min={batchForm.hatch_date}
                value={batchForm.production_start_date}
                onChange={(event) => setBatchForm({ ...batchForm, production_start_date: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status kelompok" htmlFor="batch-status" required>
              <Select
                id="batch-status"
                value={batchForm.status}
                onChange={(event) => setBatchForm({ ...batchForm, status: event.target.value })}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </Select>
            </Field>
          </div>
          <Field label="Catatan" htmlFor="batch-notes">
            <Textarea
              id="batch-notes"
              value={batchForm.notes}
              onChange={(event) => setBatchForm({ ...batchForm, notes: event.target.value })}
              placeholder="Informasi tambahan tentang kelompok ini."
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={adjustModal}
        onClose={() => setAdjustModal(false)}
        title={editingAdjustment ? 'Edit penyesuaian populasi' : 'Catat penyesuaian populasi'}
        description="Pengurangan tidak boleh melebihi populasi yang tersedia pada tanggal tersebut."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustModal(false)}>
              Batal
            </Button>
            <Button type="submit" form="adjustment-form" loading={saving}>
              {editingAdjustment ? 'Simpan perubahan' : 'Simpan penyesuaian'}
            </Button>
          </>
        }
      >
        <form id="adjustment-form" onSubmit={submitAdjustment} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kelompok" htmlFor="adjust-batch" required>
              <Select
                id="adjust-batch"
                required
                value={adjustForm.batch_id}
                onChange={(event) => setAdjustForm({ ...adjustForm, batch_id: event.target.value })}
              >
                <option value="">Pilih kelompok</option>
                {batchRows.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tanggal penyesuaian" htmlFor="adjust-date" required>
              <Input
                id="adjust-date"
                type="date"
                required
                max={todayISO()}
                value={adjustForm.adjust_date}
                onChange={(event) => setAdjustForm({ ...adjustForm, adjust_date: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jenis penyesuaian" htmlFor="adjust-type" required>
              <Select
                id="adjust-type"
                value={adjustForm.type}
                onChange={(event) => setAdjustForm({ ...adjustForm, type: event.target.value })}
              >
                <option value="reduction">Pengurangan populasi</option>
                <option value="addition">Penambahan populasi</option>
              </Select>
            </Field>
            <Field label="Jumlah (ekor)" htmlFor="adjust-quantity" required>
              <Input
                id="adjust-quantity"
                type="number"
                min={1}
                required
                value={adjustForm.quantity}
                onChange={(event) => setAdjustForm({ ...adjustForm, quantity: event.target.value })}
                placeholder="Contoh: 10"
              />
            </Field>
          </div>
          <Field label="Alasan" htmlFor="adjust-reason" required>
            <Input
              id="adjust-reason"
              required
              value={adjustForm.reason}
              onChange={(event) => setAdjustForm({ ...adjustForm, reason: event.target.value })}
              placeholder="Contoh: Afkir, penjualan burung, atau pemindahan kandang"
            />
          </Field>
          <Field label="Catatan" htmlFor="adjust-notes">
            <Textarea
              id="adjust-notes"
              value={adjustForm.notes}
              onChange={(event) => setAdjustForm({ ...adjustForm, notes: event.target.value })}
              placeholder="Detail tambahan mengenai penyesuaian."
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
