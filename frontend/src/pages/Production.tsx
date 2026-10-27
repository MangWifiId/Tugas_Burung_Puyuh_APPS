import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Egg, Plus, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { api } from '../services/api';
import type { ProductionRecord, Flock, Coop } from '../types';

const todayISO = new Date().toISOString().slice(0, 10);

export const Production: React.FC = () => {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const [form, setForm] = useState({
    flock_id: '',
    coop_id: '',
    record_date: todayISO,
    total_eggs: 500,
    damaged_eggs: 10,
    notes: '',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Queries
  const { data: records, isLoading: loadingRecords } = useQuery<ProductionRecord[]>({
    queryKey: ['production-records'],
    queryFn: () => api.get('/production'),
  });

  const { data: flocks } = useQuery<Flock[]>({
    queryKey: ['flocks'],
    queryFn: () => api.get('/flocks'),
  });

  const { data: coops } = useQuery<Coop[]>({
    queryKey: ['coops'],
    queryFn: () => api.get('/coops'),
  });

  // Mutation
  const recordMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/production', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-records'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['production-trends'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      setShowAddModal(false);
      setForm({
        flock_id: '',
        coop_id: '',
        record_date: todayISO,
        total_eggs: 500,
        damaged_eggs: 10,
        notes: '',
      });
      setFeedback({
        type: 'success',
        message: 'Hasil panen telur berhasil dicatat dan stok telur layak jual bertambah',
      });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal menyimpan catatan panen telur' });
    },
  });

  const calculatedSaleable = Math.max(0, form.total_eggs - form.damaged_eggs);
  const calculatedRacks = Math.floor(calculatedSaleable / 30);
  const calculatedRemain = calculatedSaleable % 30;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Pencatatan Produksi Telur</h1>
          <p className="page-subtitle">
            Catat hasil panen harian per kandang. Telur layak jual otomatis menambah stok inventaris.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 whitespace-nowrap px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>Input Panen Telur</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Production History Table */}
      <div className="table-shell">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
              <tr>
                <th className="px-5 py-3.5">Tanggal Panen</th>
                <th className="px-5 py-3.5">Kandang & Batch</th>
                <th className="px-5 py-3.5">Total Telur Diambil</th>
                <th className="px-5 py-3.5">Telur Rusak / Retak</th>
                <th className="px-5 py-3.5">Telur Layak Jual (Net)</th>
                <th className="px-5 py-3.5">Konversi Rak</th>
                <th className="px-5 py-3.5">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingRecords ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Memuat riwayat panen telur...
                  </td>
                </tr>
              ) : records && records.length > 0 ? (
                records.map((rec) => {
                  const racks = Math.floor(rec.saleable_eggs / 30);
                  const rem = rec.saleable_eggs % 30;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Calendar size={14} className="text-amber-500" />
                        {new Date(rec.record_date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <div className="font-bold text-slate-900">{rec.coop_name || 'Kandang'}</div>
                        <div className="text-slate-500 text-[11px]">{rec.flock_name || 'Batch'}</div>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-800">
                        {rec.total_eggs.toLocaleString()} butir
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-red-600">
                        {rec.damaged_eggs > 0 ? `${rec.damaged_eggs} butir` : '-'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-extrabold text-emerald-700 text-sm">
                          {rec.saleable_eggs.toLocaleString()}
                        </span>{' '}
                        <span className="text-xs text-slate-500 font-normal">butir</span>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600">
                        {racks} Rak {rem > 0 ? `+ ${rem} btr` : ''}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {rec.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Belum ada riwayat produksi telur. Klik "Input Panen Telur" untuk mulai mencatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Input Panen Telur */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Egg size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Catat Panen Telur Harian</h2>
                <p className="text-xs text-slate-500">Hasil layak jual otomatis masuk ke stok siap distribusi</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordMutation.mutate(form);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tanggal Panen
                </label>
                <input
                  type="date"
                  required
                  value={form.record_date}
                  onChange={(e) => setForm({ ...form, record_date: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kelompok Puyuh (Flock)
                  </label>
                  <select
                    required
                    value={form.flock_id}
                    onChange={(e) => setForm({ ...form, flock_id: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  >
                    <option value="">-- Pilih Batch --</option>
                    {flocks?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.current_quantity} ekor)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kandang
                  </label>
                  <select
                    required
                    value={form.coop_id}
                    onChange={(e) => setForm({ ...form, coop_id: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  >
                    <option value="">-- Pilih Kandang --</option>
                    {coops?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Total Telur Diambil (Butir)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.total_eggs}
                    onChange={(e) => setForm({ ...form, total_eggs: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Telur Rusak / Pecah (Butir)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.damaged_eggs}
                    onChange={(e) => setForm({ ...form, damaged_eggs: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none font-bold text-red-600"
                  />
                </div>
              </div>

              {/* Kalkulasi Telur Layak Jual */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-900">Hasil Telur Layak Jual:</span>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Rumus: Total Telur ({form.total_eggs}) - Telur Rusak ({form.damaged_eggs})
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-amber-950">{calculatedSaleable.toLocaleString()}</span>
                  <span className="text-xs font-bold text-amber-800 ml-1">butir</span>
                  <div className="text-[11px] font-semibold text-amber-700">
                    ≈ {calculatedRacks} Rak {calculatedRemain > 0 ? `+ ${calculatedRemain} btr` : ''}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Catatan Tambahan
                </label>
                <input
                  type="text"
                  placeholder="misal: Panen sore hari, kondisi cuaca stabil"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={recordMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl disabled:opacity-50"
                >
                  {recordMutation.isPending ? 'Menyimpan...' : 'Simpan Panen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
