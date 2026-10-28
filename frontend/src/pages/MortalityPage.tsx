import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Pencil,
  Plus,
  Skull,
  Trash2,
  TrendingDown,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { Pagination } from '../components/ui/Pagination'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingBlock, ErrorBlock } from '../components/ui/Feedback'
import { ChartCard } from '../components/charts/ChartCard'
import { ChartTooltip } from '../components/charts/ChartTooltip'
import { CHART_COLORS, axisStyle, chartMargins, gridStroke } from '../components/charts/theme'
import { useApi, usePage } from '../hooks/useApi'
import { useConfirm } from '../providers/ConfirmProvider'
import { useToast } from '../providers/ToastProvider'
import { usePageTitle } from '../components/ProtectedRoute'
import { api, getErrorMessage } from '../services/api'
import type { BatchStats, MortalityRecord, MortalitySummary } from '../types'
import { addDaysISO, formatDate, formatDateShort, todayISO } from '../utils/date'
import { formatNumber, formatPercent } from '../utils/format'

interface MortalityForm {
  batch_id: string
  record_date: string
  count: string
  cause: string
  notes: string
}

const emptyForm = (batchId = ''): MortalityForm => ({
  batch_id: batchId,
  record_date: todayISO(),
  count: '',
  cause: '',
  notes: '',
})

