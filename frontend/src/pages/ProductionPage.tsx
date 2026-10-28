import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  CalendarDays,
  Egg,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
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
import { SectionCard } from '../components/ui/Card'
import { Table, Td, Th } from '../components/ui/Table'
import { Pagination } from '../components/ui/Pagination'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingBlock, ErrorBlock } from '../components/ui/Feedback'
import { ChartCard } from '../components/charts/ChartCard'
import { ChartTooltip, numberTooltip } from '../components/charts/ChartTooltip'
import { CHART_COLORS, axisStyle, chartMargins, gridStroke } from '../components/charts/theme'
import { useApi, usePage } from '../hooks/useApi'
import { useConfirm } from '../providers/ConfirmProvider'
import { useToast } from '../providers/ToastProvider'
import { usePageTitle } from '../components/ProtectedRoute'
import { api, getErrorMessage } from '../services/api'
import type { BatchStats, EggProduction, ProductionSummary } from '../types'
import {
  addDaysISO,
  formatDate,
  todayISO,
  weekdayName,
} from '../utils/date'
import { formatNumber } from '../utils/format'

interface ProductionForm {
  production_date: string
  batch_id: string
  egg_count: string
  notes: string
}

const emptyForm = (): ProductionForm => ({
  production_date: todayISO(),
  batch_id: '',
  egg_count: '',
  notes: '',
})

