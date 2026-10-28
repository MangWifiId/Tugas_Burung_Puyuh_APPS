import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Egg,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { SectionCard } from '../components/ui/Card'
import { Table, Td, Th } from '../components/ui/Table'
import { Pagination } from '../components/ui/Pagination'
import { Tabs } from '../components/ui/Tabs'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingBlock, ErrorBlock } from '../components/ui/Feedback'
import { useApi, usePage } from '../hooks/useApi'
import { useConfirm } from '../providers/ConfirmProvider'
import { useToast } from '../providers/ToastProvider'
import { usePageTitle } from '../components/ProtectedRoute'
import { api, getErrorMessage } from '../services/api'
import type { EggPickup, SalesNote, SalesSummary } from '../types'
import {
  addDaysISO,
  formatDate,
  formatDateLong,
  isPickupDay,
  todayISO,
  weekdayName,
} from '../utils/date'
import { formatCurrency, formatNumber } from '../utils/format'
import { PICKUP_STATUSES } from '../utils/constants'
import { cn } from '../utils/cn'

interface PickupForm {
  pickup_date: string
  egg_count: string
  price_per_unit: string
  status: 'pending' | 'invoiced'
  notes: string
}

interface NoteForm {
  note_number: string
  note_date: string
  period_start: string
  period_end: string
  total_amount: string
  feed_deduction: string
  notes: string
  pickup_ids: number[]
}

const emptyPickup = (): PickupForm => ({
  pickup_date: todayISO(),
  egg_count: '',
  price_per_unit: '',
  status: 'pending',
  notes: '',
})

const emptyNote = (): NoteForm => ({
  note_number: '',
  note_date: todayISO(),
  period_start: addDaysISO(todayISO(), -3),
  period_end: todayISO(),
  total_amount: '',
  feed_deduction: '',
  notes: '',
  pickup_ids: [],
})

