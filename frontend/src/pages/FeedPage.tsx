import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CalendarDays,
  CircleDollarSign,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  TrendingUp,
  Wheat,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { SectionCard } from '../components/ui/Card'
import { Table, Td, Th } from '../components/ui/Table'
import { Pagination } from '../components/ui/Pagination'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingBlock, ErrorBlock } from '../components/ui/Feedback'
import { ChartCard } from '../components/charts/ChartCard'
import { ChartTooltip, currencyTooltip, numberTooltip } from '../components/charts/ChartTooltip'
import { CHART_COLORS, axisStyle, chartMargins, gridStroke } from '../components/charts/theme'
import { useApi, usePage } from '../hooks/useApi'
import { useConfirm } from '../providers/ConfirmProvider'
import { useToast } from '../providers/ToastProvider'
import { usePageTitle } from '../components/ProtectedRoute'
import { api, getErrorMessage } from '../services/api'
import type { FeedPriceHistory, FeedReceipt, FeedSummary } from '../types'
import { addDaysISO, formatDate, formatDateShort, todayISO } from '../utils/date'
import { formatCurrency, formatDecimal, formatNumber } from '../utils/format'
import { FEED_TYPES, feedTypeLabel } from '../utils/constants'

interface ReceiptForm {
  received_date: string
  feed_type: string
  sacks: string
  price_per_sack: string
  notes: string
}

interface PriceForm {
  feed_type: string
  price_per_sack: string
  effective_date: string
  notes: string
}

const emptyReceipt = (): ReceiptForm => ({
  received_date: todayISO(),
  feed_type: 'layer',
  sacks: '',
  price_per_sack: '',
  notes: '',
})

const emptyPrice = (): PriceForm => ({
  feed_type: 'layer',
  price_per_sack: '',
  effective_date: todayISO(),
  notes: '',
})

