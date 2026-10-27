import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, AlertCircle, Check, Eye } from 'lucide-react';
import { api } from '../services/api';
import type { Purchase, Supplier, Product, Unit } from '../types';

const todayISO = new Date().toISOString().slice(0, 10);

export const Purchasing: React.FC = () => {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  // Form state
  const [form, setForm] = useState({
    supplier_id: '',
    purchase_date: todayISO,
    discount_amount: 0,
    shipping_fee: 0,
    other_fees: 0,
    notes: '',
    auto_post: true,
    items: [
      {
        product_id: '',
        unit_id: '',
        quantity: 50, // 50 kg
        unit_price: 7500, // Rp7.500/kg
        discount_amount: 0,
        notes: '',
      },
    ],
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Queries
  const { data: purchases, isLoading: loadingPurchases } = useQuery<Purchase[]>({
    queryKey: ['purchases'],
    queryFn: () => api.get('/purchases'),
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers'),
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/products'),
  });

  const { data: units } = useQuery<Unit[]>({
    queryKey: ['units'],
    queryFn: () => api.get('/units'),
  });

  // Mutations
  const createPurchaseMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/purchases', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-bills'] });
      setShowAddModal(false);
      setFeedback({ type: 'success', message: 'Transaksi pembelian pakan berhasil disimpan' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal membuat pembelian' });
    },
  });

  const postPurchaseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/${id}/post`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-bills'] });
      setFeedback({ type: 'success', message: 'Pembelian disahkan: stok pakan bertambah & tagihan diterbitkan' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal mengesahkan pembelian' });
    },
  });

  const formatRupiah = (val?: string | number) => {
    if (!val) return 'Rp 0';
    const n = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(n);
  };

  const handleProductChange = (index: number, productId: string) => {
    const prod = products?.find((p) => p.id === productId);
    const newItems = [...form.items];
    newItems[index].product_id = productId;
    if (prod) {
      newItems[index].unit_id = prod.default_unit_id;
    }
    setForm({ ...form, items: newItems });
  };

  const subtotal = form.items.reduce(
    (acc, it) => acc + it.quantity * it.unit_price - it.discount_amount,
    0
  );
  const grandTotal = Math.max(0, subtotal - form.discount_amount + form.shipping_fee + form.other_fees);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Pembelian Pakan & Kebutuhan</h1>
          <p className="page-subtitle">
            Mencatat pengadaan pakan, bibit puyuh, vitamin, dan perlengkapan kandang dari pemasok.
          </p>
        </div>

        <button
          onClick={() => {
            const feedProd = products?.find((p) => p.category === 'feed');
            setForm({
              supplier_id: suppliers?.[0]?.id || '',
              purchase_date: todayISO,
              discount_amount: 0,
              shipping_fee: 0,
              other_fees: 0,
              notes: '',
              auto_post: true,
              items: [
                {
                  product_id: feedProd?.id || '',
                  unit_id: feedProd?.default_unit_id || units?.[0]?.id || '',
                  quantity: 100,
                  unit_price: 7500,
                  discount_amount: 0,
                  notes: '',
                },
              ],
            });
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 whitespace-nowrap px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>Buat Pembelian Baru</span>
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

      {/* Purchases Table */}
      <div className="table-shell">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
              <tr>
                <th className="px-5 py-3.5">Nomor PO & Tanggal</th>
                <th className="px-5 py-3.5">Pemasok (Supplier)</th>
                <th className="px-5 py-3.5">Total Pembelian</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingPurchases ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    Memuat data pembelian...
                  </td>
                </tr>
              ) : purchases && purchases.length > 0 ? (
                purchases.map((pur) => (
                  <tr key={pur.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{pur.purchase_number}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(pur.purchase_date).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-800">
                      {pur.supplier_name || 'Pemasok'}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-extrabold text-slate-900 text-base">
                        {formatRupiah(pur.grand_total)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {pur.status === 'posted' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                          <Check size={13} />
                          Disahkan (Posted)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedPurchase(pur)}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1"
                        title="Lihat Detail"
                      >
                        <Eye size={15} />
                      </button>
                      {pur.status === 'draft' && (
                        <button
                          onClick={() => postPurchaseMutation.mutate(pur.id)}
                          disabled={postPurchaseMutation.isPending}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                        >
                          Sahkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    Belum ada transaksi pembelian tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Detail Pembelian */}
      {selectedPurchase && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              Detail Pembelian: {selectedPurchase.purchase_number}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Pemasok: {selectedPurchase.supplier_name} | Tanggal:{' '}
              {new Date(selectedPurchase.purchase_date).toLocaleDateString('id-ID')}
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Barang</th>
                    <th className="px-3 py-2">Kuantitas</th>
                    <th className="px-3 py-2">Harga Beli</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPurchase.items_detail?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-medium">{it.product_name}</td>
                      <td className="px-3 py-2">{it.quantity} {it.unit_code}</td>
                      <td className="px-3 py-2">{formatRupiah(it.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-bold">{formatRupiah(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl text-xs space-y-1.5 mb-4">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Barang:</span>
                <span className="font-bold text-slate-800">{formatRupiah(selectedPurchase.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Ongkos Pengiriman:</span>
                <span>{formatRupiah(selectedPurchase.shipping_fee)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Potongan / Diskon:</span>
                <span>-{formatRupiah(selectedPurchase.discount_amount)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Kewajiban Tagihan:</span>
                <span className="text-amber-600">{formatRupiah(selectedPurchase.grand_total)}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedPurchase(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Buat Pembelian Baru */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Buat Pembelian Pakan Baru</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPurchaseMutation.mutate(form);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Pemasok (Supplier)
                  </label>
                  <select
                    required
                    value={form.supplier_id}
                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  >
                    <option value="">-- Pilih Pemasok --</option>
                    {suppliers?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tanggal Pembelian
                  </label>
                  <input
                    type="date"
                    required
                    value={form.purchase_date}
                    onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Items */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Detail Barang yang Dibeli
                </span>
                {form.items.map((item, idx) => (
                  <div key={idx} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pilih Produk</label>
                      <select
                        required
                        value={item.product_id}
                        onChange={(e) => handleProductChange(idx, e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-amber-500 outline-none"
                      >
                        <option value="">-- Pilih Produk --</option>
                        {products?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jumlah</label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...form.items];
                            newItems[idx].quantity = parseFloat(e.target.value) || 0;
                            setForm({ ...form, items: newItems });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-amber-500 outline-none font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Harga Beli Satuan
                        </label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={item.unit_price}
                          onChange={(e) => {
                            const newItems = [...form.items];
                            newItems[idx].unit_price = parseFloat(e.target.value) || 0;
                            setForm({ ...form, items: newItems });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-amber-500 outline-none font-bold"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ongkir & Diskon */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ongkos Kirim
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.shipping_fee}
                    onChange={(e) => setForm({ ...form, shipping_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Diskon Pembelian
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.discount_amount}
                    onChange={(e) => setForm({ ...form, discount_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Kalkulasi Total */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Total Tagihan Pembelian:</span>
                <span className="text-base font-black text-amber-950">{formatRupiah(grandTotal)}</span>
              </div>

              {/* Checkbox Auto-post */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.auto_post}
                  onChange={(e) => setForm({ ...form, auto_post: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs text-slate-700 font-semibold">
                  Langsung sahkan (Posted) & tambah stok fisik pakan sekarang
                </span>
              </label>

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
                  disabled={createPurchaseMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl disabled:opacity-50"
                >
                  {createPurchaseMutation.isPending ? 'Menyimpan...' : 'Simpan Pembelian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
