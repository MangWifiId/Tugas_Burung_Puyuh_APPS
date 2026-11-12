import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Bird, CheckCircle2, Loader2, Mail, RefreshCw, TriangleAlert } from 'lucide-react'
import { api, getErrorMessage } from '../services/api'
import type { ApiResponse } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { usePageTitle } from '../components/ProtectedRoute'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function VerifyEmailPage() {
  usePageTitle('Verifikasi Email')
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'idle')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const requested = useRef(false)

  useEffect(() => {
    if (!token || requested.current) return
    requested.current = true
    let active = true
    api
      .post<ApiResponse<{ message: string }>>('/auth/verify-email', { token })
      .then((response) => {
        if (!active) return
        setStatus('success')
        setMessage(response.data.data?.message ?? 'Email berhasil diverifikasi.')
      })
      .catch((err) => {
        if (!active) return
        setStatus('error')
        setMessage(getErrorMessage(err))
      })
    return () => {
      active = false
    }
  }, [token])

  const handleResend = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
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
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4] flex items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
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

        {status === 'loading' && (
          <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-5">
            <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-stone-900">Memverifikasi email...</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                Mohon tunggu sebentar, jangan tutup halaman ini.
              </p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-700" />
            </div>
            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              Verifikasi berhasil
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Email Anda sudah aktif
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-stone-500">
              {message} Sekarang Anda bisa masuk ke aplikasi menggunakan email dan kata sandi yang
              sudah didaftarkan.
            </p>
            <Link
              to="/login"
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Masuk ke aplikasi
              <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}

        {(status === 'error' || status === 'idle') && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100">
              <Mail className="h-7 w-7 text-amber-600" />
            </div>
            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              Verifikasi email
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              {status === 'error' ? 'Tautan tidak berlaku' : 'Masukkan email Anda'}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-stone-500">
              {status === 'error'
                ? message
                : 'Masukkan email yang dipakai saat mendaftar. Kami akan mengirim tautan verifikasi baru.'}
            </p>

            <form onSubmit={handleResend} className="mt-6 space-y-4">
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

              {resendMessage && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-xs font-medium leading-relaxed text-emerald-700">
                  {resendMessage}
                </div>
              )}
              {resendError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-xs font-medium leading-relaxed text-rose-700">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {resendError}
                </div>
              )}

              <Button type="submit" size="lg" loading={sending} className="w-full">
                {!sending && <RefreshCw className="h-4 w-4" />}
                Kirim tautan verifikasi
              </Button>
            </form>
          </>
        )}

        <p className="mt-8 text-center text-[11px] leading-relaxed text-stone-400">
          Sudah verifikasi?{' '}
          <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-500">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  )
}
