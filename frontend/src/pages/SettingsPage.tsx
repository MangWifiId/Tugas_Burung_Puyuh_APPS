import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Building2,
  CheckCircle2,
  Clock,
  History,
  KeyRound,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  User as UserRound,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Field, Input, Textarea } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { SectionCard } from '../components/ui/Card'
import { Table, Td, Th } from '../components/ui/Table'
import { Pagination } from '../components/ui/Pagination'
import { EmptyState } from '../components/ui/EmptyState'
import { Tabs } from '../components/ui/Tabs'
import { LoadingBlock, ErrorBlock } from '../components/ui/Feedback'
import { useApi, usePage } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../providers/ToastProvider'
import { usePageTitle } from '../components/ProtectedRoute'
import { api, getErrorMessage } from '../services/api'
import type { ActivityLog, AppSetting, User } from '../types'
import { formatDateTime } from '../utils/date'
import { cn } from '../utils/cn'

type TabKey = 'business' | 'account' | 'activity'

const actionLabels: Record<string, string> = {
  create: 'Menambah',
  update: 'Mengubah',
  delete: 'Menghapus',
  acknowledge: 'Menindaklanjuti',
  login: 'Masuk',
  logout: 'Keluar',
}

const actionTone = (action: string) => {
  if (action === 'delete') return 'rose' as const
  if (action === 'create') return 'emerald' as const
  if (action === 'acknowledge') return 'violet' as const
  return 'sky' as const
}

const textareaKeys = new Set(['address'])

