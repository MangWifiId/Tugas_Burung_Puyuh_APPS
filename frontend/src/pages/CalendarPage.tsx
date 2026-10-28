import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Trash2,
  Truck,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { SectionCard } from '../components/ui/Card'
import { Table, Td, Th } from '../components/ui/Table'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingBlock, ErrorBlock } from '../components/ui/Feedback'
import { useApi } from '../hooks/useApi'
import { useConfirm } from '../providers/ConfirmProvider'
import { useToast } from '../providers/ToastProvider'
import { usePageTitle } from '../components/ProtectedRoute'
import { api, getErrorMessage } from '../services/api'
import type { BatchStats, CalendarEvent } from '../types'
import {
  addDaysISO,
  buildMonthGrid,
  endOfMonthISO,
  formatDate,
  formatDateLong,
  isPickupDay,
  monthLabel,
  relativeDays,
  startOfMonthISO,
  todayISO,
} from '../utils/date'
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  eventStatusLabel,
  eventTypeLabel,
} from '../utils/constants'
import { cn } from '../utils/cn'

interface EventForm {
  title: string
  event_date: string
  event_type: string
  batch_id: string
  notes: string
  reminder: boolean
  reminder_days: string
  status: string
}

const emptyEvent = (date: string, batchId = ''): EventForm => ({
  title: '',
  event_date: date,
  event_type: 'vitamin',
  batch_id: batchId,
  notes: '',
  reminder: false,
  reminder_days: '1',
  status: 'planned',
})

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const statusTone = (status: string) => {
  if (status === 'done') return 'emerald' as const
  if (status === 'cancelled') return 'stone' as const
  return 'sky' as const
}