export function ProductionPage() {
  usePageTitle('Produksi Telur')
  const toast = useToast()
  const { confirm } = useConfirm()
  const [from, setFrom] = useState(addDaysISO(todayISO(), -29))
  const [to, setTo] = useState(todayISO())
  const [batchFilter, setBatchFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EggProduction | null>(null)
  const [form, setForm] = useState<ProductionForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const { data: batches } = useApi<BatchStats[]>('/batches', { status: 'all' })
  const summary = useApi<ProductionSummary>('/productions/summary', {
    from,
    to,
    group_by: 'day',
    batch_id: batchFilter || undefined,
  })
  const list = usePage<EggProduction>('/productions', {
    from,
    to,
    batch_id: batchFilter || undefined,
    page,
    limit: 10,
  })

  const updateFilter = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom)
    setTo(nextTo)
    setPage(1)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (production: EggProduction) => {
    setEditing(production)
    setForm({
      production_date: production.production_date.slice(0, 10),
      batch_id: production.batch_id ? String(production.batch_id) : '',
      egg_count: String(production.egg_count),
      notes: production.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.egg_count || Number(form.egg_count) <= 0) {
      toast.error('Jumlah telur harus lebih besar dari 0.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        production_date: form.production_date,
        batch_id: form.batch_id ? Number(form.batch_id) : null,
        egg_count: Number(form.egg_count),
        notes: form.notes,
      }
      if (editing) {
        await api.put(`/productions/${editing.id}`, payload)
        toast.success('Catatan produksi berhasil diperbarui.')
      } else {
        await api.post('/productions', payload)
        toast.success('Produksi telur berhasil dicatat.')
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

  const handleDelete = async (production: EggProduction) => {
    const approved = await confirm({
      title: 'Hapus catatan produksi?',
      description: `Produksi ${formatNumber(production.egg_count)} butir tanggal ${formatDate(production.production_date)} akan dihapus. Tindakan ini tercatat pada riwayat aktivitas.`,
      confirmLabel: 'Hapus',
      danger: true,
    })
    if (!approved) return
    try {
      await api.delete(`/productions/${production.id}`)
      toast.success('Catatan produksi dihapus.')
      list.reload()
      summary.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const total = summary.data?.total_eggs ?? 0
  const average = summary.data?.average_eggs ?? 0
  const days = summary.data?.total_days ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operasional"
        title="Produksi Telur"
        description="Catat jumlah telur yang dihasilkan setiap hari. Produksi tidak otomatis dianggap terjual."
        actions={
          <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Catat produksi
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
            onChange={(event) => updateFilter(event.target.value, to)}
            className="h-9 w-auto py-1.5 text-xs"
          />
          <span className="text-xs text-stone-400">sampai</span>
          <Input
            type="date"
            value={to}
            min={from}
            max={todayISO()}
            onChange={(event) => updateFilter(from, event.target.value)}
            className="h-9 w-auto py-1.5 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: '7 hari', days: 7 },
            { label: '30 hari', days: 30 },
            { label: '90 hari', days: 90 },
          ].map((preset) => (
            <button
              key={preset.days}
              type="button"
              onClick={() => updateFilter(addDaysISO(todayISO(), -(preset.days - 1)), todayISO())}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            >
              {preset.label}
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
            className="h-9 py-1.5 text-xs lg:w-52"
          >
            <option value="">Semua kelompok</option>
            {batches?.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total produksi"
          value={`${formatNumber(total)} butir`}
          hint={`Periode ${formatDate(from)} – ${formatDate(to)}`}
          icon={Egg}
          tone="emerald"
        />
        <StatCard
          label="Rata-rata harian"
          value={`${formatNumber(Math.round(average))} butir`}
          hint="Dihitung dari hari yang memiliki catatan"
          icon={TrendingUp}
          tone="sky"
        />
        <StatCard
          label="Hari tercatat"
          value={`${formatNumber(days)} hari`}
          hint={days > 0 ? `${formatNumber(Math.round(total / days))} butir per hari tercatat` : 'Belum ada catatan'}
          icon={CalendarDays}
          tone="amber"
        />
      </div>

      <ChartCard
        title="Grafik produksi harian"
        description="Jumlah telur per hari pada periode terpilih."
        action={<span className="text-[11px] font-semibold text-stone-400">butir</span>}
      >
        {summary.loading && !summary.data ? (
          <LoadingBlock label="Memuat grafik..." />
        ) : (summary.data?.points.length ?? 0) === 0 ? (
          <EmptyState
            icon={Egg}
            title="Belum ada data produksi"
            description="Catat produksi telur hari ini untuk mulai melihat grafik."
            action={<Button size="sm" onClick={openCreate}>Catat produksi</Button>}
          />
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={summary.data?.points ?? []} margin={chartMargins}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={46} />
              <Tooltip content={<ChartTooltip valueFormatter={numberTooltip} />} />
              <Bar
                dataKey="eggs"
                name="Produksi"
                fill={CHART_COLORS.emerald}
                radius={[5, 5, 0, 0]}
                maxBarSize={34}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <SectionCard
        title="Riwayat produksi"
        description="Catatan terbaru berdasarkan periode dan kelompok yang dipilih."
        bodyClassName="p-0"
        action={
          <span className="text-[11px] font-medium text-stone-400">
            {formatNumber(list.meta?.total ?? 0)} catatan
          </span>
        }
      >
        {list.loading && list.data.length === 0 ? (
          <LoadingBlock label="Memuat riwayat produksi..." />
        ) : list.error ? (
          <ErrorBlock message={list.error} onRetry={list.reload} />
        ) : list.data.length === 0 ? (
          <EmptyState
            icon={Egg}
            title="Belum ada catatan produksi"
            description="Tidak ada produksi pada periode ini. Ubah filter tanggal atau tambahkan catatan baru."
            action={<Button size="sm" variant="outline" onClick={openCreate}>Tambah catatan</Button>}
          />
        ) : (
          <>
            <Table minWidth="min-w-[680px]">
              <thead>
                <tr>
                  <Th>Tanggal</Th>
                  <Th>Kelompok</Th>
                  <Th className="text-right">Jumlah telur</Th>
                  <Th>Catatan</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((production) => (
                  <tr key={production.id} className="transition hover:bg-stone-50/60">
                    <Td>
                      <p className="font-medium text-stone-800">{formatDate(production.production_date)}</p>
                      <p className="text-[11px] text-stone-400">{weekdayName(production.production_date)}</p>
                    </Td>
                    <Td>
                      {production.batch ? (
                        <span className="rounded-lg bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600">
                          {production.batch.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-400">Seluruh kandang</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <span className="text-sm font-bold text-stone-900">{formatNumber(production.egg_count)}</span>
                      <span className="ml-1 text-[11px] text-stone-400">butir</span>
                    </Td>
                    <Td className="max-w-[240px]">
                      <p className="truncate text-xs text-stone-500">{production.notes || '—'}</p>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(production)}
                          title="Edit catatan"
                          aria-label="Edit catatan"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(production)}
                          title="Hapus catatan"
                          aria-label="Hapus catatan"
                          className="text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {list.meta && (
              <Pagination
                page={list.meta.page}
                totalPages={list.meta.total_pages}
                total={list.meta.total}
                onChange={setPage}
              />
            )}
          </>
        )}
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit catatan produksi' : 'Catat produksi telur'}
        description={
          editing
            ? `Perbarui catatan tanggal ${formatDate(editing.production_date)}.`
            : 'Satu tanggal hanya boleh memiliki satu catatan per kelompok. Kosongkan kelompok untuk catatan seluruh kandang.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="production-form" loading={saving}>
              {editing ? 'Simpan perubahan' : 'Simpan produksi'}
            </Button>
          </>
        }
      >
        <form id="production-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal produksi" htmlFor="production-date" required>
              <Input
                id="production-date"
                type="date"
                required
                max={todayISO()}
                value={form.production_date}
                onChange={(event) => setForm({ ...form, production_date: event.target.value })}
              />
            </Field>
            <Field label="Kelompok puyuh" htmlFor="production-batch" hint="Opsional, untuk produksi per batch.">
              <Select
                id="production-batch"
                value={form.batch_id}
                onChange={(event) => setForm({ ...form, batch_id: event.target.value })}
              >
                <option value="">Seluruh kandang</option>
                {batches?.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name} · {formatNumber(batch.current_population)} ekor
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            label="Jumlah telur (butir)"
            htmlFor="production-count"
            required
            hint="Masukkan hasil hitung telur hari tersebut, bukan jumlah yang terjual."
          >
            <Input
              id="production-count"
              type="number"
              min={1}
              required
              value={form.egg_count}
              onChange={(event) => setForm({ ...form, egg_count: event.target.value })}
              placeholder="Contoh: 950"
            />
          </Field>
          <Field label="Catatan tambahan" htmlFor="production-notes">
            <Textarea
              id="production-notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Misalnya kondisi cuaca, perubahan pakan, atau hal lain yang memengaruhi produksi."
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
