import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Plus, CheckCircle2, AlertCircle, ArrowDownRight, DollarSign, Receipt } from 'lucide-react';
import { api } from '../services/api';
import type { CustomerInvoice, SupplierBill, CashAccount, Expense, CashTransaction } from '../types';

export const Finance: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'receivables' | 'payables' | 'expenses' | 'cash'>('receivables');

  // Modal states
  const [payInvoiceModal, setPayInvoiceModal] = useState<CustomerInvoice | null>(null);
  const [payBillModal, setPayBillModal] = useState<SupplierBill | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Forms
  const [custPaymentForm, setCustPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    cash_account_id: '',
    amount: 0,
    notes: '',
  });

  const [suppPaymentForm, setSuppPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    cash_account_id: '',
    amount: 0,
    notes: '',
  });

  const [expenseForm, setExpenseForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'electricity',
    amount: 150000,
    cash_account_id: '',
    recipient: 'Petugas Listrik PLN',
    notes: 'Listrik operasional kandang bulan ini',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Queries
  const { data: invoices, isLoading: loadingInvoices } = useQuery<CustomerInvoice[]>({
    queryKey: ['invoices'],
    queryFn: () => api.get('/invoices'),
  });

  const { data: bills, isLoading: loadingBills } = useQuery<SupplierBill[]>({
    queryKey: ['supplier-bills'],
    queryFn: () => api.get('/supplier-bills'),
  });

  const { data: cashAccounts } = useQuery<CashAccount[]>({
    queryKey: ['cash-accounts'],
    queryFn: () => api.get('/cash-accounts'),
  });

  const { data: expenses, isLoading: loadingExpenses } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: () => api.get('/expenses'),
  });

  const { data: transactions, isLoading: loadingTransactions } = useQuery<CashTransaction[]>({
    queryKey: ['cash-transactions'],
    queryFn: () => api.get('/cash-transactions'),
  });

  // Mutations
  const custPaymentMutation = useMutation({
    mutationFn: (data: any) => api.post('/customer-payments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['cash-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setPayInvoiceModal(null);
      setFeedback({ type: 'success', message: 'Penerimaan pembayaran piutang berhasil dicatat dan kas bertambah' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal mencatat pembayaran pelanggan' });
    },
  });

  const suppPaymentMutation = useMutation({
    mutationFn: (data: any) => api.post('/supplier-payments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-bills'] });
      queryClient.invalidateQueries({ queryKey: ['cash-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setPayBillModal(null);
      setFeedback({ type: 'success', message: 'Pembayaran utang pemasok berhasil dicatat dan kas berkurang' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal mencatat pembayaran utang' });
    },
  });

  const expenseMutation = useMutation({
    mutationFn: (data: typeof expenseForm) => api.post('/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cash-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setShowExpenseModal(false);
      setFeedback({ type: 'success', message: 'Beban operasional berhasil dicatat' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Gagal mencatat beban operasional' });
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Keuangan, Tagihan & Arus Kas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola piutang pelanggan, utang pemasok, beban operasional, dan mutasi kas secara rapi & terpadu.
          </p>
        </div>

        <button
          onClick={() => {
            setExpenseForm((prev) => ({
              ...prev,
              cash_account_id: cashAccounts?.[0]?.id || '',
            }));
            setShowExpenseModal(true);
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>Catat Biaya Operasional</span>
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

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('receivables')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'receivables'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt size={18} />
          <span>Piutang Pelanggan ({invoices?.filter((i) => i.status !== 'paid').length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('payables')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'payables'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign size={18} />
          <span>Utang Pemasok ({bills?.filter((b) => b.status !== 'paid').length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'expenses'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowDownRight size={18} />
          <span>Beban Operasional ({expenses?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('cash')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'cash'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet size={18} />
          <span>Rekening & Mutasi Kas</span>
        </button>
      </div>

      {/* TAB 1: PIUTANG PELANGGAN */}
      {activeTab === 'receivables' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Nomor Faktur & Tanggal</th>
                  <th className="px-5 py-3.5">Pelanggan</th>
                  <th className="px-5 py-3.5">Total Tagihan</th>
                  <th className="px-5 py-3.5">Telah Dibayar</th>
                  <th className="px-5 py-3.5">Sisa Piutang</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingInvoices ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                      Memuat data faktur piutang...
                    </td>
                  </tr>
                ) : invoices && invoices.length > 0 ? (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{inv.invoice_number}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(inv.invoice_date).toLocaleDateString('id-ID')}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-800">
                        {inv.customer_name}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {formatRupiah(inv.total_amount)}
                      </td>
                      <td className="px-5 py-4 text-xs text-emerald-700 font-semibold">
                        {formatRupiah(inv.paid_amount)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-black text-amber-700">
                          {formatRupiah(inv.remaining_unpaid)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {inv.status === 'paid' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                            Lunas
                          </span>
                        ) : inv.status === 'partially_paid' ? (
                          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 font-bold border border-blue-200">
                            Sebagian
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-800 font-bold border border-red-200">
                            Belum Dibayar
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {inv.status !== 'paid' && (
                          <button
                            onClick={() => {
                              const unpaid = typeof inv.remaining_unpaid === 'string' ? parseFloat(inv.remaining_unpaid) : inv.remaining_unpaid || 0;
                              setPayInvoiceModal(inv);
                              setCustPaymentForm({
                                payment_date: new Date().toISOString().split('T')[0],
                                payment_method: 'cash',
                                cash_account_id: cashAccounts?.[0]?.id || '',
                                amount: unpaid,
                                notes: `Pelunasan faktur ${inv.invoice_number}`,
                              });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm"
                          >
                            Terima Bayar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                      Belum ada faktur piutang pelanggan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: UTANG PEMASOK */}
      {activeTab === 'payables' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Nomor Tagihan & Tanggal</th>
                  <th className="px-5 py-3.5">Pemasok</th>
                  <th className="px-5 py-3.5">Total Tagihan</th>
                  <th className="px-5 py-3.5">Telah Dibayar</th>
                  <th className="px-5 py-3.5">Sisa Utang</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingBills ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                      Memuat data tagihan pemasok...
                    </td>
                  </tr>
                ) : bills && bills.length > 0 ? (
                  bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{bill.bill_number}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(bill.bill_date).toLocaleDateString('id-ID')}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-800">
                        {bill.supplier_name}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {formatRupiah(bill.total_amount)}
                      </td>
                      <td className="px-5 py-4 text-xs text-emerald-700 font-semibold">
                        {formatRupiah(bill.paid_amount)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-black text-red-700">
                          {formatRupiah(bill.remaining_unpaid)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {bill.status === 'paid' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                            Lunas
                          </span>
                        ) : bill.status === 'partially_paid' ? (
                          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 font-bold border border-blue-200">
                            Sebagian
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-800 font-bold border border-red-200">
                            Belum Dibayar
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {bill.status !== 'paid' && (
                          <button
                            onClick={() => {
                              const unpaid = typeof bill.remaining_unpaid === 'string' ? parseFloat(bill.remaining_unpaid) : bill.remaining_unpaid || 0;
                              setPayBillModal(bill);
                              setSuppPaymentForm({
                                payment_date: new Date().toISOString().split('T')[0],
                                payment_method: 'cash',
                                cash_account_id: cashAccounts?.[0]?.id || '',
                                amount: unpaid,
                                notes: `Pembayaran tagihan ${bill.bill_number}`,
                              });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm"
                          >
                            Bayar Tagihan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                      Belum ada tagihan utang pemasok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BEBAN OPERASIONAL */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Nomor & Tanggal</th>
                  <th className="px-5 py-3.5">Kategori</th>
                  <th className="px-5 py-3.5">Jumlah Biaya</th>
                  <th className="px-5 py-3.5">Sumber Kas</th>
                  <th className="px-5 py-3.5">Penerima</th>
                  <th className="px-5 py-3.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingExpenses ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      Memuat pengeluaran operasional...
                    </td>
                  </tr>
                ) : expenses && expenses.length > 0 ? (
                  expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{exp.expense_number}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(exp.expense_date).toLocaleDateString('id-ID')}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-semibold capitalize">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-black text-red-600">
                        {formatRupiah(exp.amount)}
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-700">
                        {exp.cash_account_name || 'Kas Utama'}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-700">
                        {exp.recipient || '-'}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {exp.notes || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      Belum ada beban operasional tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: REKENING KAS & MUTASI */}
      {activeTab === 'cash' && (
        <div className="space-y-6">
          {/* Cash Accounts Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cashAccounts?.map((ca) => (
              <div key={ca.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {ca.account_type === 'cash' ? 'Kas Tunai' : 'Rekening Bank'}
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <h3 className="text-base font-bold text-slate-900">{ca.name}</h3>
                <div className="mt-3 text-2xl font-black text-slate-900">
                  {formatRupiah(ca.current_balance)}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Saldo awal: {formatRupiah(ca.initial_balance)}
                </div>
              </div>
            ))}
          </div>

          {/* Mutasi Kas Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-slate-900 text-sm">
              Buku Mutasi Kas Masuk & Keluar
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-5 py-3.5">Tanggal</th>
                    <th className="px-5 py-3.5">Akun Kas</th>
                    <th className="px-5 py-3.5">Jenis</th>
                    <th className="px-5 py-3.5 text-right">Nominal</th>
                    <th className="px-5 py-3.5 text-right">Saldo Sesudah</th>
                    <th className="px-5 py-3.5">Deskripsi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingTransactions ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        Memuat riwayat transaksi kas...
                      </td>
                    </tr>
                  ) : transactions && transactions.length > 0 ? (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 text-xs font-semibold text-slate-700">
                          {new Date(tx.transaction_date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-slate-800">
                          {tx.cash_account_name}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold ${
                              tx.transaction_type === 'in'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                            }`}
                          >
                            {tx.transaction_type === 'in' ? 'KAS MASUK' : 'KAS KELUAR'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-black text-sm">
                          <span
                            className={tx.transaction_type === 'in' ? 'text-emerald-600' : 'text-red-600'}
                          >
                            {tx.transaction_type === 'in' ? '+' : '-'}{formatRupiah(tx.amount)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-xs font-bold text-slate-800">
                          {formatRupiah(tx.balance_after)}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {tx.description}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        Belum ada mutasi arus kas tercatat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Terima Pembayaran Piutang */}
      {payInvoiceModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Penerimaan Pembayaran Piutang</h2>
            <p className="text-xs text-slate-500 mb-4">
              Faktur: {payInvoiceModal.invoice_number} | Pelanggan: {payInvoiceModal.customer_name}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                custPaymentMutation.mutate({
                  customer_id: payInvoiceModal.customer_id,
                  payment_date: custPaymentForm.payment_date,
                  payment_method: custPaymentForm.payment_method,
                  cash_account_id: custPaymentForm.cash_account_id,
                  amount: custPaymentForm.amount,
                  notes: custPaymentForm.notes,
                  allocations: [
                    {
                      invoice_id: payInvoiceModal.id,
                      amount: custPaymentForm.amount,
                    },
                  ],
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nominal Diterima
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={custPaymentForm.amount}
                  onChange={(e) =>
                    setCustPaymentForm({ ...custPaymentForm, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Masuk ke Rekening / Kas
                </label>
                <select
                  required
                  value={custPaymentForm.cash_account_id}
                  onChange={(e) =>
                    setCustPaymentForm({ ...custPaymentForm, cash_account_id: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                >
                  <option value="">-- Pilih Akun Kas --</option>
                  {cashAccounts?.map((ca) => (
                    <option key={ca.id} value={ca.id}>
                      {ca.name} (Saldo: {formatRupiah(ca.current_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPayInvoiceModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={custPaymentMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl disabled:opacity-50"
                >
                  {custPaymentMutation.isPending ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Bayar Utang Pemasok */}
      {payBillModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Pembayaran Tagihan Pemasok</h2>
            <p className="text-xs text-slate-500 mb-4">
              Tagihan: {payBillModal.bill_number} | Pemasok: {payBillModal.supplier_name}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                suppPaymentMutation.mutate({
                  supplier_id: payBillModal.supplier_id,
                  payment_date: suppPaymentForm.payment_date,
                  payment_method: suppPaymentForm.payment_method,
                  cash_account_id: suppPaymentForm.cash_account_id,
                  amount: suppPaymentForm.amount,
                  notes: suppPaymentForm.notes,
                  allocations: [
                    {
                      invoice_id: payBillModal.id, // mapped to bill_id
                      amount: suppPaymentForm.amount,
                    },
                  ],
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nominal Pembayaran
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={suppPaymentForm.amount}
                  onChange={(e) =>
                    setSuppPaymentForm({ ...suppPaymentForm, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none font-bold text-red-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Potong dari Rekening / Kas
                </label>
                <select
                  required
                  value={suppPaymentForm.cash_account_id}
                  onChange={(e) =>
                    setSuppPaymentForm({ ...suppPaymentForm, cash_account_id: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                >
                  <option value="">-- Pilih Akun Kas --</option>
                  {cashAccounts?.map((ca) => (
                    <option key={ca.id} value={ca.id}>
                      {ca.name} (Tersedia: {formatRupiah(ca.current_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPayBillModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={suppPaymentMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl disabled:opacity-50"
                >
                  {suppPaymentMutation.isPending ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Pengeluaran Operasional */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Catat Beban Operasional</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                expenseMutation.mutate(expenseForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseForm.expense_date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kategori
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  >
                    <option value="electricity">Listrik Kandang</option>
                    <option value="labor">Upah Tenaga Kerja</option>
                    <option value="maintenance">Perawatan Kandang</option>
                    <option value="bedding">Sekam / Alas Kandang</option>
                    <option value="packaging">Pengemasan / Tray</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nominal Beban (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none font-bold text-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dibayar dari Kas / Bank
                </label>
                <select
                  required
                  value={expenseForm.cash_account_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, cash_account_id: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                >
                  <option value="">-- Pilih Akun Kas --</option>
                  {cashAccounts?.map((ca) => (
                    <option key={ca.id} value={ca.id}>
                      {ca.name} (Tersedia: {formatRupiah(ca.current_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Penerima Pembayaran
                </label>
                <input
                  type="text"
                  placeholder="misal: Pak Ujang (Tukang Sekam)"
                  value={expenseForm.recipient}
                  onChange={(e) => setExpenseForm({ ...expenseForm, recipient: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Keterangan
                </label>
                <input
                  type="text"
                  placeholder="Keterangan pengeluaran..."
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={expenseMutation.isPending}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl disabled:opacity-50"
                >
                  {expenseMutation.isPending ? 'Menyimpan...' : 'Simpan Biaya'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
