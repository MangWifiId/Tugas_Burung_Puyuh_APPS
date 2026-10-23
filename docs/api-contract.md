# Kontrak API (API Contract) - Sistem Manajemen Peternakan Puyuh

Dokumen ini mendefinisikan standar komunikasi REST API JSON antara frontend (React) dan backend (Go Gin).

---

## 1. Konvensi Umum

- **Base URL**: `/api/v1`
- **Format Payload**: `application/json`
- **Zona Waktu**: Format ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`) untuk timestamp, dan format `YYYY-MM-DD` untuk tanggal operasional.
- **Header Autentikasi**:
  ```http
  Authorization: Bearer <jwt_access_token>
  ```

---

## 2. Struktur Respon Standar (Envelope)

### Respon Sukses (Standard Success Response)
```json
{
  "success": true,
  "message": "Operasi berhasil",
  "data": { ... }
}
```

### Respon Sukses dengan Paginasi (Paginated Response)
```json
{
  "success": true,
  "message": "Data berhasil dimuat",
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total_records": 125,
    "total_pages": 7
  }
}
```

### Respon Error (Standard Error Response)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data input tidak valid",
    "details": [
      {
        "field": "quantity",
        "message": "Jumlah tidak boleh bernilai negatif"
      }
    ]
  }
}
```

---

## 3. Daftar Kode Status & Error Terstandar

| HTTP Code | Kode Error Internal | Keterangan |
| :--- | :--- | :--- |
| `200 OK` | - | Permintaan berhasil diproses. |
| `201 Created` | - | Entitas baru berhasil dibuat. |
| `400 Bad Request` | `VALIDATION_ERROR` / `BAD_REQUEST` | Format input salah atau melanggar aturan bisnis. |
| `401 Unauthorized`| `UNAUTHORIZED` | Token JWT tidak ada, tidak valid, atau telah kedaluwarsa. |
| `403 Forbidden`   | `FORBIDDEN` | Pengguna tidak memiliki hak akses yang mencukupi. |
| `404 Not Found`   | `NOT_FOUND` | Sumber daya data tidak ditemukan. |
| `409 Conflict`    | `CONFLICT` | Pelanggaran constraint unik (misal: nomor faktur duplikat). |
| `422 Unprocessable`| `BUSINESS_RULE_VIOLATION` | Melanggar aturan (misal: stok tidak mencukupi untuk dikirim). |
| `500 Server Error`| `INTERNAL_SERVER_ERROR` | Kesalahan sistem atau database backend tak terduga. |

---

## 4. Rincian Endpoint API per Modul

### 4.1 Autentikasi & Profil Pengguna (`/api/v1/auth`)
- `POST /api/v1/auth/register` - Registrasi akun awal owner peternakan.
- `POST /api/v1/auth/login` - Otentikasi email & password, mengembalikan JWT token.
- `GET  /api/v1/auth/me` - Mendapatkan profil pengguna yang sedang login.
- `POST /api/v1/auth/logout` - Invalidate session / token.

### 4.2 Peternakan & Kandang (`/api/v1/farms`, `/api/v1/coops`)
- `GET  /api/v1/farms` - Menampilkan data peternakan aktif.
- `PUT  /api/v1/farms/:id` - Memperbarui profil peternakan.
- `GET  /api/v1/coops` - Daftar kandang.
- `POST /api/v1/coops` - Tambah kandang baru.
- `GET  /api/v1/coops/:id` - Detail kandang (kapasitas, status, populasi saat ini).
- `PUT  /api/v1/coops/:id` - Edit kandang.
- `DELETE /api/v1/coops/:id` - Nonaktifkan kandang.

### 4.3 Master Data (`/api/v1/products`, `/api/v1/units`, `/api/v1/contacts`)
- `GET  /api/v1/units` - Daftar satuan barang.
- `POST /api/v1/units` - Tambah satuan baru.
- `GET  /api/v1/products` - Daftar produk/barang dengan filter kategori (`egg`, `feed`, `medicine`, dll).
- `POST /api/v1/products` - Tambah produk baru beserta satuan default & stok minimum.
- `PUT  /api/v1/products/:id` - Edit data produk.
- `GET  /api/v1/customers` & `POST /api/v1/customers` - Manajemen data pelanggan.
- `GET  /api/v1/suppliers` & `POST /api/v1/suppliers` - Manajemen data pemasok.

### 4.4 Populasi & Pemeliharaan Puyuh (`/api/v1/flocks`)
- `GET  /api/v1/flocks` - Daftar batch/flock puyuh aktif & riwayat.
- `POST /api/v1/flocks` - Input kelompok puyuh baru masuk kandang.
- `GET  /api/v1/flocks/:id` - Detail kelompok puyuh, alokasi kandang, dan riwayat mutasi.
- `POST /api/v1/flocks/:id/movements` - Catat mortalitas, afkir, atau mutasi antar kandang.
- `GET  /api/v1/flocks/:id/movements` - Riwayat pergerakan populasi flock.