export function FeedPage() {
  usePageTitle('Manajemen Pakan')
  const toast = useToast()
  const { confirm } = useConfirm()
  const [from, setFrom] = useState(addDaysISO(todayISO(), -89))
  const [to, setTo] = useState(todayISO())
  const [page, setPage] = useState(1)
  const [receiptModal, setReceiptModal] = useState(false)
  const [priceModal, setPriceModal] = useState(false)
  const [editing, setEditing] = useState<FeedReceipt | null>(null)
  const [receiptForm, setReceiptForm] = useState<ReceiptForm>(emptyReceipt)
  const [priceForm, setPriceForm] = useState<PriceForm>(emptyPrice)
  const [saving, setSaving] = useState(false)

  const summary = useApi<FeedSummary>('/feed/summary', { from, to })
  const receipts = usePage<FeedReceipt>('/feed-receipts', { from, to, limit: 200 })
  const prices = useApi<FeedPriceHistory[]>('/feed-prices', {
    from: addDaysISO(todayISO(), -365),
    to: todayISO(),
  })

  const receiptRows = receipts.data ?? []
  const chartReceipts = useMemo(
    () =>
      [...receiptRows]
        .sort((a, b) => a.received_date.localeCompare(b.received_date))
        .map((receipt) => ({
          label: formatDateShort(receipt.received_date),
          sacks: receipt.sacks,
          total: receipt.sacks * receipt.price_per_sack,
        })),
    [receiptRows],
  )
  const priceRows = useMemo(
    () =>
      (prices.data ?? []).map((price) => ({
        label: formatDateShort(price.effective_date),
        price: price.price_per_sack,
      })),
    [prices.data],
  )

  const pageSize = 8
  const totalPages = Math.max(1, Math.ceil(receiptRows.length / pageSize))
  const visibleReceipts = receiptRows.slice((page - 1) * pageSize, page * pageSize)

  const openCreate = () => {
    setEditing(null)
    setReceiptForm({ ...emptyReceipt(), price_per_sack: String(summary.data?.latest_price || '') })
    setReceiptModal(true)
  }

  const openEdit = (receipt: FeedReceipt) => {
    setEditing(receipt)
    setReceiptForm({
      received_date: receipt.received_date.slice(0, 10),
      feed_type: receipt.feed_type,
      sacks: String(receipt.sacks),
      price_per_sack: String(receipt.price_per_sack),
      notes: receipt.notes ?? '',
    })
    setReceiptModal(true)
  }

  const submitReceipt = async (event: FormEvent) => {
    event.preventDefault()
    if (Number(receiptForm.sacks) <= 0) {
      toast.error('Jumlah pakan harus lebih besar dari 0.')
      return
    }
    if (Number(receiptForm.price_per_sack) <= 0) {
      toast.error('Harga per sak harus lebih besar dari 0.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        received_date: receiptForm.received_date,
        feed_type: receiptForm.feed_type,
        sacks: Number(receiptForm.sacks),
        price_per_sack: Number(receiptForm.price_per_sack),
        notes: receiptForm.notes,
      }
      if (editing) {
        await api.put(`/feed-receipts/${editing.id}`, payload)
        toast.success('Penerimaan pakan diperbarui.')
      } else {
        await api.post('/feed-receipts', payload)
        toast.success('Penerimaan pakan dicatat.')
      }
      setReceiptModal(false)
      summary.reload()
      receipts.reload()
      prices.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const deleteReceipt = async (receipt: FeedReceipt) => {
    const approved = await confirm({
      title: 'Hapus penerimaan pakan?',
      description: `Penerimaan ${formatDecimal(receipt.sacks)} sak tanggal ${formatDate(receipt.received_date)} akan dihapus. Riwayat harga tetap disimpan.`,
      confirmLabel: 'Hapus',
      danger: true,
    })
    if (!approved) return
    try {
      await api.delete(`/feed-receipts/${receipt.id}`)
      toast.success('Penerimaan pakan dihapus. Riwayat harga tetap tersimpan.')
      summary.reload()
      receipts.reload()
      prices.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const submitPrice = async (event: FormEvent) => {
    event.preventDefault()
    if (Number(priceForm.price_per_sack) <= 0) {
      toast.error('Harga per sak harus lebih besar dari 0.')
      return
    }
    setSaving(true)
    try {
      await api.post('/feed-prices', {
        feed_type: priceForm.feed_type,
        price_per_sack: Number(priceForm.price_per_sack),
        effective_date: priceForm.effective_date,
        notes: priceForm.notes,
      })
      toast.success('Perubahan harga pakan dicatat.')
      setPriceModal(false)
      setPriceForm(emptyPrice())
      summary.reload()
      prices.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operasional"
        title="Manajemen Pakan"
        description="Catat pakan yang diterima setiap Senin dan simpan setiap perubahan harga tanpa menimpa riwayat lama."
        actions={
          <>
            <Button variant="secondary" onClick={() => setPriceModal(true)} icon={<TrendingUp className="h-4 w-4" />}>
              Catat perubahan harga
            </Button>
            <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
              Catat penerimaan
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4 text-stone-400" />
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(event) => {
              setFrom(event.target.value)
              setPage(1)
            }}
            className="h-9 w-auto py-1.5 text-xs"
          />
          <span className="text-xs text-stone-400">sampai</span>
          <Input
            type="date"
            value={to}
            min={from}
            max={todayISO()}
            onChange={(event) => {
              setTo(event.target.value)
              setPage(1)
            }}
            className="h-9 w-auto py-1.5 text-xs"
          />
        </div>
        <div className="flex gap-1.5 sm:ml-auto">
          {[30, 90, 180].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => {
                setFrom(addDaysISO(todayISO(), -(days - 1)))
                setTo(todayISO())
                setPage(1)
              }}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            >
              {days} hari
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total pakan diterima"
          value={`${formatDecimal(summary.data?.total_sacks ?? 0)} sak`}
          hint={`${formatNumber(summary.data?.receipts ?? 0)} kali penerimaan`}
          icon={Wheat}
          tone="amber"
        />
        <StatCard
          label="Pengeluaran pakan"
          value={formatCurrency(summary.data?.total_spend ?? 0)}
          hint={`Rata-rata ${formatCurrency(summary.data?.average_price ?? 0)} per sak`}
          icon={CircleDollarSign}
          tone="rose"
        />
        <StatCard
          label="Harga terakhir"
          value={formatCurrency(summary.data?.latest_price ?? 0)}
          hint="Harga per sak yang berlaku saat ini"
          icon={TrendingUp}
          tone="sky"
        />
        <StatCard
          label="Riwayat harga"
          value={`${formatNumber(prices.data?.length ?? 0)} catatan`}
          hint="Harga lama tetap tersimpan"
          icon={Receipt}
          tone="violet"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Perubahan harga pakan"
          description="Setiap perubahan harga disimpan sebagai riwayat."
          action={<Badge tone="amber">{formatCurrency(summary.data?.latest_price ?? 0)}/sak</Badge>}
        >
          {priceRows.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Belum ada riwayat harga"
              description="Harga akan tercatat otomatis saat penerimaan pakan pertama."
              className="py-10"
            />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={priceRows} margin={chartMargins}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={18} />
                <YAxis
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                  tickFormatter={(value) => `${Math.round(Number(value) / 1000)}rb`}
                />
                <Tooltip content={<ChartTooltip valueFormatter={currencyTooltip} />} />
                <Line
                  type="stepAfter"
                  dataKey="price"
                  name="Harga/sak"
                  stroke={CHART_COLORS.amber}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: CHART_COLORS.amber, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Jumlah pakan diterima" description="Jumlah sak pada setiap penerimaan.">
          {chartReceipts.length === 0 ? (
            <EmptyState
              icon={Wheat}
              title="Belum ada penerimaan pakan"
              description="Catat pakan yang diberikan PT untuk melihat grafik."
              className="py-10"
            />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartReceipts} margin={chartMargins}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<ChartTooltip valueFormatter={numberTooltip} />} />
                <Bar
                  dataKey="sacks"
                  name="Sak"
                  fill={CHART_COLORS.emeraldSoft}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <SectionCard
        title="Riwayat penerimaan pakan"
        description="Data penerimaan tetap menyimpan harga yang berlaku saat transaksi dicatat."
        bodyClassName="p-0"
        action={<span className="text-[11px] text-stone-400">{formatNumber(receiptRows.length)} penerimaan</span>}
      >
        {receipts.loading && receiptRows.length === 0 ? (
          <LoadingBlock label="Memuat penerimaan pakan..." />
        ) : receipts.error ? (
          <ErrorBlock message={receipts.error} onRetry={receipts.reload} />
        ) : receiptRows.length === 0 ? (
          <EmptyState
            icon={Wheat}
            title="Belum ada penerimaan pakan"
            description="Pakan dari PT biasanya diterima setiap Senin. Catat penerimaan pertama."
            action={<Button size="sm" variant="outline" onClick={openCreate}>Catat penerimaan</Button>}
          />
        ) : (
          <>
            <Table minWidth="min-w-[820px]">
              <thead>
                <tr>
                  <Th>Tanggal terima</Th>
                  <Th>Jenis pakan</Th>
                  <Th className="text-right">Jumlah</Th>
                  <Th className="text-right">Harga / sak</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Catatan</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {visibleReceipts.map((receipt) => (
                  <tr key={receipt.id} className="transition hover:bg-stone-50/60">
                    <Td>
                      <p className="font-medium text-stone-800">{formatDate(receipt.received_date)}</p>
                    </Td>
                    <Td>
                      <Badge tone="stone">{feedTypeLabel(receipt.feed_type)}</Badge>
                    </Td>
                    <Td className="text-right font-semibold text-stone-800">
                      {formatDecimal(receipt.sacks)} <span className="text-[11px] font-normal text-stone-400">sak</span>
                    </Td>
                    <Td className="text-right text-xs text-stone-600">{formatCurrency(receipt.price_per_sack)}</Td>
                    <Td className="text-right text-xs font-bold text-stone-800">
                      {formatCurrency(receipt.sacks * receipt.price_per_sack)}
                    </Td>
                    <Td className="max-w-[220px]">
                      <p className="truncate text-xs text-stone-500">{receipt.notes || '—'}</p>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(receipt)} aria-label="Edit penerimaan">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteReceipt(receipt)}
                          aria-label="Hapus penerimaan"
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
            <Pagination page={page} totalPages={totalPages} total={receiptRows.length} onChange={setPage} />
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Riwayat perubahan harga"
        description="Harga lama tidak ditimpa. Setiap perubahan memiliki tanggal berlaku."
        bodyClassName="p-0"
        action={
          <Button size="sm" variant="outline" onClick={() => setPriceModal(true)} icon={<Plus className="h-3.5 w-3.5" />}>
            Tambah harga
          </Button>
        }
      >
        {prices.loading && !prices.data ? (
          <LoadingBlock label="Memuat riwayat harga..." />
        ) : (prices.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Belum ada riwayat harga"
            description="Harga pakan akan tercatat otomatis saat penerimaan pertama."
          />
        ) : (
          <Table minWidth="min-w-[620px]">
            <thead>
              <tr>
                <Th>Tanggal berlaku</Th>
                <Th>Jenis</Th>
                <Th className="text-right">Harga / sak</Th>
                <Th>Sumber</Th>
                <Th>Catatan</Th>
              </tr>
            </thead>
            <tbody>
              {[...(prices.data ?? [])].reverse().map((price) => (
                <tr key={price.id} className="transition hover:bg-stone-50/60">
                  <Td className="text-xs font-medium text-stone-700">{formatDate(price.effective_date)}</Td>
                  <Td>
                    <Badge tone="stone">{feedTypeLabel(price.feed_type)}</Badge>
                  </Td>
                  <Td className="text-right text-xs font-bold text-stone-800">
                    {formatCurrency(price.price_per_sack)}
                  </Td>
                  <Td className="text-[11px] text-stone-400">
                    {price.feed_receipt_id ? `Penerimaan #${price.feed_receipt_id}` : 'Perubahan manual'}
                  </Td>
                  <Td className="max-w-[260px]">
                    <p className="truncate text-xs text-stone-500">{price.notes || '—'}</p>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal
        open={receiptModal}
        onClose={() => setReceiptModal(false)}
        title={editing ? 'Edit penerimaan pakan' : 'Catat penerimaan pakan'}
        description="Pakan umumnya diterima setiap Senin. Jika harga berbeda dari catatan terakhir, riwayat harga baru akan dibuat otomatis."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceiptModal(false)}>
              Batal
            </Button>
            <Button type="submit" form="feed-form" loading={saving}>
              {editing ? 'Simpan perubahan' : 'Simpan penerimaan'}
            </Button>
          </>
        }
      >
        <form id="feed-form" onSubmit={submitReceipt} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal penerimaan" htmlFor="feed-date" required>
              <Input
                id="feed-date"
                type="date"
                required
                max={todayISO()}
                value={receiptForm.received_date}
                onChange={(event) => setReceiptForm({ ...receiptForm, received_date: event.target.value })}
              />
            </Field>
            <Field label="Jenis pakan" htmlFor="feed-type" required>
              <Select
                id="feed-type"
                value={receiptForm.feed_type}
                onChange={(event) => setReceiptForm({ ...receiptForm, feed_type: event.target.value })}
              >
                {FEED_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jumlah pakan (sak)" htmlFor="feed-sacks" required hint="Boleh berupa desimal, misalnya 20,5.">
              <Input
                id="feed-sacks"
                type="number"
                min={0.1}
                step="0.1"
                required
                value={receiptForm.sacks}
                onChange={(event) => setReceiptForm({ ...receiptForm, sacks: event.target.value })}
                placeholder="Contoh: 20"
              />
            </Field>
            <Field label="Harga per sak (Rp)" htmlFor="feed-price" required>
              <Input
                id="feed-price"
                type="number"
                min={1}
                required
                value={receiptForm.price_per_sack}
                onChange={(event) => setReceiptForm({ ...receiptForm, price_per_sack: event.target.value })}
                placeholder="Contoh: 402000"
              />
            </Field>
          </div>
          <Field label="Catatan" htmlFor="feed-notes">
            <Textarea
              id="feed-notes"
              value={receiptForm.notes}
              onChange={(event) => setReceiptForm({ ...receiptForm, notes: event.target.value })}
              placeholder="Misalnya kondisi pakan, nomor surat jalan, atau catatan lain."
            />
          </Field>
          {receiptForm.sacks && receiptForm.price_per_sack && (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Total pembelian:{' '}
              <span className="font-bold">
                {formatCurrency(Number(receiptForm.sacks) * Number(receiptForm.price_per_sack))}
              </span>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={priceModal}
        onClose={() => setPriceModal(false)}
        title="Catat perubahan harga pakan"
        description="Gunakan untuk mencatat harga baru di luar penerimaan pakan. Harga lama tetap tersimpan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPriceModal(false)}>
              Batal
            </Button>
            <Button type="submit" form="price-form" loading={saving}>
              Simpan harga
            </Button>
          </>
        }
      >
        <form id="price-form" onSubmit={submitPrice} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jenis pakan" htmlFor="price-type" required>
              <Select
                id="price-type"
                value={priceForm.feed_type}
                onChange={(event) => setPriceForm({ ...priceForm, feed_type: event.target.value })}
              >
                {FEED_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tanggal berlaku" htmlFor="price-date" required>
              <Input
                id="price-date"
                type="date"
                required
                max={todayISO()}
                value={priceForm.effective_date}
                onChange={(event) => setPriceForm({ ...priceForm, effective_date: event.target.value })}
              />
            </Field>
          </div>
          <Field
            label="Harga per sak (Rp)"
            htmlFor="price-value"
            required
            hint={`Harga terakhir: ${formatCurrency(summary.data?.latest_price ?? 0)} per sak.`}
          >
            <Input
              id="price-value"
              type="number"
              min={1}
              required
              value={priceForm.price_per_sack}
              onChange={(event) => setPriceForm({ ...priceForm, price_per_sack: event.target.value })}
              placeholder="Contoh: 418000"
            />
          </Field>
          <Field label="Catatan" htmlFor="price-notes">
            <Textarea
              id="price-notes"
              value={priceForm.notes}
              onChange={(event) => setPriceForm({ ...priceForm, notes: event.target.value })}
              placeholder="Alasan perubahan harga atau sumber informasi harga."
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
