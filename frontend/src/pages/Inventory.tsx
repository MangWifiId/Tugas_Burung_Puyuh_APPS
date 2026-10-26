import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, AlertTriangle, ArrowDownRight, CheckCircle2, AlertCircle, SlidersHorizontal, PackagePlus } from 'lucide-react';
import { api } from '../services/api';
import type { StockSummaryItem, InventoryMovement, Flock, Coop, Product } from '../types';

export const Inventory: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'summary' | 'movements' | 'adjustments'>('summary');
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showStockInModal, setShowStockInModal] = useState(false);

  // Forms
  const [usageForm, setUsageForm] = useState({
    flock_id: '',
    coop_id: '',
    product_id: '',
    usage_date: new Date().toISOString().split('T')[0],
    quantity: 25,
    notes: '',
  });

  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    category: 'feed',
    default_unit_id: '',
    min_stock_alert: 50,
    initial_price: 8000,
    description: '',
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    product_id: '',
    actual_qty: 0,
    reason: '',
    notes: '',
  });

  const [stockInForm, setStockInForm] = useState({
    product_id: '',
    quantity: 0,
    unit_cost: 0,
    received_date: new Date().toISOString().split('T')[0],
    notes: '',
    source: '',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Queries
  const { data: summary, isLoading: loadingSummary } = useQuery<StockSummaryItem[]>({
    queryKey: ['inventory-summary'],
    queryFn: () => api.get('/inventory/summary'),
  });

  const { data: movements, isLoading: loadingMovements } = useQuery<InventoryMovement[]>({
    queryKey: ['inventory-movements'],
    queryFn: () => api.get('/inventory/movements'),
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/products'),
  });

  const { data: units } = useQuery<any[]>({
    queryKey: ['units'],
    queryFn: () => api.get('/units'),
  });

  const { data: flocks } = useQuery<Flock[]>({
    queryKey: ['flocks'],
    queryFn: () => api.get('/flocks'),
  });

  const { data: coops } = useQuery<Coop[]>({
    queryKey: ['coops'],
    queryFn: () => api.get('/coops'),
  });

  // Mutations
  const recordUsageMutation = useMutation({
    mutationFn: (data: typeof usageForm) => api.post('/inventory/feed-usage', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setShowUsageModal(false);
      setUsageForm({
        flock_id: '',
        coop_id: '',
        product_id: '',
        usage_date: new Date().toISOString().split('T')[0],
        quantity: 25,
        notes: '',
      });
      setFeedback({ type: 'success', message: 'Pemakaian pakan berhasil dicatat dan stok berkurang' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal mencatat pemakaian pakan' });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: (data: typeof productForm) => api.post('/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      setShowAddProductModal(false);
      setFeedback({ type: 'success', message: 'Master produk persediaan berhasil ditambahkan' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal menambahkan produk' });
    },
  });

  const adjustmentMutation = useMutation({
    mutationFn: (data: typeof adjustmentForm) => api.post('/inventory/adjustments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      setShowAdjustmentModal(false);
      setAdjustmentForm({ product_id: '', actual_qty: 0, reason: '', notes: '' });
      setFeedback({ type: 'success', message: 'Penyesuaian stok berhasil dicatat' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal melakukan penyesuaian stok' });
    },
  });

  const stockInMutation = useMutation({
    mutationFn: (data: typeof stockInForm) => api.post('/inventory/stock-in', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      setShowStockInModal(false);
      setStockInForm({
        product_id: '',
        quantity: 0,
        unit_cost: 0,
        received_date: new Date().toISOString().split('T')[0],
        notes: '',
        source: '',
      });
      setFeedback({ type: 'success', message: 'Penerimaan stok berhasil dicatat dan saldo stok bertambah' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal mencatat penerimaan stok' });
    },
  });

  const formatNumber = (val?: string | number) => {
    if (!val) return '0';
    const n = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('id-ID').format(n);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pakan & Persediaan</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Satu sumber kebenaran stok fisik (Single Source of Truth) dari mutasi pergerakan barang resmi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddProductModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>Tambah Barang</span>
          </button>
          <button
            onClick={() => setShowStockInModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <PackagePlus size={16} />
            <span>Terima Stok Masuk</span>
          </button>
          <button
            onClick={() => { setShowAdjustmentModal(true); setActiveTab('adjustments'); }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <SlidersHorizontal size={16} />
            <span>Penyesuaian Stok</span>
          </button>
          <button
            onClick={() => setShowUsageModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>Catat Pemakaian Pakan</span>
          </button>
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
          onClick={() => setActiveTab('summary')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'summary'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package size={18} />
          <span>Ringkasan Saldo Stok ({summary?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'movements'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowDownRight size={18} />
          <span>Buku Mutasi Stok (Ledger)</span>
        </button>
        <button
          onClick={() => setActiveTab('adjustments')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'adjustments'
              ? 'border-violet-600 text-violet-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <SlidersHorizontal size={18} />
          <span>Penyesuaian Stok</span>
        </button>
      </div>

      {/* TAB 1: RINGKASAN STOK */}
      {activeTab === 'summary' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-5 py-3.5">SKU & Nama Barang</th>
                  <th className="px-5 py-3.5">Kategori</th>
                  <th className="px-5 py-3.5">Stok Saat Ini</th>
                  <th className="px-5 py-3.5">Batas Minimum</th>
                  <th className="px-5 py-3.5">Status Persediaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingSummary ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      Memuat ringkasan stok...
                    </td>
                  </tr>
                ) : summary && summary.length > 0 ? (
                  summary.map((item) => (
                    <tr key={item.product_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-xs font-mono text-slate-500">{item.sku}</div>
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 font-semibold text-slate-700 capitalize">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-extrabold text-base text-slate-900">
                          {formatNumber(item.current_stock)}
                        </span>{' '}
                        <span className="text-xs font-semibold text-slate-500">{item.unit_code}</span>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600">
                        {formatNumber(item.min_stock_alert)} {item.unit_code}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {item.is_low_stock ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-bold border border-red-200">
                            <AlertTriangle size={14} />
                            Stok Menipis
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                            <CheckCircle2 size={14} />
                            Aman
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      Belum ada data barang persediaan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BUKU MUTASI STOK */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Tanggal</th>
                  <th className="px-5 py-3.5">Barang</th>
                  <th className="px-5 py-3.5">Jenis Mutasi</th>
                  <th className="px-5 py-3.5 text-right">Kuantitas</th>
                  <th className="px-5 py-3.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingMovements ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      Memuat riwayat pergerakan stok...
                    </td>
                  </tr>
                ) : movements && movements.length > 0 ? (
                  movements.map((mov) => {
                    const qty = typeof mov.quantity === 'string' ? parseFloat(mov.quantity) : mov.quantity;
                    const isPositive = qty > 0;

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 text-xs font-semibold text-slate-700">
                          {new Date(mov.movement_date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-slate-900">
                          {mov.product_name}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                              isPositive
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {mov.movement_type}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span
                            className={`font-black text-sm ${
                              isPositive ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {isPositive ? `+${formatNumber(qty)}` : formatNumber(qty)}
                          </span>{' '}
                          <span className="text-xs text-slate-500 font-normal">{mov.unit_code}</span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {mov.notes || '-'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      Belum ada mutasi stok tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PENYESUAIAN STOK */}
      {activeTab === 'adjustments' && (
        <div className="space-y-4">
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-sm text-violet-800">
            <p className="font-bold mb-1">Apa itu Penyesuaian Stok?</p>
            <p className="text-xs leading-relaxed">
              Penyesuaian stok digunakan saat stok fisik di gudang berbeda dengan catatan sistem (misalnya setelah stock opname).
              Sistem akan mencatat selisihnya sebagai mutasi <strong>adjustment_in</strong> atau <strong>adjustment_out</strong>.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col items-center gap-4">
            <SlidersHorizontal size={40} className="text-violet-400" />
            <p className="text-sm text-slate-600 text-center max-w-sm">
              Klik tombol <strong>"Penyesuaian Stok"</strong> di header untuk membuka form penyesuaian stok,
              atau gunakan tombol di bawah ini:
            </p>
            <button
              onClick={() => setShowAdjustmentModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-sm transition-all"
            >
              <SlidersHorizontal size={18} />
              Buka Form Penyesuaian Stok
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Catat Pemakaian Pakan */}
      {showUsageModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Catat Pemakaian Pakan / Obat</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordUsageMutation.mutate(usageForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Pilih Produk Pakan / Obat
                </label>
                <select
                  required
                  value={usageForm.product_id}
                  onChange={(e) => setUsageForm({ ...usageForm, product_id: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                >
                  <option value="">-- Pilih Barang --</option>
                  {products
                    ?.filter((p) => p.category === 'feed' || p.category === 'medicine')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Sisa stok: {p.current_stock || 0})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tanggal Pemakaian
                  </label>
                  <input
                    type="date"
                    required
                    value={usageForm.usage_date}
                    onChange={(e) => setUsageForm({ ...usageForm, usage_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Jumlah Pemakaian
                  </label>
                  <input
                    type="number"
                    required
                    min={0.1}
                    step="any"
                    value={usageForm.quantity}
                    onChange={(e) => setUsageForm({ ...usageForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kelompok Puyuh
                  </label>
                  <select
                    required
                    value={usageForm.flock_id}
                    onChange={(e) => setUsageForm({ ...usageForm, flock_id: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  >
                    <option value="">-- Pilih Batch --</option>
                    {flocks?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
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
                    value={usageForm.coop_id}
                    onChange={(e) => setUsageForm({ ...usageForm, coop_id: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  >
                    <option value="">-- Pilih Kandang --</option>
                    {coops?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Catatan
                </label>
                <input
                  type="text"
                  placeholder="misal: Pakan ransum pagi 25kg"
                  value={usageForm.notes}
                  onChange={(e) => setUsageForm({ ...usageForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowUsageModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={recordUsageMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl disabled:opacity-50"
                >
                  {recordUsageMutation.isPending ? 'Menyimpan...' : 'Simpan Pemakaian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Master Barang */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Tambah Master Barang / Produk</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createProductMutation.mutate(productForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    SKU Barang
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="misal: PKN-02"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kategori
                  </label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  >
                    <option value="feed">Pakan</option>
                    <option value="medicine">Obat / Vitamin</option>
                    <option value="egg">Telur</option>
                    <option value="quail">Bibit / Burung</option>
                    <option value="equipment">Perlengkapan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Barang
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: Konsentrat Puyuh Grower"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Satuan Default
                  </label>
                  <select
                    required
                    value={productForm.default_unit_id}
                    onChange={(e) => setProductForm({ ...productForm, default_unit_id: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  >
                    <option value="">-- Pilih Satuan --</option>
                    {units?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Batas Stok Min.
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={productForm.min_stock_alert}
                    onChange={(e) => setProductForm({ ...productForm, min_stock_alert: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createProductMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl disabled:opacity-50"
                >
                  {createProductMutation.isPending ? 'Menyimpan...' : 'Simpan Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Penyesuaian Stok (Stock Opname) */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Penyesuaian Stok Fisik</h2>
            <p className="text-xs text-slate-500 mb-4">
              Sesuaikan kuantitas catatan sistem dengan hasil hitung fisik di gudang.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                adjustmentMutation.mutate(adjustmentForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Pilih Barang
                </label>
                <select
                  required
                  value={adjustmentForm.product_id}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, product_id: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-violet-500 outline-none"
                >
                  <option value="">-- Pilih Barang --</option>
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Jumlah Fisik Aktual
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={adjustmentForm.actual_qty}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, actual_qty: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-violet-500 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Alasan Penyesuaian
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: Selisih stock opname mingguan, pakan tumpah, dll."
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-violet-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Catatan tim gudang..."
                  value={adjustmentForm.notes}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-violet-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={adjustmentMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl disabled:opacity-50"
                >
                  {adjustmentMutation.isPending ? 'Menyimpan...' : 'Simpan Penyesuaian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Terima Stok Masuk (Stock In Manual) */}
      {showStockInModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Penerimaan Stok Masuk</h2>
            <p className="text-xs text-slate-500 mb-4">
              Catat penerimaan stok masuk non-PO (stok awal, hibah, retur, pengadaan tunai kecil).
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                stockInMutation.mutate(stockInForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Pilih Barang
                </label>
                <select
                  required
                  value={stockInForm.product_id}
                  onChange={(e) => setStockInForm({ ...stockInForm, product_id: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 outline-none"
                >
                  <option value="">-- Pilih Barang --</option>
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tanggal Terima
                  </label>
                  <input
                    type="date"
                    required
                    value={stockInForm.received_date}
                    onChange={(e) => setStockInForm({ ...stockInForm, received_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Jumlah Masuk
                  </label>
                  <input
                    type="number"
                    required
                    min={0.1}
                    step="any"
                    value={stockInForm.quantity}
                    onChange={(e) => setStockInForm({ ...stockInForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Biaya per Unit (Opsional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={stockInForm.unit_cost}
                    onChange={(e) => setStockInForm({ ...stockInForm, unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Sumber / Asal
                  </label>
                  <input
                    type="text"
                    placeholder="misal: Stok Awal / Peternak Mitra"
                    value={stockInForm.source}
                    onChange={(e) => setStockInForm({ ...stockInForm, source: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Catatan Penerimaan
                </label>
                <input
                  type="text"
                  placeholder="Keterangan dokumen fisik / surat jalan..."
                  value={stockInForm.notes}
                  onChange={(e) => setStockInForm({ ...stockInForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowStockInModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={stockInMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50"
                >
                  {stockInMutation.isPending ? 'Menyimpan...' : 'Simpan Penerimaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