export function SalesPage() {
  usePageTitle('Penjualan PT')
  const toast = useToast()
  const { confirm } = useConfirm()
  const [tab, setTab] = useState<'pickups' | 'notes'>('pickups')
  const [from, setFrom] = useState(addDaysISO(todayISO(), -29))
  const [to, setTo] = useState(todayISO())
  const [pickupPage, setPickupPage] = useState(1)
  const [notePage, setNotePage] = useState(1)

  const [pickupModal, setPickupModal] = useState(false)
  const [editingPickup, setEditingPickup] = useState<EggPickup | null>(null)
  const [pickupForm, setPickupForm] = useState<PickupForm>(emptyPickup)
  const [savingPickup, setSavingPickup] = useState(false)

  const [noteModal, setNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState<SalesNote | null>(null)
  const [noteForm, setNoteForm] = useState<NoteForm>(emptyNote)
  const [savingNote, setSavingNote] = useState(false)

  const summary = useApi<SalesSummary>('/sales/summary', { from, to })
  const pickups = usePage<EggPickup>('/pickups', {
    from,
    to,
    page: pickupPage,
    limit: 8,
    status: 'all',
  })
  const notes = usePage<SalesNote>('/sales-notes', {
    from,
    to,
    page: notePage,
    limit: 8,
  })
  const linkable = useApi<EggPickup[]>('/pickups/linkable', {
    from: addDaysISO(to, -180),
    to,
  })

  const availablePickups = useMemo(() => {
    const map = new Map<number, EggPickup>()
    linkable.data?.forEach((pickup) => map.set(pickup.id, pickup))
    editingNote?.pickups?.forEach((pickup) => map.set(pickup.id, pickup))
    return Array.from(map.values()).sort((a, b) => b.pickup_date.localeCompare(a.pickup_date))
  }, [linkable.data, editingNote])

  const pickupsTotalSelected = useMemo(
    () =>
      availablePickups
        .filter((pickup) => noteForm.pickup_ids.includes(pickup.id))
        .reduce((total, pickup) => total + pickup.egg_count, 0),
    [availablePickups, noteForm.pickup_ids],
  )

  const reloadAll = () => {
    summary.reload()
    pickups.reload()
    notes.reload()
    linkable.reload()
  }

  const updateRange = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom)
    setTo(nextTo)
    setPickupPage(1)
    setNotePage(1)
  }

  const openPickupCreate = () => {
    setEditingPickup(null)
    setPickupForm(emptyPickup())
    setPickupModal(true)
  }

  const openPickupEdit = (pickup: EggPickup) => {
    setEditingPickup(pickup)
    setPickupForm({
      pickup_date: pickup.pickup_date.slice(0, 10),
      egg_count: String(pickup.egg_count),
      price_per_unit: pickup.price_per_unit ? String(pickup.price_per_unit) : '',
      status: pickup.status,
      notes: pickup.notes ?? '',
    })
    setPickupModal(true)
  }

  const submitPickup = async (event: FormEvent) => {
    event.preventDefault()
    if (!pickupForm.egg_count || Number(pickupForm.egg_count) <= 0) {
      toast.error('Jumlah telur harus lebih besar dari 0.')
      return
    }
    setSavingPickup(true)
    try {
      const payload = {
        pickup_date: pickupForm.pickup_date,
        egg_count: Number(pickupForm.egg_count),
        price_per_unit: pickupForm.price_per_unit ? Number(pickupForm.price_per_unit) : null,
        status: pickupForm.status,
        notes: pickupForm.notes,
      }
      if (editingPickup) {
        await api.put(`/pickups/${editingPickup.id}`, payload)
        toast.success('Pengambilan telur diperbarui.')
      } else {
        await api.post('/pickups', payload)
        toast.success('Pengambilan telur dicatat.')
      }
      setPickupModal(false)
      reloadAll()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingPickup(false)
    }
  }

  const deletePickup = async (pickup: EggPickup) => {
    const approved = await confirm({
      title: 'Hapus pengambilan telur?',
      description: `Pengambilan ${formatNumber(pickup.egg_count)} butir tanggal ${formatDate(pickup.pickup_date)} akan dihapus. Pengambilan yang sudah terhubung nota tidak dapat dihapus.`,
      confirmLabel: 'Hapus',
      danger: true,
    })
    if (!approved) return
    try {
      await api.delete(`/pickups/${pickup.id}`)
      toast.success('Pengambilan telur dihapus.')
      reloadAll()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const openNoteCreate = () => {
    setEditingNote(null)
    setNoteForm(emptyNote())
    setNoteModal(true)
  }

  const openNoteEdit = (note: SalesNote) => {
    setEditingNote(note)
    setNoteForm({
      note_number: note.note_number,
      note_date: note.note_date.slice(0, 10),
      period_start: note.period_start?.slice(0, 10) ?? '',
      period_end: note.period_end?.slice(0, 10) ?? '',
      total_amount: String(note.total_amount),
      feed_deduction: String(note.feed_deduction ?? 0),
      notes: note.notes ?? '',
      pickup_ids: note.pickups?.map((pickup) => pickup.id) ?? [],
    })
    setNoteModal(true)
  }

  const submitNote = async (event: FormEvent) => {
    event.preventDefault()
    if (!noteForm.note_number.trim()) {
      toast.error('Nomor nota wajib diisi.')
      return
    }
    setSavingNote(true)
    try {
      const payload = {
        note_number: noteForm.note_number.trim(),
        note_date: noteForm.note_date,
        period_start: noteForm.period_start || null,
        period_end: noteForm.period_end || null,
        total_eggs: pickupsTotalSelected,
        total_amount: Number(noteForm.total_amount || 0),
        feed_deduction: Number(noteForm.feed_deduction || 0),
        notes: noteForm.notes,
        pickup_ids: noteForm.pickup_ids,
      }
      if (editingNote) {
        await api.put(`/sales-notes/${editingNote.id}`, payload)
        toast.success('Nota PT diperbarui.')
      } else {
        await api.post('/sales-notes', payload)
        toast.success('Nota PT dicatat.')
      }
      setNoteModal(false)
      reloadAll()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingNote(false)
    }
  }

  const deleteNote = async (note: SalesNote) => {
    const approved = await confirm({
      title: 'Hapus nota PT?',
      description: `Nota ${note.note_number} akan dihapus. Pengambilan telur yang terhubung akan kembali berstatus belum masuk nota.`,
      confirmLabel: 'Hapus nota',
      danger: true,
    })
    if (!approved) return
    try {
      await api.delete(`/sales-notes/${note.id}`)
      toast.success('Nota PT dihapus.')
      reloadAll()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const togglePickup = (id: number) => {
    setNoteForm((current) => ({
      ...current,
      pickup_ids: current.pickup_ids.includes(id)
        ? current.pickup_ids.filter((item) => item !== id)
        : [...current.pickup_ids, id],
    }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operasional"
        title="Penjualan Telur ke PT"
        description="Catat pengambilan setiap Senin dan Kamis, lalu hubungkan nota PT yang diterima pada hari Kamis."
        actions={
          tab === 'pickups' ? (
            <Button onClick={openPickupCreate} icon={<Plus className="h-4 w-4" />}>
              Catat pengambilan
            </Button>
          ) : (
            <Button onClick={openNoteCreate} icon={<Plus className="h-4 w-4" />}>
              Catat nota PT
            </Button>
          )
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
          <Tabs
            items={[
              { key: 'pickups', label: 'Pengambilan telur', count: pickups.meta?.total },
              { key: 'notes', label: 'Nota PT', count: notes.meta?.total },
            ]}
            active={tab}
            onChange={(key) => setTab(key as 'pickups' | 'notes')}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Telur diambil PT"
          value={`${formatNumber(summary.data?.total_eggs ?? 0)} butir`}
          hint={`${formatNumber(summary.data?.total_pickups ?? 0)} kali pengambilan`}
          icon={Truck}
          tone="emerald"
        />
        <StatCard
          label="Estimasi nilai"
          value={formatCurrency(summary.data?.estimated_value ?? 0)}
          hint="Berdasarkan harga per satuan saat pengambilan"
          icon={Egg}
          tone="sky"
        />
        <StatCard
          label="Pendapatan nota"
          value={formatCurrency(summary.data?.total_revenue ?? 0)}
          hint={`${formatNumber(summary.data?.note_count ?? 0)} nota diterima`}
          icon={Wallet}
          tone="violet"
        />
        <StatCard
          label="Belum masuk nota"
          value={`${formatNumber(summary.data?.pending_pickups ?? 0)} pengambilan`}
          hint="Hubungkan dengan nota PT yang sesuai"
          icon={Clock}
          tone={(summary.data?.pending_pickups ?? 0) > 0 ? 'amber' : 'stone'}
        />
      </div>

      {tab === 'pickups' ? (
        <SectionCard
          title="Riwayat pengambilan telur"
          description="PT mengambil telur setiap Senin dan Kamis. Nota diterima hari Kamis."
          bodyClassName="p-0"
          action={
            <span className="text-[11px] font-medium text-stone-400">
              {formatNumber(pickups.meta?.total ?? 0)} pengambilan
            </span>
          }
        >
          {pickups.loading && pickups.data.length === 0 ? (
            <LoadingBlock label="Memuat pengambilan telur..." />
          ) : pickups.error ? (
            <ErrorBlock message={pickups.error} onRetry={pickups.reload} />
          ) : pickups.data.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Belum ada pengambilan"
              description="Catat pengambilan telur oleh PT pada hari Senin atau Kamis."
              action={<Button size="sm" variant="outline" onClick={openPickupCreate}>Catat pengambilan</Button>}
            />
          ) : (
            <>
              <Table minWidth="min-w-[840px]">
                <thead>
                  <tr>
                    <Th>Tanggal</Th>
                    <Th className="text-right">Jumlah telur</Th>
                    <Th className="text-right">Harga / butir</Th>
                    <Th className="text-right">Estimasi nilai</Th>
                    <Th>Status</Th>
                    <Th>Catatan</Th>
                    <Th className="text-right">Aksi</Th>
                  </tr>
                </thead>
                <tbody>
                  {pickups.data.map((pickup) => (
                    <tr key={pickup.id} className="transition hover:bg-stone-50/60">
                      <Td>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-stone-800">{formatDate(pickup.pickup_date)}</p>
                            <p className="text-[11px] text-stone-400">{weekdayName(pickup.pickup_date)}</p>
                          </div>
                          {isPickupDay(pickup.pickup_date) && (
                            <Badge tone="emerald" className="hidden sm:inline-flex">
                              Jadwal PT
                            </Badge>
                          )}
                        </div>
                      </Td>
                      <Td className="text-right font-semibold text-stone-800">
                        {formatNumber(pickup.egg_count)} <span className="text-[11px] font-normal text-stone-400">butir</span>
                      </Td>
                      <Td className="text-right text-xs text-stone-600">
                        {pickup.price_per_unit ? formatCurrency(pickup.price_per_unit) : '—'}
                      </Td>
                      <Td className="text-right text-xs font-medium text-stone-700">
                        {pickup.price_per_unit
                          ? formatCurrency(pickup.price_per_unit * pickup.egg_count)
                          : '—'}
                      </Td>
                      <Td>
                        <Badge tone={pickup.status === 'invoiced' ? 'emerald' : 'amber'} dot>
                          {pickup.status === 'invoiced' ? 'Sudah masuk nota' : 'Belum masuk nota'}
                        </Badge>
                      </Td>
                      <Td className="max-w-[200px]">
                        <p className="truncate text-xs text-stone-500">{pickup.notes || '—'}</p>
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openPickupEdit(pickup)}
                            aria-label="Edit pengambilan"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deletePickup(pickup)}
                            aria-label="Hapus pengambilan"
                            title="Hapus"
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
              {pickups.meta && (
                <Pagination
                  page={pickups.meta.page}
                  totalPages={pickups.meta.total_pages}
                  total={pickups.meta.total}
                  onChange={setPickupPage}
                />
              )}
            </>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title="Nota penjualan PT"
          description="Pendapatan dicatat sesuai nilai nota. Potongan pakan dari PT hanya disimpan sebagai informasi."
          bodyClassName="p-0"
          action={
            <span className="text-[11px] font-medium text-stone-400">
              {formatNumber(notes.meta?.total ?? 0)} nota
            </span>
          }
        >
          {notes.loading && notes.data.length === 0 ? (
            <LoadingBlock label="Memuat nota PT..." />
          ) : notes.error ? (
            <ErrorBlock message={notes.error} onRetry={notes.reload} />
          ) : notes.data.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Belum ada nota PT"
              description="Nota yang diterima pada hari Kamis dapat dihubungkan dengan beberapa pengambilan sebelumnya."
              action={<Button size="sm" variant="outline" onClick={openNoteCreate}>Catat nota</Button>}
            />
          ) : (
            <>
              <Table minWidth="min-w-[860px]">
                <thead>
                  <tr>
                    <Th>Nomor nota</Th>
                    <Th>Tanggal nota</Th>
                    <Th>Periode</Th>
                    <Th className="text-right">Telur</Th>
                    <Th className="text-right">Pendapatan</Th>
                    <Th className="text-right">Potongan pakan</Th>
                    <Th className="text-center">Pengambilan</Th>
                    <Th className="text-right">Aksi</Th>
                  </tr>
                </thead>
                <tbody>
                  {notes.data.map((note) => (
                    <tr key={note.id} className="transition hover:bg-stone-50/60">
                      <Td>
                        <p className="font-semibold text-stone-800">{note.note_number}</p>
                        <p className="mt-0.5 max-w-[200px] truncate text-[11px] text-stone-400">
                          {note.notes || 'Tanpa catatan'}
                        </p>
                      </Td>
                      <Td>
                        <p className="text-xs font-medium text-stone-700">{formatDate(note.note_date)}</p>
                        <p className="text-[11px] text-stone-400">{weekdayName(note.note_date)}</p>
                      </Td>
                      <Td className="text-[11px] text-stone-500">
                        {note.period_start ? formatDate(note.period_start) : '—'}
                        {note.period_end ? ` – ${formatDate(note.period_end)}` : ''}
                      </Td>
                      <Td className="text-right text-xs font-medium text-stone-700">
                        {formatNumber(note.total_eggs)} butir
                      </Td>
                      <Td className="text-right text-xs font-bold text-emerald-800">
                        {formatCurrency(note.total_amount)}
                      </Td>
                      <Td className="text-right text-xs text-stone-500">
                        {formatCurrency(note.feed_deduction)}
                      </Td>
                      <Td className="text-center">
                        <Badge tone="stone">{formatNumber(note.pickups?.length ?? 0)}</Badge>
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openNoteEdit(note)}
                            aria-label="Edit nota"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteNote(note)}
                            aria-label="Hapus nota"
                            title="Hapus"
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
              {notes.meta && (
                <Pagination
                  page={notes.meta.page}
                  totalPages={notes.meta.total_pages}
                  total={notes.meta.total}
                  onChange={setNotePage}
                />
              )}
            </>
          )}
        </SectionCard>
      )}

      <Modal
        open={pickupModal}
        onClose={() => setPickupModal(false)}
        title={editingPickup ? 'Edit pengambilan telur' : 'Catat pengambilan telur'}
        description="Pengambilan oleh PT umumnya dilakukan Senin dan Kamis. Data di luar jadwal tetap dapat dicatat untuk koreksi."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPickupModal(false)}>
              Batal
            </Button>
            <Button type="submit" form="pickup-form" loading={savingPickup}>
              {editingPickup ? 'Simpan perubahan' : 'Simpan pengambilan'}
            </Button>
          </>
        }
      >
        <form id="pickup-form" onSubmit={submitPickup} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal pengambilan" htmlFor="pickup-date" required>
              <Input
                id="pickup-date"
                type="date"
                required
                max={todayISO()}
                value={pickupForm.pickup_date}
                onChange={(event) => setPickupForm({ ...pickupForm, pickup_date: event.target.value })}
              />
              <div className="pt-1.5">
                {pickupForm.pickup_date && (
                  <Badge tone={isPickupDay(pickupForm.pickup_date) ? 'emerald' : 'amber'} dot>
                    {isPickupDay(pickupForm.pickup_date)
                      ? `Sesuai jadwal · ${weekdayName(pickupForm.pickup_date)}`
                      : `Di luar jadwal · ${weekdayName(pickupForm.pickup_date)}`}
                  </Badge>
                )}
              </div>
            </Field>
            <Field label="Jumlah telur diambil (butir)" htmlFor="pickup-count" required>
              <Input
                id="pickup-count"
                type="number"
                min={1}
                required
                value={pickupForm.egg_count}
                onChange={(event) => setPickupForm({ ...pickupForm, egg_count: event.target.value })}
                placeholder="Contoh: 1800"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Harga jual per butir"
              htmlFor="pickup-price"
              hint="Opsional. Estimasi nilai dihitung dari harga ini."
            >
              <Input
                id="pickup-price"
                type="number"
                min={0}
                step="0.01"
                value={pickupForm.price_per_unit}
                onChange={(event) => setPickupForm({ ...pickupForm, price_per_unit: event.target.value })}
                placeholder="Contoh: 1900"
              />
            </Field>
            <Field label="Status nota" htmlFor="pickup-status">
              <Select
                id="pickup-status"
                value={pickupForm.status}
                onChange={(event) =>
                  setPickupForm({ ...pickupForm, status: event.target.value as 'pending' | 'invoiced' })
                }
              >
                {PICKUP_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Catatan transaksi" htmlFor="pickup-notes">
            <Textarea
              id="pickup-notes"
              value={pickupForm.notes}
              onChange={(event) => setPickupForm({ ...pickupForm, notes: event.target.value })}
              placeholder="Misalnya nomor kendaraan, kondisi telur, atau catatan lain."
            />
          </Field>
          {pickupForm.egg_count && pickupForm.price_per_unit && (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Estimasi nilai:{' '}
              <span className="font-bold">
                {formatCurrency(Number(pickupForm.egg_count) * Number(pickupForm.price_per_unit))}
              </span>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={noteModal}
        onClose={() => setNoteModal(false)}
        title={editingNote ? 'Edit nota PT' : 'Catat nota PT'}
        description="Aplikasi mencatat pendapatan sesuai nota. Potongan pakan tidak dihitung ulang."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoteModal(false)}>
              Batal
            </Button>
            <Button type="submit" form="note-form" loading={savingNote}>
              {editingNote ? 'Simpan perubahan' : 'Simpan nota'}
            </Button>
          </>
        }
      >
        <form id="note-form" onSubmit={submitNote} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nomor nota" htmlFor="note-number" required>
              <Input
                id="note-number"
                required
                value={noteForm.note_number}
                onChange={(event) => setNoteForm({ ...noteForm, note_number: event.target.value })}
                placeholder="Contoh: PT-202610-001"
              />
            </Field>
            <Field label="Tanggal nota diterima" htmlFor="note-date" required>
              <Input
                id="note-date"
                type="date"
                required
                max={todayISO()}
                value={noteForm.note_date}
                onChange={(event) => setNoteForm({ ...noteForm, note_date: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Awal periode" htmlFor="note-start" hint="Opsional, periode penjualan pada nota.">
              <Input
                id="note-start"
                type="date"
                value={noteForm.period_start}
                onChange={(event) => setNoteForm({ ...noteForm, period_start: event.target.value })}
              />
            </Field>
            <Field label="Akhir periode" htmlFor="note-end">
              <Input
                id="note-end"
                type="date"
                value={noteForm.period_end}
                onChange={(event) => setNoteForm({ ...noteForm, period_end: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Total pendapatan nota (Rp)"
              htmlFor="note-amount"
              required
              hint="Masukkan nilai pendapatan sesuai nota PT."
            >
              <Input
                id="note-amount"
                type="number"
                min={0}
                required
                value={noteForm.total_amount}
                onChange={(event) => setNoteForm({ ...noteForm, total_amount: event.target.value })}
                placeholder="Contoh: 6840000"
              />
            </Field>
            <Field
              label="Potongan pakan pada nota (Rp)"
              htmlFor="note-deduction"
              hint="Hanya informasi. Tidak mengurangi pendapatan secara otomatis."
            >
              <Input
                id="note-deduction"
                type="number"
                min={0}
                value={noteForm.feed_deduction}
                onChange={(event) => setNoteForm({ ...noteForm, feed_deduction: event.target.value })}
                placeholder="Contoh: 8000000"
              />
            </Field>
          </div>

          <div className="rounded-xl border border-stone-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-stone-700">Hubungkan pengambilan telur</p>
                <p className="mt-0.5 text-[11px] text-stone-400">
                  Pilih pengambilan yang tercakup dalam nota ini.
                </p>
              </div>
              <Badge tone={noteForm.pickup_ids.length > 0 ? 'emerald' : 'stone'}>
                {formatNumber(noteForm.pickup_ids.length)} dipilih · {formatNumber(pickupsTotalSelected)} butir
              </Badge>
            </div>
            <div className="mt-3 max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {availablePickups.length === 0 ? (
                <p className="rounded-lg bg-stone-50 px-3 py-4 text-center text-xs text-stone-400">
                  Belum ada pengambilan dalam 180 hari terakhir.
                </p>
              ) : (
                availablePickups.map((pickup) => {
                  const checked = noteForm.pickup_ids.includes(pickup.id)
                  return (
                    <label
                      key={pickup.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition',
                        checked
                          ? 'border-emerald-300 bg-emerald-50/60'
                          : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePickup(pickup.id)}
                        className="h-4 w-4 rounded border-stone-300 text-emerald-700 accent-emerald-700"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-stone-700">
                          {formatDate(pickup.pickup_date)} · {formatNumber(pickup.egg_count)} butir
                        </p>
                        <p className="text-[10px] text-stone-400">
                          {weekdayName(pickup.pickup_date)}
                          {pickup.price_per_unit
                            ? ` · ${formatCurrency(pickup.price_per_unit)}/butir`
                            : ' · harga belum diisi'}
                        </p>
                      </div>
                      <Badge tone={pickup.status === 'invoiced' ? 'emerald' : 'amber'}>
                        {pickup.status === 'invoiced' ? 'Masuk nota' : 'Belum'}
                      </Badge>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <Field label="Catatan transaksi" htmlFor="note-notes">
            <Textarea
              id="note-notes"
              value={noteForm.notes}
              onChange={(event) => setNoteForm({ ...noteForm, notes: event.target.value })}
              placeholder="Catatan tambahan terkait nota dari PT."
            />
          </Field>

          {noteForm.note_date && (
            <div className="flex items-start gap-2 rounded-xl bg-stone-50 px-3.5 py-3 text-[11px] leading-relaxed text-stone-500">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              Nota diterima {formatDateLong(noteForm.note_date)}. Pendapatan dicatat dari nilai nota, bukan dari
              perhitungan ulang potongan pakan.
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
