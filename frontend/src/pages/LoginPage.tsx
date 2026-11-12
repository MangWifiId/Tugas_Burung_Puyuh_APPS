import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bird,
  Eye,
  EyeOff,
  Egg,
  LineChart,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Wheat,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api, getErrorMessage, getErrorStatus } from '../services/api'
import type { ApiResponse } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { usePageTitle } from '../components/ProtectedRoute'

const features = [
  { icon: Egg, title: 'Produksi & penjualan', text: 'Catat telur harian dan pengambilan PT dalam satu tempat.' },
  { icon: LineChart, title: 'Populasi & mortalitas', text: 'Pantau umur, populasi hidup, dan kematian tiap batch.' },
  { icon: Wheat, title: 'Pakan & warning', text: 'Riwayat harga pakan dan peringatan otomatis yang bisa diatur.' },
]

export function LoginPage() {
  usePageTitle('Masuk')
  const { login, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('admin@kandang.local')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)

  if (token) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setNeedsVerification(false)
    setResendMessage(null)
    setResendError(null)
    try {
      await login(email.trim(), password)
      const target = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(target, { replace: true })
    } catch (err) {
      setNeedsVerification(getErrorStatus(err) === 403)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setResendMessage(null)
    setResendError(null)
    try {
      const response = await api.post<ApiResponse<{ message: string }>>('/auth/resend-verification', {
        email: email.trim(),
      })
      setResendMessage(
        response.data.data?.message ??
          'Jika email terdaftar dan belum diverifikasi, tautan verifikasi sudah dikirim ulang.',
      )
    } catch (err) {
      setResendError(getErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-[#f7f7f4] lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#0d3529] via-[#09271f] to-[#061712] px-12 py-12 text-emerald-50 lg:flex lg:flex-col xl:px-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 ring-1 ring-emerald-300/20">
            <Bird className="h-7 w-7 text-emerald-300" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400/70">
              Manajemen Usaha
            </p>
            <p className="text-lg font-semibold text-white">Telur Puyuh</p>
          </div>
        </div>

        <div className="relative my-auto max-w-lg py-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Monitoring kandang dalam satu dashboard
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.15] tracking-tight text-white xl:text-[44px]">
            Kelola kandang puyuh
            <br />
            dengan lebih tenang.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-emerald-100/60">
            Catat produksi, pengambilan PT, pakan, populasi, dan kematian. Dapatkan peringatan
            saat kondisi usaha mulai berubah.
          </p>

          <div className="mt-10 space-y-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4 backdrop-blur-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{feature.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/50">{feature.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-emerald-100/35">
          <ShieldCheck className="h-3.5 w-3.5" />
          Data usaha tersimpan aman di database pribadi Anda.
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-700">
              <Bird className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                Manajemen Usaha
              </p>
              <p className="text-base font-semibold text-stone-900">Telur Puyuh</p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              Selamat datang kembali
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Masuk ke kandang Anda
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Gunakan email dan kata sandi pemilik usaha untuk melanjutkan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-stone-600">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@kandang.com"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-stone-600">
                Kata sandi
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="h-11 pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 transition hover:text-stone-700"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-xs font-medium leading-relaxed text-rose-700">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {needsVerification && (
              <div className="space-y-2">
                {resendMessage && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-xs font-medium leading-relaxed text-emerald-700">
                    {resendMessage}
                  </div>
                )}
                {resendError && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-xs font-medium leading-relaxed text-rose-700">
                    {resendError}
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  loading={resending}
                  onClick={handleResend}
                  className="w-full"
                >
                  {!resending && <RefreshCw className="h-4 w-4" />}
                  Kirim ulang email verifikasi
                </Button>
                <p className="text-center text-[11px] leading-relaxed text-stone-400">
                  Atau buka halaman{' '}
                  <a
                    href="/verifikasi-email"
                    className="font-semibold text-emerald-600 hover:text-emerald-500"
                  >
                    verifikasi email
                  </a>
                  .
                </p>
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
              Masuk ke aplikasi
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-stone-400">
            Belum punya akun?{' '}
            <a href="/daftar" className="font-semibold text-emerald-600 hover:text-emerald-500">
              Buat akun baru
            </a>
          </p>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-stone-400">
            Aplikasi pencatatan internal. Bukan marketplace atau aplikasi kasir.
          </p>
        </div>
      </section>
    </div>
  )
}
