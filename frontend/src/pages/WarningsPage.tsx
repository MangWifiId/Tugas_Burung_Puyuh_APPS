import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  BellRing,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  Pencil,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { SectionCard } from '../components/ui/Card'
import { Pagination } from '../components/ui/Pagination'
import { EmptyState } from '../components/ui/EmptyState'
import { Tabs } from '../components/ui/Tabs'
import { LoadingBlock, ErrorBlock } from '../components/ui/Feedback'
import { useApi, usePage } from '../hooks/useApi'
import { useToast } from '../providers/ToastProvider'
import { usePageTitle } from '../components/ProtectedRoute'
import { api, getErrorMessage } from '../services/api'
import type { WarningEvent, WarningRule } from '../types'
import { addDaysISO, formatDate, formatDateTime, todayISO } from '../utils/date'
import { formatDecimal, formatNumber } from '../utils/format'
import {
  WARNING_CATEGORIES,
  WARNING_LEVELS,
} from '../utils/constants'
import { cn } from '../utils/cn'

interface RuleForm {
  threshold: string
  level: string
  enabled: boolean
  description: string
}

export function WarningsPage() {
  usePageTitle('Warning')
  const toast = useToast()
  const [tab, setTab] = useState<'events' | 'rules'>('events')
  const [from, setFrom] = useState(addDaysISO(todayISO(), -29))
  const [to, setTo] = useState(todayISO())
  const [status, setStatus] = useState('open')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [page, setPage] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [ruleModal, setRuleModal] = useState(false)
  const [editingRule, setEditingRule] = useState<WarningRule | null>(null)
  const [ruleForm, setRuleForm] = useState<RuleForm>({
    threshold: '',
    level: 'waspada',
    enabled: true,
    description: '',
  })
  const [saving, setSaving] = useState(false)

  const counts = useApi<{ open: number; critical: number; checked_at: string }>('/warnings/counts')
  const list = usePage<WarningEvent>('/warnings', {
    from,
    to,
    status,
    category: category || undefined,
    level: level || undefined,
    page,
    limit: 10,
    generate: tab === 'events' ? 'true' : undefined,
  })
  const rules = useApi<WarningRule[]>('/warning-rules')

  const updateRange = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom)
    setTo(nextTo)
    setPage(1)
  }

  const generateNow = async () => {
    setGenerating(true)
    try {
      const response = await api.post<{ success: boolean; data: { generated: number } }>('/warnings/generate')
      const generated = response.data.data?.generated ?? 0
      toast.success(
        generated > 0
          ? `${generated} warning baru ditemukan.`
          : 'Pemeriksaan selesai. Tidak ada warning baru.',
      )
      counts.reload()
      list.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setGenerating(false)
    }
  }

  const acknowledge = async (event: WarningEvent) => {
    try {
      await api.post(`/warnings/${event.id}/acknowledge`)
      toast.success(`Warning "${event.title}" ditandai sudah ditindaklanjuti.`)
      list.reload()
      counts.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const openRuleEdit = (rule: WarningRule) => {
    setEditingRule(rule)
    setRuleForm({
      threshold: String(rule.threshold),
      level: rule.level,
      enabled: rule.enabled,
      description: rule.description ?? '',
    })
    setRuleModal(true)
  }

  const submitRule = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault()
    if (!editingRule) return
    if (Number(ruleForm.threshold) < 0) {
      toast.error('Batas warning tidak boleh negatif.')
      return
    }
    setSaving(true)
    try {
      await api.put(`/warning-rules/${editingRule.id}`, {
        threshold: Number(ruleForm.threshold),
        level: ruleForm.level,
        enabled: ruleForm.enabled,
        description: ruleForm.description,
      })
      toast.success('Aturan warning diperbarui.')
      setRuleModal(false)
      rules.reload()
      counts.reload()
      list.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleRule = async (rule: WarningRule) => {
    try {
      await api.put(`/warning-rules/${rule.id}`, {
        threshold: rule.threshold,
        level: rule.level,
        enabled: !rule.enabled,
        description: rule.description,
      })
      toast.success(rule.enabled ? 'Aturan warning dinonaktifkan.' : 'Aturan warning diaktifkan.')
      rules.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Monitoring"
        title="Warning & Peringatan"
        description="Pantau peringatan otomatis untuk kematian, produksi, populasi, dan pakan. Tindak lanjuti warning dan atur ambang batasnya."
        actions={
          <Button
            variant="secondary"
            onClick={generateNow}
            loading={generating}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Periksa sekarang
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Warning terbuka"
          value={`${formatNumber(counts.data?.open ?? 0)}`}
          hint="Belum ditandai ditindaklanjuti"
          icon={BellRing}
          tone="amber"
        />
        <StatCard
          label="Warning kritis"
          value={`${formatNumber(counts.data?.critical ?? 0)}`}
          hint="Memerlukan penanganan segera"
          icon={ShieldAlert}
          tone="rose"
        />
        <StatCard
          label="Warning pada periode"
          value={`${formatNumber(list.meta?.total ?? 0)}`}
          hint={`${formatDate(from)} – ${formatDate(to)}`}
          icon={TriangleAlert}
          tone="violet"
        />
        <StatCard
          label="Aturan aktif"
          value={`${formatNumber((rules.data ?? []).filter((rule) => rule.enabled).length)} / ${formatNumber(rules.data?.length ?? 0)}`}
          hint="Dapat diubah pada tab aturan"
          icon={ShieldCheck}
          tone="emerald"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          items={[
            { key: 'events', label: 'Daftar warning', count: counts.data?.open ?? 0 },
            { key: 'rules', label: 'Aturan warning', count: rules.data?.length ?? 0 },
          ]}
          active={tab}
          onChange={(key) => setTab(key as 'events' | 'rules')}
        />
        {counts.data?.checked_at && (
          <p className="text-[10px] text-stone-400">
            Terakhir diperiksa {formatDateTime(counts.data.checked_at)}
          </p>
        )}
      </div>

      {tab === 'events' ? (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-3 shadow-sm xl:flex-row xl:items-center">
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
            <div className="grid flex-1 gap-2 sm:grid-cols-3 xl:ml-auto xl:max-w-2xl">
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value)
                  setPage(1)
                }}
                className="h-9 py-1.5 text-xs"
                aria-label="Filter status"
              >
                <option value="open">Terbuka</option>
                <option value="acknowledged">Sudah ditindaklanjuti</option>
                <option value="all">Semua status</option>
              </Select>
              <Select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value)
                  setPage(1)
                }}
                className="h-9 py-1.5 text-xs"
                aria-label="Filter kategori"
              >
                <option value="">Semua kategori</option>
                {Object.entries(WARNING_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select
                value={level}
                onChange={(event) => {
                  setLevel(event.target.value)
                  setPage(1)
                }}
                className="h-9 py-1.5 text-xs"
                aria-label="Filter level"
              >
                <option value="">Semua level</option>
                {Object.entries(WARNING_LEVELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {list.loading && list.data.length === 0 ? (
            <LoadingBlock label="Memeriksa warning..." />
          ) : list.error ? (
            <ErrorBlock message={list.error} onRetry={list.reload} />
          ) : list.data.length === 0 ? (
            <SectionCard bodyClassName="p-0">
              <EmptyState
                icon={ShieldCheck}
                title={status === 'open' ? 'Tidak ada warning terbuka' : 'Tidak ada warning'}
                description={
                  status === 'open'
                    ? 'Semua warning pada periode ini sudah ditindaklanjuti. Pemeriksaan otomatis tetap berjalan setiap 6 jam.'
                    : 'Belum ada warning yang sesuai dengan filter yang dipilih.'
                }
                action={
                  <Button size="sm" variant="outline" onClick={generateNow} loading={generating}>
                    Periksa sekarang
                  </Button>
                }
              />
            </SectionCard>
          ) : (
            <div className="space-y-3">
              {list.data.map((event) => {
                const critical = event.level === 'kritis'
                const acknowledged = event.status === 'acknowledged'
                return (
                  <div
                    key={event.id}
                    className={cn(
                      'rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ring-1 ring-inset',
                      critical ? 'border-rose-200 ring-rose-600/5' : 'border-amber-200 ring-amber-600/5',
                      acknowledged && 'opacity-70',
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          critical ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600',
                        )}
                      >
                        {critical ? <ShieldAlert className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-stone-900">{event.title}</h3>
                          <Badge tone={critical ? 'rose' : 'amber'} dot>
                            {WARNING_LEVELS[event.level] ?? event.level}
                          </Badge>
                          <Badge tone="stone">{WARNING_CATEGORIES[event.category] ?? event.category}</Badge>
                          {acknowledged && <Badge tone="emerald">Ditindaklanjuti</Badge>}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-stone-500">{event.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-400">
                          <span>Tanggal kejadian: {formatDate(event.event_date)}</span>
                          <span>
                            Nilai: {formatDecimal(event.metric_value)}
                            {event.rule?.unit ? ` ${event.rule.unit}` : ''}
                          </span>
                          <span>
                            Ambang: {formatDecimal(event.threshold)}
                            {event.rule?.unit ? ` ${event.rule.unit}` : ''}
                          </span>
                          <span>Dideteksi: {formatDateTime(event.detected_at)}</span>
                        </div>
                        {acknowledged && (
                          <div className="mt-2 rounded-lg bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-800">
                            Ditindaklanjuti oleh <strong>{event.acknowledged_name || 'pengguna'}</strong>
                            {event.acknowledged_at ? ` pada ${formatDateTime(event.acknowledged_at)}` : ''}.
                          </div>
                        )}
                      </div>
                      {!acknowledged && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => acknowledge(event)}
                          icon={<CheckCheck className="h-3.5 w-3.5" />}
                        >
                          Tandai ditindaklanjuti
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
              <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
                <Pagination
                  page={page}
                  totalPages={list.meta?.total_pages ?? 1}
                  total={list.meta?.total ?? 0}
                  onChange={setPage}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <SectionCard
          title="Aturan warning otomatis"
          description="Atur ambang batas dan level peringatan. Perubahan berlaku untuk pemeriksaan berikutnya."
          bodyClassName="p-0"
          action={
            <Badge tone="emerald">
              <SlidersHorizontal className="h-3 w-3" /> {formatNumber(rules.data?.length ?? 0)} aturan
            </Badge>
          }
        >
          {rules.loading && !rules.data ? (
            <LoadingBlock label="Memuat aturan warning..." />
          ) : rules.error ? (
            <ErrorBlock message={rules.error} onRetry={rules.reload} />
          ) : (rules.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Belum ada aturan warning"
              description="Aturan bawaan akan dibuat saat aplikasi pertama dijalankan."
            />
          ) : (
            <div className="divide-y divide-stone-100">
              {rules.data?.map((rule) => (
                <div key={rule.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      rule.level === 'kritis' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600',
                    )}
                  >
                    {rule.level === 'kritis' ? (
                      <ShieldAlert className="h-[18px] w-[18px]" />
                    ) : (
                      <TriangleAlert className="h-[18px] w-[18px]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xs font-semibold text-stone-800">{rule.name}</h3>
                      <Badge tone={rule.level === 'kritis' ? 'rose' : 'amber'}>
                        {WARNING_LEVELS[rule.level] ?? rule.level}
                      </Badge>
                      <Badge tone="stone">{WARNING_CATEGORIES[rule.category] ?? rule.category}</Badge>
                      {!rule.enabled && <Badge tone="stone">Nonaktif</Badge>}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-stone-400">{rule.description}</p>
                    <p className="mt-1 text-[11px] font-medium text-stone-600">
                      Ambang: {formatDecimal(rule.threshold)} {rule.unit} · Kode: {rule.code}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openRuleEdit(rule)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={rule.enabled ? 'ghost' : 'outline'}
                      onClick={() => toggleRule(rule)}
                    >
                      {rule.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-start gap-2.5 border-t border-stone-100 bg-stone-50/60 px-5 py-3 text-[11px] leading-relaxed text-stone-500">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <p>
              Warning dibuat otomatis setiap 6 jam dan saat dashboard atau halaman ini dibuka. Warning
              dengan kode dan tanggal yang sama tidak diduplikasi.
            </p>
          </div>
        </SectionCard>
      )}

      <Modal
        open={ruleModal}
        onClose={() => setRuleModal(false)}
        title="Edit aturan warning"
        description="Perubahan ambang batas akan digunakan pada pemeriksaan berikutnya."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRuleModal(false)}>
              Batal
            </Button>
            <Button type="submit" form="rule-form" loading={saving}>
              Simpan aturan
            </Button>
          </>
        }
      >
        <form id="rule-form" onSubmit={submitRule} className="space-y-4">
          {editingRule && (
            <div className="rounded-xl bg-stone-50 px-4 py-3">
              <p className="text-xs font-semibold text-stone-800">{editingRule.name}</p>
              <p className="mt-0.5 text-[11px] text-stone-400">
                {WARNING_CATEGORIES[editingRule.category] ?? editingRule.category} · Unit {editingRule.unit}
              </p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ambang batas" htmlFor="rule-threshold" required>
              <Input
                id="rule-threshold"
                type="number"
                min={0}
                step="0.01"
                required
                value={ruleForm.threshold}
                onChange={(event) => setRuleForm({ ...ruleForm, threshold: event.target.value })}
              />
            </Field>
            <Field label="Level" htmlFor="rule-level" required>
              <Select
                id="rule-level"
                value={ruleForm.level}
                onChange={(event) => setRuleForm({ ...ruleForm, level: event.target.value })}
              >
                {Object.entries(WARNING_LEVELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Deskripsi" htmlFor="rule-description" hint="Penjelasan singkat yang akan tampil pada aturan.">
            <Textarea
              id="rule-description"
              value={ruleForm.description}
              onChange={(event) => setRuleForm({ ...ruleForm, description: event.target.value })}
            />
          </Field>
          <label className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
              checked={ruleForm.enabled}
              onChange={(event) => setRuleForm({ ...ruleForm, enabled: event.target.checked })}
            />
            <span>
              <span className="text-xs font-semibold text-stone-700">Aktifkan aturan ini</span>
              <span className="mt-0.5 block text-[11px] text-stone-400">
                Jika dimatikan, aturan tidak akan menghasilkan warning baru.
              </span>
            </span>
          </label>
        </form>
      </Modal>
    </div>
  )
}