export function CalendarPage() {
  usePageTitle('Kalender Kandang')
  const toast = useToast()
  const { confirm } = useConfirm()
  const [month, setMonth] = useState(() => startOfMonthISO(todayISO()))
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [batchFilter, setBatchFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState<EventForm>(() => emptyEvent(todayISO()))
  const [saving, setSaving] = useState(false)

  const { data: batches } = useApi<BatchStats[]>('/batches', { status: 'all' })
  const events = useApi<CalendarEvent[]>('/events', {
    from: startOfMonthISO(month),
    to: endOfMonthISO(month),
    batch_id: batchFilter || undefined,
    event_type: typeFilter || undefined,
    status: statusFilter,
  })

  const batchRows = batches ?? []
  const eventRows = events.data ?? []
  const cells = useMemo(() => buildMonthGrid(month), [month])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of eventRows) {
      const date = event.event_date.slice(0, 10)
      const current = map.get(date) ?? []
      current.push(event)
      map.set(date, current)
    }
    return map
  }, [eventRows])

  const selectedEvents = eventsByDate.get(selectedDate) ?? []
  const agenda = useMemo(
    () =>
      [...eventRows].sort((a, b) => {
        const dateDiff = a.event_date.localeCompare(b.event_date)
        return dateDiff !== 0 ? dateDiff : a.id - b.id
      }),
    [eventRows],
  )

  const goToToday = () => {
    const today = todayISO()
    setMonth(startOfMonthISO(today))
    setSelectedDate(today)
  }

  const moveMonth = (direction: -1 | 1) => {
    if (direction === 1) {
      const next = addDaysISO(endOfMonthISO(month), 1)
      setMonth(startOfMonthISO(next))
      setSelectedDate(next)
    } else {
      const previous = startOfMonthISO(addDaysISO(month, -1))
      setMonth(previous)
      setSelectedDate(previous)
    }
  }

  const selectDay = (date: string) => {
    setSelectedDate(date)
    const targetMonth = startOfMonthISO(date)
    if (targetMonth !== month) setMonth(targetMonth)
  }

  const openCreate = (date = selectedDate) => {
    setEditing(null)
    setForm(emptyEvent(date, batchFilter))
    setModalOpen(true)
  }

  const openEdit = (event: CalendarEvent) => {
    setEditing(event)
    setForm({
      title: event.title,
      event_date: event.event_date.slice(0, 10),
      event_type: event.event_type,
      batch_id: event.batch_id ? String(event.batch_id) : '',
      notes: event.notes ?? '',
      reminder: event.reminder,
      reminder_days: String(event.reminder_days ?? 0),
      status: event.status,
    })
    setModalOpen(true)
  }

  const payloadFromForm = () => ({
    title: form.title.trim(),
    event_date: form.event_date,
    event_type: form.event_type,
    batch_id: form.batch_id ? Number(form.batch_id) : null,
    notes: form.notes,
    reminder: form.reminder,
    reminder_days: Number(form.reminder_days) || 0,
    status: form.status,
  })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) {
      toast.error('Judul kegiatan wajib diisi.')
      return
    }
    setSaving(true)
    try {
      const payload = payloadFromForm()
      if (editing) {
        await api.put(`/events/${editing.id}`, payload)
        toast.success('Kegiatan diperbarui.')
      } else {
        await api.post('/events', payload)
        toast.success('Kegiatan ditambahkan ke kalender.')
      }
      setModalOpen(false)
      events.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (event: CalendarEvent) => {
    const approved = await confirm({
      title: 'Hapus kegiatan?',
      description: `Kegiatan "${event.title}" pada ${formatDate(event.event_date)} akan dihapus dari kalender.`,
      confirmLabel: 'Hapus',
      danger: true,
    })
    if (!approved) return
    try {
      await api.delete(`/events/${event.id}`)
      toast.success('Kegiatan dihapus.')
      events.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const markDone = async (event: CalendarEvent) => {
    try {
      await api.put(`/events/${event.id}`, {
        title: event.title,
        event_date: event.event_date.slice(0, 10),
        event_type: event.event_type,
        batch_id: event.batch_id ?? null,
        notes: event.notes,
        reminder: event.reminder,
        reminder_days: event.reminder_days,
        status: 'done',
      })
      toast.success('Kegiatan ditandai selesai.')
      events.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Monitoring"
        title="Kalender Kandang"
        description="Jadwalkan kegiatan kandang, pengambilan telur, vitamin, obat, dan pengingat penting. Hari Senin dan Kamis ditandai sebagai jadwal pengambilan telur."
        actions={
          <Button onClick={() => openCreate()} icon={<Plus className="h-4 w-4" />}>
            Tambah kegiatan
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-3 shadow-sm xl:flex-row xl:items-center">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="secondary" onClick={() => moveMonth(-1)} aria-label="Bulan sebelumnya">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-[150px] text-center text-sm font-semibold text-stone-800 sm:min-w-[180px]">
            {monthLabel(month)}
          </p>
          <Button size="icon" variant="secondary" onClick={() => moveMonth(1)} aria-label="Bulan berikutnya">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={goToToday} className="ml-1">
            Hari ini
          </Button>
        </div>
        <div className="grid flex-1 gap-2 sm:grid-cols-3 xl:max-w-2xl xl:ml-auto">
          <Select
            value={batchFilter}
            onChange={(event) => setBatchFilter(event.target.value)}
            className="h-9 py-1.5 text-xs"
            aria-label="Filter kelompok"
          >
            <option value="">Semua kelompok</option>
            {batchRows.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </Select>
          <Select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-9 py-1.5 text-xs"
            aria-label="Filter jenis kegiatan"
          >
            <option value="">Semua jenis</option>
            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 py-1.5 text-xs"
            aria-label="Filter status"
          >
            <option value="all">Semua status</option>
            {EVENT_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50/60">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className={cn(
                  'px-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.08em]',
                  day === 'Kam' || day === 'Sen' ? 'text-emerald-700' : 'text-stone-400',
                )}
              >
                {day}
              </div>
            ))}
          </div>
          {events.loading && eventRows.length === 0 ? (
            <LoadingBlock label="Memuat kalender..." className="py-24" />
          ) : events.error ? (
            <ErrorBlock message={events.error} onRetry={events.reload} />
          ) : (
            <div className="grid grid-cols-7">
              {cells.map((cell) => {
                const dayEvents = eventsByDate.get(cell.date) ?? []
                const isToday = cell.date === todayISO()
                const isSelected = cell.date === selectedDate
                const pickup = isPickupDay(cell.date)
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => selectDay(cell.date)}
                    className={cn(
                      'relative flex min-h-[92px] flex-col gap-1 border-b border-r border-stone-100 p-1.5 text-left transition sm:min-h-[108px] sm:p-2',
                      !cell.inMonth && 'bg-stone-50/50',
                      isSelected ? 'bg-emerald-50/70 ring-1 ring-inset ring-emerald-500/30' : 'hover:bg-stone-50/70',
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
                          isToday
                            ? 'bg-emerald-700 text-white'
                            : cell.inMonth
                              ? 'text-stone-700'
                              : 'text-stone-300',
                        )}
                      >
                        {Number(cell.date.slice(8, 10))}
                      </span>
                      {pickup && cell.inMonth && (
                        <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-700">
                          <Truck className="h-2.5 w-2.5" />
                          <span className="hidden sm:inline">Ambil</span>
                        </span>
                      )}
                    </div>

                    <div className="flex-1 space-y-0.5 overflow-hidden">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={cn(
                            'truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight sm:text-[10px]',
                            event.status === 'done'
                              ? 'bg-emerald-100/80 text-emerald-800'
                              : event.status === 'cancelled'
                                ? 'bg-stone-100 text-stone-400 line-through'
                                : 'bg-sky-100/80 text-sky-800',
                          )}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="px-1 text-[9px] font-semibold text-stone-400">
                          +{dayEvents.length - 2} kegiatan
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-[10px] text-stone-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Hari ini
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-200" /> Jadwal ambil telur (Senin & Kamis)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-400" /> Kegiatan
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <SectionCard
            title={formatDateLong(selectedDate)}
            description={`${selectedEvents.length} kegiatan · ${relativeDays(selectedDate)}`}
            action={
              <Button size="icon" variant="ghost" onClick={() => openCreate(selectedDate)} aria-label="Tambah kegiatan pada tanggal ini">
                <Plus className="h-4 w-4" />
              </Button>
            }
            bodyClassName="p-4"
          >
            {selectedEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center">
                <CalendarDays className="mx-auto h-7 w-7 text-stone-300" />
                <p className="mt-2 text-xs font-medium text-stone-600">Belum ada kegiatan</p>
                <p className="mt-0.5 text-[11px] text-stone-400">
                  {isPickupDay(selectedDate)
                    ? 'Hari ini jadwal pengambilan telur oleh PT.'
                    : 'Tambahkan kegiatan untuk tanggal ini.'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => openCreate(selectedDate)}
                  icon={<Plus className="h-3.5 w-3.5" />}
                >
                  Tambah kegiatan
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((event) => (
                  <div key={event.id} className="rounded-xl border border-stone-200/80 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-stone-800">{event.title}</p>
                        <p className="mt-0.5 text-[10px] text-stone-400">
                          {eventTypeLabel(event.event_type)}
                          {event.batch?.name ? ` · ${event.batch.name}` : ''}
                        </p>
                      </div>
                      <Badge tone={statusTone(event.status)}>{eventStatusLabel(event.status)}</Badge>
                    </div>
                    {event.notes && (
                      <p className="mt-2 text-[11px] leading-relaxed text-stone-500">{event.notes}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-stone-400">
                      {event.reminder && (
                        <span className="flex items-center gap-1">
                          <Bell className="h-3 w-3" /> {event.reminder_days} hari sebelum
                        </span>
                      )}
                      {event.batch_age_days !== null && event.batch_age_days !== undefined && (
                        <span>Umur {event.batch_age_days} hari</span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1 border-t border-stone-100 pt-2">
                      {event.status !== 'done' && (
                        <Button size="sm" variant="ghost" onClick={() => markDone(event)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Selesai
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openEdit(event)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => remove(event)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Pengingat" description="Kegiatan dalam 7 hari ke depan." bodyClassName="p-0">
            {agenda.filter((event) => event.event_date >= todayISO() && event.event_date <= addDaysISO(todayISO(), 7)).length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-stone-400">
                Tidak ada pengingat dalam 7 hari ke depan.
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {agenda
                  .filter((event) => event.event_date >= todayISO() && event.event_date <= addDaysISO(todayISO(), 7))
                  .slice(0, 6)
                  .map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => {
                        selectDay(event.event_date.slice(0, 10))
                        openEdit(event)
                      }}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-stone-50"
                    >
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold text-stone-700">{event.title}</p>
                        <p className="text-[10px] text-stone-400">
                          {formatDate(event.event_date)} · {relativeDays(event.event_date)}
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Agenda bulan ini"
        description="Seluruh kegiatan pada bulan yang sedang ditampilkan."
        bodyClassName="p-0"
        action={<span className="text-[11px] text-stone-400">{agenda.length} kegiatan</span>}
      >
        {agenda.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Belum ada kegiatan"
            description="Tambahkan kegiatan pertama untuk bulan ini."
            action={
              <Button size="sm" variant="outline" onClick={() => openCreate(month)} icon={<Plus className="h-3.5 w-3.5" />}>
                Tambah kegiatan
              </Button>
            }
          />
        ) : (
          <Table minWidth="min-w-[760px]">
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>Kegiatan</Th>
                <Th>Jenis</Th>
                <Th>Kelompok</Th>
                <Th>Status</Th>
                <Th>Pengingat</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {agenda.map((event) => (
                <tr key={event.id} className="transition hover:bg-stone-50/60">
                  <Td className="text-xs font-medium text-stone-700">
                    {formatDate(event.event_date)}
                    <p className="text-[10px] font-normal text-stone-400">{relativeDays(event.event_date)}</p>
                  </Td>
                  <Td>
                    <p className="text-xs font-semibold text-stone-800">{event.title}</p>
                    {event.notes && <p className="mt-0.5 max-w-[260px] truncate text-[10px] text-stone-400">{event.notes}</p>}
                  </Td>
                  <Td className="text-[11px] text-stone-500">{eventTypeLabel(event.event_type)}</Td>
                  <Td className="text-[11px] text-stone-500">{event.batch?.name ?? '—'}</Td>
                  <Td>
                    <Badge tone={statusTone(event.status)} dot>
                      {eventStatusLabel(event.status)}
                    </Badge>
                  </Td>
                  <Td className="text-[11px] text-stone-500">
                    {event.reminder ? `${event.reminder_days} hari sebelum` : '—'}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      {event.status !== 'done' && (
                        <Button size="icon" variant="ghost" aria-label="Tandai selesai" onClick={() => markDone(event)}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" aria-label="Edit kegiatan" onClick={() => openEdit(event)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Hapus kegiatan"
                        className="text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => remove(event)}
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
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit kegiatan' : 'Tambah kegiatan'}
        description="Kegiatan akan muncul pada kalender dan pengingat bila diaktifkan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="event-form" loading={saving}>
              {editing ? 'Simpan perubahan' : 'Tambah kegiatan'}
            </Button>
          </>
        }
      >
        <form id="event-form" onSubmit={submit} className="space-y-4">
          <Field label="Judul kegiatan" htmlFor="event-title" required>
            <Input
              id="event-title"
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Contoh: Pemberian vitamin B kompleks"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal kegiatan" htmlFor="event-date" required>
              <Input
                id="event-date"
                type="date"
                required
                value={form.event_date}
                onChange={(event) => setForm({ ...form, event_date: event.target.value })}
              />
            </Field>
            <Field label="Jenis kegiatan" htmlFor="event-type" required>
              <Select
                id="event-type"
                value={form.event_type}
                onChange={(event) => setForm({ ...form, event_type: event.target.value })}
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kelompok" htmlFor="event-batch" hint="Opsional. Kegiatan bisa berlaku untuk semua kelompok.">
              <Select
                id="event-batch"
                value={form.batch_id}
                onChange={(event) => setForm({ ...form, batch_id: event.target.value })}
              >
                <option value="">Semua kelompok</option>
                {batchRows.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="event-status" required>
              <Select
                id="event-status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                {EVENT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
                checked={form.reminder}
                onChange={(event) => setForm({ ...form, reminder: event.target.checked })}
              />
              <span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                  <Bell className="h-3.5 w-3.5" /> Aktifkan pengingat
                </span>
                <span className="mt-0.5 block text-[11px] text-stone-400">
                  Tampilkan kegiatan pada daftar pengingat sebelum tanggal pelaksanaan.
                </span>
              </span>
            </label>
            {form.reminder && (
              <div className="mt-3 pl-6">
                <Field label="Pengingat berapa hari sebelumnya" htmlFor="event-reminder-days">
                  <Input
                    id="event-reminder-days"
                    type="number"
                    min={0}
                    max={30}
                    value={form.reminder_days}
                    onChange={(event) => setForm({ ...form, reminder_days: event.target.value })}
                    className="w-28"
                  />
                </Field>
              </div>
            )}
          </div>
          <Field label="Catatan" htmlFor="event-notes">
            <Textarea
              id="event-notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Dosis, merek obat, atau detail pelaksanaan."
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