export function MortalityPage() {
  usePageTitle('Pencatatan Kematian')
  const toast = useToast()
  const { confirm } = useConfirm()
  const [from, setFrom] = useState(addDaysISO(todayISO(), -29))
  const [to, setTo] = useState(todayISO())
  const [batchFilter, setBatchFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MortalityRecord | null>(null)
  const [form, setForm] = useState<MortalityForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const { data: batches } = useApi<BatchStats[]>('/batches', { status: 'all' })
  const summary = useApi<MortalitySummary>('/mortality/summary', {
    from,
    to,
    group_by: 'day',
    batch_id: batchFilter || undefined,
  })
  const list = usePage<MortalityRecord>('/mortality', {
    from,
    to,
    batch_id: batchFilter || undefined,
    page,
    limit: 10,
  })

  const batchRows = batches ?? []
  const summaryRows = summary.data?.points ?? []
  const byBatch = useMemo(
    () => [...(summary.data?.by_batch ?? [])].sort((a, b) => b.total - a.total),
    [summary.data?.by_batch],
  )
  const topBatch = byBatch[0]
  const total = summary.data?.total ?? 0
  const average = summary.data?.average_daily ?? 0

  const updateRange = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom)
    setTo(nextTo)
    setPage(1)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(batchFilter))
    setModalOpen(true)
  }

  const openEdit = (record: MortalityRecord) => {
    setEditing(record)
    setForm({
      batch_id: String(record.batch_id),
      record_date: record.record_date.slice(0, 10),
      count: String(record.count),
      cause: record.cause ?? '',
      notes: record.notes ?? '',
    })
    setModalOpen(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.batch_id) {
      toast.error('Pilih kelompok puyuh terlebih dahulu.')
      return
    }
    if (Number(form.count) <= 0) {
      toast.error('Jumlah kematian harus lebih besar dari 0.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        batch_id: Number(form.batch_id),
        record_date: form.record_date,
        count: Number(form.count),
        cause: form.cause,
        notes: form.notes,
      }
      if (editing) {
        await api.put(`/mortality/${editing.id}`, payload)
        toast.success('Catatan kematian diperbarui.')
      } else {
        await api.post('/mortality', payload)
        toast.success('Kematian berhasil dicatat. Populasi diperbarui.')
      }
      setModalOpen(false)
      list.reload()
      summary.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (record: MortalityRecord) => {
    const approved = await confirm({
      title: 'Hapus catatan kematian?',
      description: `Kematian ${formatNumber(record.count)} ekor tanggal ${formatDate(record.record_date)} akan dihapus dan populasi dihitung ulang.`,
      confirmLabel: 'Hapus',
      danger: true,
    })
    if (!approved) return
    try {
      await api.delete(`/mortality/${record.id}`)
      toast.success('Catatan kematian dihapus. Populasi diperbarui.')
      list.reload()
      summary.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const chartRows = summaryRows.map((point) => ({ ...point, label: point.label || formatDateShort(point.period) }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operasional"
        title="Pencatatan Kematian"
        description="Catat kematian harian per kelompok. Jumlah kematian tidak boleh melebihi populasi yang tersedia."
        actions={
          <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Catat kematian
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4 text-stone-400" />
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(event) => updateRange(event.target.value, to)}
            className="h-9 w-auto py-1.5 text-xs"
          />
          <span className="text-xs text-stone-400">sampai</span>
          <Input
            type="date"
            value={to}
            min={from}
            max={todayISO()}
            onChange={(event) => updateRange(from, event.target.value)}
            className="h-9 w-auto py-1.5 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => updateRange(addDaysISO(todayISO(), -(days - 1)), todayISO())}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            >
              {days} hari
            </button>
          ))}
        </div>
        <div className="lg:ml-auto">
          <Select
            value={batchFilter}
            onChange={(event) => {
              setBatchFilter(event.target.value)
              setPage(1)
            }}
            className="h-9 py-1.5 text-xs lg:w-56"
          >
            <option value="">Semua kelompok</option>
            {batchRows.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total kematian"
          value={`${formatNumber(total)} ekor`}
          hint={`Periode ${formatDate(from)} – ${formatDate(to)}`}
          icon={Skull}
          tone="rose"
        />
        <StatCard
          label="Rata-rata harian"
          value={`${formatNumber(Math.round(average))} ekor`}
          hint="Dihitung per hari dalam periode"
          icon={TrendingDown}
          tone="amber"
        />
        <StatCard
          label="Kelompok terdampak"
          value={`${formatNumber(byBatch.length)} kelompok`}
          hint={
            topBatch
              ? `Tertinggi: ${topBatch.batch_name} (${formatNumber(topBatch.total)} ekor)`
              : 'Belum ada kematian tercatat'
          }
          icon={Users}
          tone="violet"
        />
        <StatCard
          label="Kematian hari ini"
          value={`${formatNumber(
            summaryRows.find((point) => point.period === todayISO())?.count ?? 0,
          )} ekor`}
          hint="Diperbarui dari catatan terbaru"
          icon={AlertTriangle}
          tone="sky"
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p>
          Setiap kematian akan mengurangi populasi kelompok. Sistem akan menolak pencatatan jika jumlah
          kematian melebihi populasi yang tersedia pada tanggal tersebut.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <ChartCard
          title="Grafik kematian harian"
          description="Jumlah kematian per hari pada periode dan kelompok terpilih."
        >
          {summary.loading && summaryRows.length === 0 ? (
            <LoadingBlock label="Memuat grafik kematian..." />
          ) : summary.error ? (
            <ErrorBlock message={summary.error} onRetry={summary.reload} />
          ) : summaryRows.length === 0 ? (
            <EmptyState
              icon={Skull}
              title="Belum ada data kematian"
              description="Grafik akan muncul setelah ada catatan kematian pada periode ini."
              className="py-12"
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartRows} margin={chartMargins}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={18} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="count"
                  name="Kematian"
                  fill={CHART_COLORS.rose}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <SectionCard
          title="Kematian per kelompok"
          description="Akumulasi pada periode terpilih."
          bodyClassName="p-0"
        >
          {byBatch.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Belum ada data"
              description="Tidak ada kematian pada periode ini."
            />
          ) : (
            <div className="divide-y divide-stone-100">
              {byBatch.map((row) => {
                const share = total > 0 ? (row.total / total) * 100 : 0
                return (
                  <div key={row.batch_id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-xs font-semibold text-stone-700">{row.batch_name}</p>
                      <p className="text-xs font-bold text-stone-900">{formatNumber(row.total)} ekor</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full bg-rose-500"
                          style={{ width: `${Math.max(share, 2)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-[10px] font-semibold text-stone-400">
                        {formatPercent(share)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Riwayat kematian"
        description="Catatan kematian terbaru beserta penyebab dan kelompok."
        bodyClassName="p-0"
        action={<span className="text-[11px] text-stone-400">{formatNumber(list.meta?.total ?? 0)} catatan</span>}
      >
        {list.loading && list.data.length === 0 ? (
          <LoadingBlock label="Memuat catatan kematian..." />
        ) : list.error ? (
          <ErrorBlock message={list.error} onRetry={list.reload} />
        ) : list.data.length === 0 ? (
          <EmptyState
            icon={Skull}
            title="Belum ada catatan kematian"
            description="Catat kematian harian agar populasi dan warning tetap akurat."
            action={
              <Button size="sm" variant="outline" onClick={openCreate} icon={<Plus className="h-3.5 w-3.5" />}>
                Catat kematian
              </Button>
            }
          />
        ) : (
          <>
            <Table minWidth="min-w-[820px]">
              <thead>
                <tr>
                  <Th>Tanggal</Th>
                  <Th>Kelompok</Th>
                  <Th className="text-right">Jumlah</Th>
                  <Th>Penyebab</Th>
                  <Th>Catatan</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((record) => (
                  <tr key={record.id} className="transition hover:bg-stone-50/60">
                    <Td className="text-xs font-medium text-stone-700">{formatDate(record.record_date)}</Td>
                    <Td>
                      <Badge tone="stone">{record.batch?.name ?? `Kelompok #${record.batch_id}`}</Badge>
                    </Td>
                    <Td className="text-right text-xs font-bold text-rose-600">
                      {formatNumber(record.count)} ekor
                    </Td>
                    <Td className="max-w-[180px]">
                      <p className="truncate text-xs text-stone-600">{record.cause || '—'}</p>
                    </Td>
                    <Td className="max-w-[220px]">
                      <p className="truncate text-xs text-stone-400">{record.notes || '—'}</p>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="Edit kematian" onClick={() => openEdit(record)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Hapus kematian"
                          className="text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => remove(record)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={page}
              totalPages={list.meta?.total_pages ?? 1}
              total={list.meta?.total ?? 0}
              onChange={setPage}
            />
          </>
        )}
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit catatan kematian' : 'Catat kematian'}
        description="Jumlah kematian akan langsung mengurangi populasi kelompok. Pastikan tanggal dan kelompok sudah benar."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="mortality-form" loading={saving}>
              {editing ? 'Simpan perubahan' : 'Simpan kematian'}
            </Button>
          </>
        }
      >
        <form id="mortality-form" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kelompok" htmlFor="mortality-batch" required>
              <Select
                id="mortality-batch"
                required
                value={form.batch_id}
                onChange={(event) => setForm({ ...form, batch_id: event.target.value })}
              >
                <option value="">Pilih kelompok</option>
                {batchRows.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name} · {formatNumber(batch.current_population)} ekor
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tanggal kematian" htmlFor="mortality-date" required>
              <Input
                id="mortality-date"
                type="date"
                required
                max={todayISO()}
                value={form.record_date}
                onChange={(event) => setForm({ ...form, record_date: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jumlah kematian (ekor)" htmlFor="mortality-count" required>
              <Input
                id="mortality-count"
                type="number"
                min={1}
                required
                value={form.count}
                onChange={(event) => setForm({ ...form, count: event.target.value })}
                placeholder="Contoh: 3"
              />
            </Field>
            <Field label="Penyebab" htmlFor="mortality-cause" hint="Opsional bila belum diketahui.">
              <Input
                id="mortality-cause"
                value={form.cause}
                onChange={(event) => setForm({ ...form, cause: event.target.value })}
                placeholder="Contoh: panas, stres, penyakit"
              />
            </Field>
          </div>
          <Field label="Catatan" htmlFor="mortality-notes">
            <Textarea
              id="mortality-notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Detail kondisi atau tindakan yang sudah dilakukan."
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
