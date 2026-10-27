import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { api } from '../services/api';
import type { User } from '../types';
import {
  Egg,
  KeyRound,
  Mail,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  ChartNoAxesCombined,
} from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('owner@puyuh.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await api.post<{ token: string; user: User }>('/auth/login', {
        email,
        password,
      });
      login(res.token, res.user);
      navigate('/');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Login gagal. Periksa kembali email dan password Anda.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4 sm:p-6">
      {/* Ambient background */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 h-[32rem] w-[32rem] rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-10 lg:flex">
          <div className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25">
                <Egg size={24} strokeWidth={2.3} />
              </div>
              <div>
                <p className="text-lg font-extrabold leading-none tracking-tight text-white">
                  QuailFarm
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400">
                  Manajemen Puyuh
                </p>
              </div>
            </div>

            <h1 className="mt-12 text-3xl font-extrabold leading-[1.15] tracking-tight text-white">
              Kelola peternakan
              <br />
              lebih tenang,
              <br />
              <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
                lebih terukur.
              </span>
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Populasi, produksi telur, pakan, penjualan, hingga arus kas — semuanya dalam
              satu dashboard yang rapi.
            </p>
          </div>

          <div className="relative mt-10 space-y-3">
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.04] p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-100">Data tersimpan aman</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                  Penyimpanan atomik dan sinkronisasi otomatis.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.04] p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
                <ChartNoAxesCombined size={18} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-100">Keputusan berbasis data</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                  Pantau FCR, hen-day, dan tren produksi harian.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="bg-white p-6 sm:p-10">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950">
              <Egg size={21} strokeWidth={2.3} />
            </div>
            <div>
              <p className="text-base font-extrabold leading-none tracking-tight text-slate-900">
                QuailFarm
              </p>
              <p className="mt-1 text-[11px] font-semibold text-amber-600">
                Manajemen Peternakan Puyuh
              </p>
            </div>
          </div>

          <div className="hidden lg:block">
            <p className="eyebrow">Selamat datang</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
              Masuk ke akun Anda
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Gunakan email peternak untuk melanjutkan.
            </p>
          </div>

          {error && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="field-label">
                Email Peternak
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@peternakan.com"
                  className="field pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                Kata Sandi
              </label>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-700"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary mt-2 w-full py-3">
              <span>{isSubmitting ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Akun demo bawaan
            </p>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>
                Email:{' '}
                <code className="rounded bg-white px-1.5 py-0.5 font-bold text-slate-800 ring-1 ring-slate-200">
                  owner@puyuh.com
                </code>
              </p>
              <p>
                Sandi:{' '}
                <code className="rounded bg-white px-1.5 py-0.5 font-bold text-slate-800 ring-1 ring-slate-200">
                  password123
                </code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