### 4.5 Produksi Telur (`/api/v1/production`)
- `GET  /api/v1/production` - Riwayat pencatatan produksi telur harian (filter tanggal, kandang).
- `POST /api/v1/production` - Catat hasil panen telur harian (total telur, telur rusak/pecah).
- `GET  /api/v1/production/:id` - Detail catatan produksi.
- `PUT  /api/v1/production/:id` - Koreksi catatan produksi harian.

### 4.6 Persediaan & Pemakaian Pakan (`/api/v1/inventory`)
- `GET  /api/v1/inventory/summary` - Ringkasan saldo stok saat ini untuk seluruh produk.
- `GET  /api/v1/inventory/movements` - Riwayat mutasi stok (kartu stok).
- `POST /api/v1/inventory/feed-usage` - Catat pemakaian harian pakan/obat per kandang/flock.
- `GET  /api/v1/inventory/adjustments` - Daftar dokumen penyesuaian stok.
- `POST /api/v1/inventory/adjustments` - Buat penyesuaian stok (stock opname) dengan audit alasan.

### 4.7 Manajemen Harga (`/api/v1/prices`)
- `GET  /api/v1/prices` - Daftar harga aktif per produk & satuan.
- `POST /api/v1/prices` - Buat penetapan harga baru beserta tanggal berlaku (`valid_from`).
- `GET  /api/v1/prices/history/:productId` - Riwayat perubahan harga produk dari waktu ke waktu.

### 4.8 Penjualan Telur (`/api/v1/sales`)
- `GET  /api/v1/sales` - Daftar transaksi penjualan (filter status: draft/posted).
- `POST /api/v1/sales` - Buat order penjualan (status draft).
- `GET  /api/v1/sales/:id` - Detail penjualan beserta snapshot harga, diskon, dan ongkir.
- `PUT  /api/v1/sales/:id` - Update penjualan (hanya jika draft).
- `POST /api/v1/sales/:id/post` - Sahkan penjualan (atomik: kurangi stok telur layak jual & buat tagihan invoice).
- `POST /api/v1/sales/:id/cancel` - Batalkan penjualan jika belum ada pembayaran dialokasikan.

### 4.9 Pembelian Pakan & Kebutuhan (`/api/v1/purchases`)
- `GET  /api/v1/purchases` - Daftar pembelian pemasok.
- `POST /api/v1/purchases` - Buat dokumen pembelian baru (draft).
- `GET  /api/v1/purchases/:id` - Detail transaksi pembelian.
- `POST /api/v1/purchases/:id/post` - Sahkan pembelian (atomik: tambah stok barang & buat tagihan supplier).

### 4.10 Koreksi Transaksi (`/api/v1/credit-debit-notes`)
- `POST /api/v1/credit-debit-notes` - Buat nota kredit (pengurangan tagihan) atau nota debit terkait transaksi penjualan/pembelian sebelumnya.

### 4.11 Keuangan, Tagihan & Pembayaran (`/api/v1/finance`)
- `GET  /api/v1/invoices` - Daftar faktur pelanggan (filter status: unpaid, partially_paid, paid).
- `POST /api/v1/customer-payments` - Catat pembayaran dari pelanggan dan alokasikan ke faktur.
- `GET  /api/v1/supplier-bills` - Daftar tagihan dari pemasok.
- `POST /api/v1/supplier-payments` - Catat pembayaran ke pemasok dan alokasikan ke tagihan.
- `GET  /api/v1/cash-accounts` - Daftar rekening/kas kandang beserta saldo saat ini.
- `GET  /api/v1/expenses` & `POST /api/v1/expenses` - Pencatatan beban pengeluaran operasional.
- `GET  /api/v1/cash-transactions` - Buku mutasi kas masuk dan keluar.

### 4.12 Dashboard & Laporan Terpadu (`/api/v1/reports`, `/api/v1/dashboard`)
- `GET  /api/v1/dashboard/summary` - KPI ringkas: populasi aktif, produksi telur hari ini, stok telur & pakan, total piutang/utang jatuh tempo.
- `GET  /api/v1/reports/production-trends` - Data tren produksi telur per hari/minggu/bulan untuk grafik Recharts.
- `GET  /api/v1/reports/cash-flow` - Laporan arus kas masuk vs kas keluar per periode.
- `GET  /api/v1/reports/inventory-movements` - Laporan pergerakan stok (ekspor siap CSV/Excel).
