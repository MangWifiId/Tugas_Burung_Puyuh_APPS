import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bird,
  Building2,
  Eye,
  EyeOff,
  Mail,
  MailCheck,
  LockKeyhole,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api, getErrorMessage } from '../services/api'
import type { ApiResponse, RegisterResult } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { usePageTitle } from '../components/ProtectedRoute'

export function RegisterPage() {
  usePageTitle('Daftar')
  const { register, token } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [farmName, setFarmName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RegisterResult | null>(null)
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
    try {
      const response = await register(name.trim(), farmName.trim(), email.trim(), password)
      if (response.token) {
        navigate('/', { replace: true })
        return
      }
      setResult(response)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!result) return
    setResending(true)
    setResendMessage(null)
    setResendError(null)
    try {
      const response = await api.post<ApiResponse<{ message: string }>>('/auth/resend-verification', {
        email: result.email,
      })
      setResendMessage(
        response.data.data?.message ?? 'Tautan verifikasi sudah dikirim ulang. Periksa email Anda.',
      )
    } catch (err) {
      setResendError(getErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4] flex items-center justify-center px-5 py-10 sm:px-10">
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

        {result ? (
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
              <MailCheck className="h-7 w-7 text-emerald-700" />
            </div>
            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              Satu langkah lagi
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Cek email Anda
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-500">
              Kami mengirim tautan verifikasi ke{' '}
              <span className="font-semibold text-stone-700">{result.email}</span>. Buka tautan
              tersebut agar akun kandang Anda bisa dipakai masuk.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-stone-400">
              Tautan berlaku 24 jam. Bila tidak menemukan emailnya, periksa folder spam atau kirim
              ulang.
            </p>

            {resendMessage && (
              <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-xs font-medium leading-relaxed text-emerald-700">
                {resendMessage}
              </div>
            )}
            {resendError && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-xs font-medium leading-relaxed text-rose-700">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {resendError}
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              size="lg"
              loading={resending}
              onClick={handleResend}
              className="mt-6 w-full"
            >
              {!resending && <RefreshCw className="h-4 w-4" />}
              Kirim ulang verifikasi
            </Button>

            <a
              href="/login"
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
            >
              Sudah verifikasi? Masuk
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                Buat akun baru
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
                Daftar kandang Anda
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">
                Setiap akun memiliki kandang sendiri. Data produksi, penjualan, dan pengaturan tidak
                akan terlihat oleh kandang lain.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-xs font-semibold text-stone-600">
                  Nama lengkap
                </label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Pemilik Kandang"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="farmName" className="text-xs font-semibold text-stone-600">
                  Nama kandang
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    id="farmName"
                    type="text"
                    required
                    value={farmName}
                    onChange={(event) => setFarmName(event.target.value)}
                    placeholder="Kandang Puyuh Sejahtera"
                    className="h-11 pl-10"
                  />
                </div>
              </div>

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
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimal 8 karakter"
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

              <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
                Buat akun
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </>
        )}

        <p className="mt-8 text-center text-[11px] leading-relaxed text-stone-400">
          Sudah punya akun?{' '}
          <a href="/login" className="font-semibold text-emerald-600 hover:text-emerald-500">
            Masuk di sini
          </a>
        </p>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-stone-400">
          Aplikasi pencatatan internal. Bukan marketplace atau aplikasi kasir.
        </p>
      </div>
    </div>
  )
}
