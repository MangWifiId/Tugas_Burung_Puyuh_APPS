import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Home, Bird, Plus, ArrowRightLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import type { Coop, Flock } from '../types';

export const CoopsAndFlocks: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'coops' | 'flocks'>('coops');

  // Modal states
  const [showAddCoop, setShowAddCoop] = useState(false);
  const [showAddFlock, setShowAddFlock] = useState(false);
  const [showMovement, setShowMovement] = useState<Flock | null>(null);

  // Forms
  const [coopForm, setCoopForm] = useState({ code: '', name: '', capacity: 1000, notes: '' });
  const [flockForm, setFlockForm] = useState({
    code: '',
    name: '',
    entry_date: new Date().toISOString().split('T')[0],
    initial_quantity: 1000,
    initial_age_days: 30,
    initial_coop_id: '',
    notes: '',
  });
  const [movementForm, setMovementForm] = useState({
    movement_date: new Date().toISOString().split('T')[0],
    movement_type: 'mortality',
    quantity: 1,
    from_coop_id: '',
    to_coop_id: '',
    reason: '',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Queries
  const { data: coops, isLoading: loadingCoops } = useQuery<Coop[]>({
    queryKey: ['coops'],
    queryFn: () => api.get('/coops'),
  });

  const { data: flocks, isLoading: loadingFlocks } = useQuery<Flock[]>({
    queryKey: ['flocks'],
    queryFn: () => api.get('/flocks'),
  });

  // Mutations
  const createCoopMutation = useMutation({
    mutationFn: (data: typeof coopForm) => api.post('/coops', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coops'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setShowAddCoop(false);
      setCoopForm({ code: '', name: '', capacity: 1000, notes: '' });
      setFeedback({ type: 'success', message: 'Kandang baru berhasil ditambahkan' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal menambahkan kandang' });
    },
  });

  const createFlockMutation = useMutation({
    mutationFn: (data: typeof flockForm) => api.post('/flocks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flocks'] });
      queryClient.invalidateQueries({ queryKey: ['coops'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setShowAddFlock(false);
      setFlockForm({
        code: '',
        name: '',
        entry_date: new Date().toISOString().split('T')[0],
        initial_quantity: 1000,
        initial_age_days: 30,
        initial_coop_id: '',
        notes: '',
      });
      setFeedback({ type: 'success', message: 'Kelompok puyuh baru berhasil dicatat' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal mencatat kelompok puyuh' });
    },
  });

  const recordMovementMutation = useMutation({
    mutationFn: ({ flockId, data }: { flockId: string; data: any }) =>
      api.post(`/flocks/${flockId}/movements`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flocks'] });
      queryClient.invalidateQueries({ queryKey: ['coops'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setShowMovement(null);
      setMovementForm({
        movement_date: new Date().toISOString().split('T')[0],
        movement_type: 'mortality',
        quantity: 1,
        from_coop_id: '',
        to_coop_id: '',
        reason: '',
      });
      setFeedback({ type: 'success', message: 'Perubahan populasi berhasil disimpan' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal mencatat pergerakan populasi' });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kandang & Populasi Puyuh</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola data kandang, kelompok bibit/layer, kematian, afkir, serta mutasi antar-kandang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'coops' ? (
            <button
              onClick={() => setShowAddCoop(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all"
            >
              <Plus size={16} />
              <span>Tambah Kandang</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddFlock(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all"
            >
              <Plus size={16} />
              <span>Tambah Kelompok / Batch</span>
            </button>
          )}
        </div>
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

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('coops')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'coops'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home size={18} />
          <span>Daftar Kandang ({coops?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('flocks')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'flocks'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bird size={18} />
          <span>Kelompok / Batch Puyuh ({flocks?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: KANDANG */}
      {activeTab === 'coops' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingCoops ? (
            <div className="col-span-full py-12 text-center text-slate-400">Memuat data kandang...</div>
          ) : coops && coops.length > 0 ? (
            coops.map((coop) => {
              const currentPop = coop.current_population || 0;
              const fillPercentage = Math.min(Math.round((currentPop / coop.capacity) * 100), 100);

              return (
                <div key={coop.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        {coop.code}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                        {coop.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{coop.name}</h3>
                    {coop.notes && <p className="text-xs text-slate-500 mt-1">{coop.notes}</p>}

                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Populasi Saat Ini:</span>
                        <span className="font-extrabold text-slate-900">{currentPop.toLocaleString()} ekor</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Kapasitas Maksimal:</span>
                        <span className="font-semibold text-slate-700">{coop.capacity.toLocaleString()} ekor</span>
                      </div>

                      {/* Progress bar kapasitas */}
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${
                            fillPercentage > 90 ? 'bg-red-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${fillPercentage}%` }}
                        />
                      </div>
                      <div className="text-right text-[11px] font-medium text-slate-400">
                        Kapasitas terisi {fillPercentage}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center text-slate-400">
              Belum ada kandang yang ditambahkan.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FLOCKS */}
      {activeTab === 'flocks' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-5 py-3.5">Kode & Nama Batch</th>
                    <th className="px-5 py-3.5">Tanggal Masuk</th>
                    <th className="px-5 py-3.5">Jumlah Awal</th>
                    <th className="px-5 py-3.5">Sisa Populasi</th>
                    <th className="px-5 py-3.5">Sebaran Kandang</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingFlocks ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        Memuat data kelompok puyuh...
                      </td>
                    </tr>
                  ) : flocks && flocks.length > 0 ? (
                    flocks.map((flock) => (
                      <tr key={flock.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">{flock.name}</div>
                          <div className="text-xs text-amber-600 font-mono font-semibold">{flock.code}</div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-600">
                          {new Date(flock.entry_date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-slate-600">
                          {flock.initial_quantity.toLocaleString()} ekor
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-extrabold text-slate-900">
                            {flock.current_quantity.toLocaleString()}
                          </span>{' '}
                          <span className="text-xs text-slate-500">ekor</span>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {flock.coop_placements && flock.coop_placements.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {flock.coop_placements.map((p) => (
                                <span
                                  key={p.coop_id}
                                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]"
                                >
                                  {p.coop_name}: <b>{p.quantity}</b>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Belum ada sebaran</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => {
                              setShowMovement(flock);
                              if (flock.coop_placements && flock.coop_placements.length > 0) {
                                setMovementForm((prev) => ({
                                  ...prev,
                                  from_coop_id: flock.coop_placements![0].coop_id,
                                }));
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-colors"
                          >
                            <ArrowRightLeft size={14} />
                            <span>Catat Mutasi</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        Belum ada kelompok puyuh terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Kandang */}
      {showAddCoop && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Tambah Kandang Baru</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createCoopMutation.mutate(coopForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Kode Kandang
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: KND-03"
                  value={coopForm.code}
                  onChange={(e) => setCoopForm({ ...coopForm, code: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Kandang
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: Kandang B1 (Layer)"
                  value={coopForm.name}
                  onChange={(e) => setCoopForm({ ...coopForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Kapasitas Maksimal (Ekor)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={coopForm.capacity}
                  onChange={(e) => setCoopForm({ ...coopForm, capacity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Catatan / Lokasi
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan kondisi kandang..."
                  value={coopForm.notes}
                  onChange={(e) => setCoopForm({ ...coopForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCoop(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createCoopMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl disabled:opacity-50"
                >
                  {createCoopMutation.isPending ? 'Menyimpan...' : 'Simpan Kandang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Kelompok Puyuh */}
      {showAddFlock && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Tambah Kelompok / Batch Puyuh Baru</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createFlockMutation.mutate(flockForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kode Batch
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="misal: FLK-2026-02"
                    value={flockForm.code}
                    onChange={(e) => setFlockForm({ ...flockForm, code: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Batch
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="misal: Puyuh Layer Batch B"
                    value={flockForm.name}
                    onChange={(e) => setFlockForm({ ...flockForm, name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tanggal Masuk
                  </label>
                  <input
                    type="date"
                    required
                    value={flockForm.entry_date}
                    onChange={(e) => setFlockForm({ ...flockForm, entry_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Jumlah Bibit (Ekor)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={flockForm.initial_quantity}
                    onChange={(e) => setFlockForm({ ...flockForm, initial_quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Kandang Awal Alokasi
                </label>
                <select
                  required
                  value={flockForm.initial_coop_id}
                  onChange={(e) => setFlockForm({ ...flockForm, initial_coop_id: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                >
                  <option value="">-- Pilih Kandang --</option>
                  {coops?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) - Kapasitas: {c.capacity}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddFlock(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createFlockMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl disabled:opacity-50"
                >
                  {createFlockMutation.isPending ? 'Menyimpan...' : 'Simpan Kelompok'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Catat Pergerakan Populasi (Mortalitas / Afkir / Pindah Kandang) */}
      {showMovement && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Catat Mutasi Populasi</h2>
            <p className="text-xs text-slate-500 mb-4">
              Batch: <span className="font-semibold text-slate-800">{showMovement.name}</span> (Sisa: {showMovement.current_quantity} ekor)
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordMovementMutation.mutate({
                  flockId: showMovement.id,
                  data: movementForm,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Jenis Mutasi
                </label>
                <select
                  value={movementForm.movement_type}
                  onChange={(e) => setMovementForm({ ...movementForm, movement_type: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                >
                  <option value="mortality">Kematian (Mortalitas) - Mengurangi Populasi</option>
                  <option value="culling">Afkir (Culling) - Mengurangi Populasi</option>
                  <option value="transfer">Pindah Kandang (Transfer) - Tetap (Tidak Mengubah Total)</option>
                  <option value="addition">Penambahan Populasi</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tanggal Mutasi
                  </label>
                  <input
                    type="date"
                    required
                    value={movementForm.movement_date}
                    onChange={(e) => setMovementForm({ ...movementForm, movement_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Jumlah (Ekor)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={movementForm.quantity}
                    onChange={(e) => setMovementForm({ ...movementForm, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Kandang asal */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Kandang Asal
                </label>
                <select
                  value={movementForm.from_coop_id}
                  onChange={(e) => setMovementForm({ ...movementForm, from_coop_id: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                >
                  <option value="">-- Pilih Kandang Asal --</option>
                  {coops?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Kandang tujuan hanya jika transfer */}
              {movementForm.movement_type === 'transfer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kandang Tujuan (Transfer)
                  </label>
                  <select
                    required
                    value={movementForm.to_coop_id}
                    onChange={(e) => setMovementForm({ ...movementForm, to_coop_id: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  >
                    <option value="">-- Pilih Kandang Tujuan --</option>
                    {coops?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Alasan / Keterangan Wajib
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: Penyakit stres cuaca, seleksi afkir, dsb."
                  value={movementForm.reason}
                  onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowMovement(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={recordMovementMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl disabled:opacity-50"
                >
                  {recordMovementMutation.isPending ? 'Menyimpan...' : 'Simpan Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