export function SettingsPage() {
  usePageTitle('Pengaturan')
  const toast = useToast()
  const { user, updateUser } = useAuth()
  const [tab, setTab] = useState<TabKey>('business')
  const [values, setValues] = useState<Record<string, string>>({})
  const [savingSettings, setSavingSettings] = useState(false)
  const [profile, setProfile] = useState({ name: '', email: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [savingPassword, setSavingPassword] = useState(false)
  const [activityPage, setActivityPage] = useState(1)

  const settings = useApi<AppSetting[]>('/settings')
  const activities = usePage<ActivityLog>('/activities', { page: activityPage, limit: 10 })

  useEffect(() => {
    if (!settings.data) return
    const next: Record<string, string> = {}
    for (const setting of settings.data) {
      next[setting.key] = setting.value ?? ''
    }
    setValues(next)
  }, [settings.data])

  useEffect(() => {
    if (!user) return
    setProfile({ name: user.name, email: user.email })
  }, [user])

  const generalSettings = useMemo(
    () => (settings.data ?? []).filter((setting) => setting.group !== 'warning'),
    [settings.data],
  )
  const warningSettings = useMemo(
    () => (settings.data ?? []).filter((setting) => setting.group === 'warning'),
    [settings.data],
  )

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault()
    if (!values.farm_name?.trim()) {
      toast.error('Nama usaha tidak boleh kosong.')
      return
    }
    setSavingSettings(true)
    try {
      await api.put('/settings', { settings: values })
      toast.success('Pengaturan usaha disimpan.')
      settings.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingSettings(false)
    }
  }

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile.name.trim()) {
      toast.error('Nama tidak boleh kosong.')
      return
    }
    setSavingProfile(true)
    try {
      const response = await api.put<{ success: boolean; data: User }>('/auth/profile', {
        name: profile.name.trim(),
        email: profile.email.trim(),
      })
      updateUser(response.data.data)
      toast.success('Profil akun diperbarui.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (passwords.next.length < 8) {
      toast.error('Kata sandi baru minimal 8 karakter.')
      return
    }
    if (passwords.next !== passwords.confirm) {
      toast.error('Konfirmasi kata sandi baru tidak cocok.')
      return
    }
    setSavingPassword(true)
    try {
      await api.put('/auth/password', {
        current_password: passwords.current,
        new_password: passwords.next,
      })
      toast.success('Kata sandi berhasil diubah.')
      setPasswords({ current: '', next: '', confirm: '' })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistem"
        title="Pengaturan"
        description="Kelola identitas usaha, preferensi satuan, aturan warning, akun pengguna, dan lihat riwayat aktivitas."
      />

      <Tabs
        items={[
          { key: 'business', label: 'Profil usaha' },
          { key: 'account', label: 'Akun & keamanan' },
          { key: 'activity', label: 'Riwayat aktivitas' },
        ]}
        active={tab}
        onChange={(key) => setTab(key as TabKey)}
      />

      {tab === 'business' ? (
        settings.loading && !settings.data ? (
          <LoadingBlock label="Memuat pengaturan..." />
        ) : settings.error ? (
          <ErrorBlock message={settings.error} onRetry={settings.reload} />
        ) : (
          <form onSubmit={saveSettings} className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
              <SectionCard
                title="Identitas usaha"
                description="Informasi ini ditampilkan pada sidebar, header, dan laporan."
              >
                <div className="space-y-4">
                  {generalSettings.map((setting) => {
                    const isTextarea = textareaKeys.has(setting.key)
                    const isCurrency = setting.key === 'currency'
                    return (
                      <Field
                        key={setting.key}
                        label={setting.label}
                        htmlFor={`setting-${setting.key}`}
                        required={setting.key === 'farm_name'}
                        hint={
                          setting.key === 'egg_unit'
                            ? 'Contoh: butir, kg, atau ikat.'
                            : setting.key === 'feed_unit'
                              ? 'Contoh: sak atau karung.'
                              : isCurrency
                                ? 'Mata uang laporan. Saat ini menggunakan Rupiah.'
                                : undefined
                        }
                      >
                        {isTextarea ? (
                          <Textarea
                            id={`setting-${setting.key}`}
                            value={values[setting.key] ?? ''}
                            onChange={(event) =>
                              setValues({ ...values, [setting.key]: event.target.value })
                            }
                            placeholder={setting.label}
                          />
                        ) : (
                          <Input
                            id={`setting-${setting.key}`}
                            value={values[setting.key] ?? ''}
                            disabled={isCurrency}
                            onChange={(event) =>
                              setValues({ ...values, [setting.key]: event.target.value })
                            }
                            placeholder={setting.label}
                          />
                        )}
                      </Field>
                    )
                  })}
                  {generalSettings.length === 0 && (
                    <p className="text-xs text-stone-400">Belum ada pengaturan umum.</p>
                  )}
                </div>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard
                  title="Preferensi warning"
                  description="Warning otomatis membantu memantau kondisi kandang."
                >
                  <div className="space-y-4">
                    {warningSettings.map((setting) => {
                      const enabled = values[setting.key] === 'true'
                      return (
                        <div key={setting.key} className="space-y-2">
                          <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
                              checked={enabled}
                              onChange={(event) =>
                                setValues({
                                  ...values,
                                  [setting.key]: event.target.checked ? 'true' : 'false',
                                })
                              }
                            />
                            <span>
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                                <ShieldCheck className="h-3.5 w-3.5" /> {setting.label}
                              </span>
                              <span className="mt-0.5 block text-[11px] leading-relaxed text-stone-400">
                                Pemeriksaan berjalan setiap 6 jam dan saat dashboard dibuka. Ambang
                                batas dapat diatur pada halaman Warning.
                              </span>
                            </span>
                          </label>
                        </div>
                      )
                    })}
                    {warningSettings.length === 0 && (
                      <p className="text-xs text-stone-400">Belum ada pengaturan warning.</p>
                    )}
                    <div className="rounded-xl bg-emerald-50/60 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-800">
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                      Riwayat warning dan tindak lanjut tetap tersimpan meskipun warning otomatis
                      dinonaktifkan.
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Ringkasan aplikasi" description="Informasi singkat sistem.">
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-stone-400">
                        <Building2 className="h-3.5 w-3.5" /> Aplikasi
                      </span>
                      <span className="font-semibold text-stone-700">Manajemen Puyuh v1.0</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-stone-400">
                        <MapPin className="h-3.5 w-3.5" /> Penyimpanan
                      </span>
                      <span className="font-semibold text-stone-700">Database terpusat</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-stone-400">
                        <Clock className="h-3.5 w-3.5" /> Zona waktu
                      </span>
                      <span className="font-semibold text-stone-700">Waktu Indonesia Barat</span>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={savingSettings} icon={<Save className="h-4 w-4" />}>
                Simpan pengaturan
              </Button>
            </div>
          </form>
        )
      ) : null}

      {tab === 'account' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard
            title="Profil akun"
            description="Perbarui nama dan alamat email yang digunakan untuk masuk."
          >
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                  {user?.name?.slice(0, 2).toUpperCase() ?? 'PY'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800">{user?.name}</p>
                  <p className="text-[11px] text-stone-400">
                    {user?.role === 'owner' ? 'Pemilik' : user?.role} · {user?.email}
                  </p>
                </div>
              </div>
              <Field label="Nama" htmlFor="profile-name" required>
                <Input
                  id="profile-name"
                  required
                  value={profile.name}
                  onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                />
              </Field>
              <Field label="Email" htmlFor="profile-email" required>
                <Input
                  id="profile-email"
                  type="email"
                  required
                  value={profile.email}
                  onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={savingProfile} icon={<UserRound className="h-4 w-4" />}>
                  Simpan profil
                </Button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Ubah kata sandi"
            description="Gunakan kata sandi minimal 8 karakter yang tidak mudah ditebak."
          >
            <form onSubmit={savePassword} className="space-y-4">
              <Field label="Kata sandi saat ini" htmlFor="password-current" required>
                <Input
                  id="password-current"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Kata sandi baru" htmlFor="password-next" required hint="Minimal 8 karakter.">
                  <Input
                    id="password-next"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={passwords.next}
                    onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                  />
                </Field>
                <Field label="Konfirmasi kata sandi" htmlFor="password-confirm" required>
                  <Input
                    id="password-confirm"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={passwords.confirm}
                    onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="secondary"
                  loading={savingPassword}
                  icon={<KeyRound className="h-4 w-4" />}
                >
                  Ubah kata sandi
                </Button>
              </div>
            </form>
          </SectionCard>
        </div>
      ) : null}

      {tab === 'activity' ? (
        <SectionCard
          title="Riwayat aktivitas"
          description="Seluruh perubahan data tercatat untuk menjaga jejak audit."
          bodyClassName="p-0"
          action={<Badge tone="stone">{activities.meta?.total ?? 0} aktivitas</Badge>}
        >
          {activities.loading && activities.data.length === 0 ? (
            <LoadingBlock label="Memuat riwayat aktivitas..." />
          ) : activities.error ? (
            <ErrorBlock message={activities.error} onRetry={activities.reload} />
          ) : activities.data.length === 0 ? (
            <EmptyState
              icon={History}
              title="Belum ada aktivitas"
              description="Aktivitas akan tercatat saat data ditambah, diubah, atau dihapus."
            />
          ) : (
            <>
              <Table minWidth="min-w-[820px]">
                <thead>
                  <tr>
                    <Th>Waktu</Th>
                    <Th>Pengguna</Th>
                    <Th>Aksi</Th>
                    <Th>Entitas</Th>
                    <Th>Keterangan</Th>
                  </tr>
                </thead>
                <tbody>
                  {activities.data.map((activity) => (
                    <tr key={activity.id} className="transition hover:bg-stone-50/60">
                      <Td className="whitespace-nowrap text-[11px] text-stone-500">
                        {formatDateTime(activity.created_at)}
                      </Td>
                      <Td className="text-xs font-medium text-stone-700">
                        {activity.user_name || 'Sistem'}
                      </Td>
                      <Td>
                        <Badge tone={actionTone(activity.action)}>
                          {actionLabels[activity.action] ?? activity.action}
                        </Badge>
                      </Td>
                      <Td className="text-[11px] text-stone-500">
                        {activity.entity}
                        {activity.entity_id ? (
                          <span className="text-stone-300"> #{activity.entity_id}</span>
                        ) : null}
                      </Td>
                      <Td className="max-w-[420px]">
                        <p className="text-xs text-stone-600">{activity.description}</p>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination
                page={activityPage}
                totalPages={activities.meta?.total_pages ?? 1}
                total={activities.meta?.total ?? 0}
                onChange={setActivityPage}
              />
            </>
          )}
          <div className={cn('flex items-start gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3 text-[11px] text-stone-500')}>
            <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
            <p>
              Riwayat aktivitas tidak dapat diubah atau dihapus dari antarmuka untuk menjaga
              konsistensi data.
            </p>
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}
