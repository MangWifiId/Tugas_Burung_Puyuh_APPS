# Sistem Manajemen Peternakan Puyuh

Panduan awal untuk merancang dan mengembangkan aplikasi web manajemen
peternakan puyuh. Dokumen ini menjadi acuan fitur, arsitektur, aturan
bisnis, dan tahapan pengerjaan sebelum mulai menulis kode.

> **Status proyek:** tahap perencanaan. Struktur dan keputusan teknis
> dapat diperbarui ketika kebutuhan bisnis sudah dikonfirmasi.

## 1. Tujuan Aplikasi

Aplikasi ini ditujukan untuk membantu pemilik peternakan mengelola
operasional harian dan keuangan dalam satu sistem, dengan data tersimpan
di database online.

Tujuan utama:

-   Mencatat populasi puyuh dan perubahan jumlahnya.
-   Mencatat produksi, telur rusak, stok telur layak jual, dan
    pengiriman.
-   Mengelola pakan, obat, dan persediaan lainnya.
-   Mencatat pembelian, penjualan, pelanggan, dan pemasok.
-   Mengelola harga, diskon, biaya tambahan, serta koreksi transaksi.
-   Mengelola piutang, utang, pembayaran, pengeluaran, dan arus kas.
-   Menyediakan dashboard dan laporan yang konsisten.
-   Menyimpan riwayat perubahan agar transaksi lama tetap dapat
    ditelusuri.

## 2. Pengguna dan Cakupan

### Pengguna awal

Versi pertama dirancang untuk **pemilik peternakan**. Walaupun hanya
satu pengguna di awal, autentikasi, otorisasi, dan audit log tetap
dirancang agar sistem dapat dikembangkan menjadi multi-pengguna.

### Keputusan yang masih perlu dikonfirmasi

-   Apakah aplikasi hanya mengelola satu peternakan atau beberapa
    peternakan.
-   Apakah pencatatan akuntansi cukup berupa laporan operasional dan
    arus kas, atau membutuhkan jurnal akuntansi formal.
-   Apakah pesanan telur perlu reservasi stok sebelum dikirim.
-   Apakah pengiriman dan penagihan dapat dilakukan sebagian.
-   Satuan resmi yang digunakan, misalnya butir, rak/tray, karung, kg,
    botol, dan liter.

## 3. Teknologi yang Direncanakan

  Bagian             Teknologi                Peran
  ------------------ ------------------------ ------------------------------------------
  Frontend           React + TypeScript       Antarmuka pengguna
  Build frontend     Vite                     Menjalankan dan membangun aplikasi React
  Routing frontend   React Router             Navigasi halaman
  Pengambilan data   TanStack Query           Mengelola request API dan cache
  UI dan styling     Tailwind CSS             Tampilan responsif
  Grafik             Recharts                 Grafik dashboard dan laporan
  Backend            Go                       Logika aplikasi dan API
  Web framework      Gin                      Routing dan HTTP handler
  ORM                GORM                     Interaksi database dari Go
  Database           PostgreSQL online        Penyimpanan data utama
  API                REST API berbasis JSON   Komunikasi frontend dan backend
  Version control    Git                      Riwayat perubahan kode

**Aturan keamanan:** frontend tidak boleh terhubung langsung ke
PostgreSQL. Seluruh akses database dilakukan melalui backend. Kredensial
database disimpan di environment backend dan tidak boleh dimasukkan ke
kode frontend atau repository.

## 4. Arsitektur Aplikasi

Frontend dan backend dapat di-deploy terpisah, tetapi tetap menjadi satu
aplikasi yang saling terhubung melalui REST API.

``` text
Pemilik Peternakan
        |
        v
Frontend React + TypeScript
        |
        | HTTPS / REST API (JSON)
        v
Backend Go + Gin
        |
        v
Service / aturan bisnis
        |
        v
Repository / GORM
        |
        v
PostgreSQL online
```

Backend menggunakan pendekatan **modular monolith**, bukan
microservices. Setiap domain bisnis memiliki modul tersendiri, tetapi
tetap berjalan dalam satu aplikasi backend. Pendekatan ini lebih
sederhana untuk tahap awal dan dapat dipisahkan lebih jauh jika memang
dibutuhkan.

### Lapisan backend

-   **Routes:** mendefinisikan endpoint API.
-   **Handlers:** menerima HTTP request dan membentuk HTTP response.
-   **Services:** menjalankan aturan bisnis dan validasi proses.
-   **Repositories:** mengakses database.
-   **Models:** struktur data yang dipetakan ke database.
-   **Migrations:** perubahan skema database secara terkontrol.

Aturan bisnis penting harus berada di service/backend, bukan hanya di
frontend.

## 5. Modul Fungsional

### 5.1 Dashboard

Menampilkan ringkasan seperti:

-   Populasi aktif.
-   Produksi telur hari ini dan tren produksi.
-   Telur rusak dan stok telur layak jual.
-   Stok pakan dan perkiraan kebutuhan.
-   Penjualan, pembelian, pengeluaran, dan arus kas.
-   Piutang pelanggan dan utang pemasok.
-   Peringatan stok rendah atau tagihan jatuh tempo.

Angka pada dashboard harus berasal dari data transaksi yang tercatat,
bukan angka yang dimasukkan ulang secara manual.

### 5.2 Populasi dan Pemeliharaan

Fitur:

-   Mencatat kelompok/batch puyuh.
-   Mencatat tanggal masuk, jumlah awal, dan status kelompok.
-   Mengelola kandang dan kapasitasnya.
-   Mencatat kematian, afkir, penambahan, serta perpindahan kandang.
-   Melihat riwayat populasi berdasarkan tanggal.

Aturan penting:

-   Perpindahan antar-kandang tidak mengubah total populasi peternakan.
-   Kematian dan afkir mengurangi populasi.
-   Setiap perubahan populasi harus memiliki tanggal, jumlah, kategori,
    dan alasan.
-   Jangan menimpa jumlah awal; gunakan catatan pergerakan populasi.

### 5.3 Produksi Telur

Fitur:

-   Mencatat jumlah telur yang dihasilkan.
-   Mencatat telur rusak, pecah, atau tidak layak jual.
-   Menghitung jumlah telur layak jual.
-   Mencatat telur yang dikirim, dikembalikan, atau disesuaikan.
-   Melihat tren produksi per hari, periode, kelompok, atau kandang jika
    data tersedia.

Rumus dasar:

`Telur layak jual = telur diproduksi - telur rusak/tidak layak jual`

Produksi telur tidak sama dengan penjualan. Telur yang diproduksi
menambah stok layak jual; telur yang benar-benar dikirim mengurangi
stok.

### 5.4 Pakan dan Persediaan

Fitur:

-   Master barang dan satuan.
-   Penerimaan pakan, obat, dan perlengkapan.
-   Pemakaian pakan dan obat.
-   Stok minimum dan peringatan stok rendah.
-   Penyesuaian stok dengan alasan.
-   Riwayat pergerakan stok.

Aturan penting:

-   `inventory_movements` menjadi catatan resmi pergerakan stok.
-   Pembelian yang masih draft tidak menambah stok.
-   Stok bertambah ketika barang benar-benar diterima dan transaksi
    penerimaan disahkan.
-   Pemakaian pakan mengurangi stok dan mencatat biaya pemakaian.
-   Koreksi stok harus mencatat jumlah sebelum/sesudah atau perubahan
    kuantitas, alasan, waktu, dan pengguna.
-   Jangan mengubah stok secara diam-diam dengan mengganti angka saldo
    saja.

### 5.5 Pembelian dan Pemasok

Fitur:

-   Data pemasok.
-   Dokumen pembelian dan detail barang.
-   Penerimaan barang, termasuk penerimaan sebagian jika diperlukan.
-   Tagihan pemasok.
-   Pembayaran penuh atau sebagian.
-   Saldo utang dan riwayat pembayaran.

Pembelian barang, penerimaan barang, tagihan, dan pembayaran adalah
kejadian yang berbeda. Dalam kasus sederhana, beberapa kejadian dapat
disahkan bersamaan, tetapi model data tetap perlu membedakan dampaknya.

### 5.6 Penjualan dan Pelanggan

Fitur:

-   Data pelanggan.
-   Penjualan telur atau barang lain.
-   Harga per unit, jumlah, diskon, dan biaya tambahan.
-   Pengiriman barang.
-   Faktur/tagihan pelanggan.
-   Pembayaran penuh atau sebagian.
-   Saldo piutang dan riwayat transaksi.

Aturan penting:

-   Penjualan yang masih draft tidak mengurangi stok.
-   Stok telur berkurang berdasarkan jumlah yang benar-benar dikirim,
    bukan hanya jumlah yang dipesan.
-   Harga transaksi disimpan pada detail transaksi agar perubahan harga
    baru tidak mengubah transaksi lama.
-   Status pembayaran ditentukan dari nilai tagihan, nota koreksi, dan
    pembayaran yang dialokasikan.

### 5.7 Manajemen Harga dan Penyesuaian

Modul ini harus mendukung seluruh kebutuhan berikut.

#### Riwayat harga

-   Harga jual dan harga beli.
-   Harga menurut barang dan satuan.
-   Harga khusus pelanggan atau pemasok jika dibutuhkan.
-   Tanggal mulai berlaku dan tanggal akhir berlaku.
-   Nilai sebelum/sesudah dan alasan perubahan.
-   Pengguna dan waktu perubahan.

#### Diskon

-   Nominal per unit.
-   Persentase per unit/baris.
-   Diskon total dokumen.
-   Alasan diskon dan pihak yang memberi persetujuan bila diperlukan.

#### Tambahan biaya

-   Tambahan nominal per unit.
-   Tambahan biaya total dokumen.
-   Contoh: ongkos pengiriman, pengemasan, atau bongkar muat.
-   Penentuan apakah biaya masuk ke tagihan pelanggan, biaya usaha, atau
    biaya perolehan persediaan.

#### Koreksi transaksi

-   Koreksi kesalahan harga atau jumlah.
-   Nota kredit untuk mengurangi nilai tagihan.
-   Nota debit untuk menambah nilai tagihan.
-   Retur barang dan barang rusak.
-   Koreksi setelah pembayaran sebagian atau lunas.

Aturan wajib:

1.  Harga baru hanya berlaku sesuai tanggal dan ruang lingkup yang
    ditetapkan.
2.  Harga pada detail transaksi merupakan snapshot harga saat transaksi
    dibuat/disahkan.
3.  Transaksi yang sudah disahkan tidak boleh diubah atau dihapus tanpa
    jejak.
4.  Koreksi transaksi yang sudah disahkan harus merujuk ke transaksi
    asal.
5.  Koreksi nilai tidak otomatis mengubah kuantitas stok.
6.  Perubahan stok hanya dilakukan jika benar-benar ada penerimaan,
    pengiriman, retur, kerusakan, atau penyesuaian stok.
7.  Koreksi piutang/utang tidak otomatis berarti ada arus kas.
8.  Jika uang benar-benar dikembalikan atau dibayar tambahan, catat
    transaksi pembayaran/pengembalian uang tersendiri.
9.  Hindari menerapkan diskon atau biaya yang sama dua kali.
10. Periode keuangan yang ditutup tidak boleh diubah tanpa proses khusus
    yang tercatat.

Contoh perhitungan:

-   100 rak telur × Rp52.000 = Rp5.200.000.
-   Tambahan ongkos pengiriman = Rp50.000.
-   Diskon total = Rp100.000.
-   Total tagihan = Rp5.150.000.

Jika pelanggan membayar Rp3.000.000, piutang tersisa Rp2.150.000. Stok
berkurang sesuai jumlah yang benar-benar dikirim, bukan berdasarkan
nilai diskon atau ongkos kirim.

### 5.8 Keuangan

Fitur:

-   Penerimaan dan pengeluaran kas.
-   Pembayaran pelanggan dan pemasok.
-   Piutang dan utang.
-   Kategori biaya.
-   Ringkasan arus kas.
-   Laporan pendapatan dan biaya.
-   Rekonsiliasi transaksi.

Perbedaan yang harus dipertahankan:

-   **Penjualan/pendapatan** tidak selalu sama dengan kas masuk.
-   **Pembelian** tidak selalu sama dengan kas keluar pada hari yang
    sama.
-   **Piutang** adalah tagihan yang belum dibayar pelanggan.
-   **Utang** adalah kewajiban yang belum dibayar ke pemasok.
-   **Laba** tidak sama dengan saldo kas.
-   **Pemakaian pakan** mengakui biaya pemakaian; pembelian pakan
    menambah persediaan terlebih dahulu.

Jika aplikasi nantinya harus menghasilkan laporan akuntansi formal,
diperlukan kebijakan pengakuan pendapatan, biaya, persediaan, aset, dan
jurnal yang lebih lengkap.

### 5.9 Laporan

Laporan yang direncanakan:

-   Riwayat populasi dan kematian.
-   Produksi telur dan telur rusak.
-   Stok barang dan riwayat pergerakan.
-   Pemakaian pakan.
-   Penjualan berdasarkan pelanggan/periode.
-   Pembelian berdasarkan pemasok/periode.
-   Riwayat harga.
-   Diskon, biaya tambahan, dan koreksi transaksi.
-   Piutang, utang, dan pembayaran.
-   Arus kas dan ringkasan pendapatan/biaya.

## 6. Rancangan Data Konseptual

Nama tabel di bawah merupakan rancangan awal dan masih dapat disesuaikan
ketika ERD dibuat.

### Master data

-   `users`
-   `farms`
-   `coops`
-   `products`
-   `units`
-   `product_unit_conversions`
-   `customers`
-   `suppliers`
-   `price_lists`
-   `product_prices`

### Populasi dan produksi

-   `flocks`
-   `flock_movements`
-   `flock_placements`
-   `production_records`
-   `egg_quality_records`

### Persediaan

-   `inventory_items` atau penggunaan langsung master `products`
-   `inventory_movements`
-   `stock_adjustments`
-   `goods_receipts`
-   `goods_receipt_items`

Hindari menduplikasi master barang di `inventory_items` jika fungsinya
sama dengan `products`. Putuskan apakah stok dikelola untuk semua produk
atau hanya kategori barang tertentu.

### Pembelian dan penjualan

-   `purchases`
-   `purchase_items`
-   `sales`
-   `sale_items`
-   `sale_adjustments`
-   `purchase_adjustments`
-   `shipments` dan `shipment_items` jika pengiriman dipisah dari
    penjualan
-   `credit_debit_notes` dan detailnya untuk koreksi transaksi

### Tagihan dan pembayaran

-   `customer_invoices`
-   `customer_payments`
-   `customer_payment_allocations`
-   `supplier_bills`
-   `supplier_payments`
-   `supplier_payment_allocations`

Tabel alokasi pembayaran diperlukan agar satu pembayaran dapat melunasi
beberapa tagihan dan satu tagihan dapat dibayar beberapa kali.

### Keuangan dan audit

-   `expenses`
-   `cash_accounts`
-   `cash_transactions`
-   `audit_logs`

Jika menggunakan jurnal akuntansi formal, tambahkan `journal_entries`
dan `journal_entry_lines` dengan aturan posting yang terdefinisi. Jangan
mencatat transaksi yang sama dua kali dalam laporan keuangan.

## 7. Aturan Data dan Transaksi

### Status dokumen

Status yang dapat dipertimbangkan:

-   `draft`: masih dapat diedit dan belum memengaruhi saldo resmi.
-   `posted`: sudah disahkan dan memengaruhi modul terkait.
-   `partially_paid`: tagihan dibayar sebagian, atau dihitung dari saldo
    tagihan.
-   `paid`: tagihan telah lunas.
-   `cancelled`: dibatalkan sesuai aturan dan jejaknya tetap disimpan.

Status pembayaran idealnya dihitung dari nilai tagihan setelah koreksi
dan total pembayaran yang dialokasikan. Jangan mengandalkan pengguna
untuk mengubah status pembayaran secara manual.

### Transaksi atomik

Ketika satu proses memengaruhi beberapa tabel, perubahan harus dilakukan
dalam satu transaksi database. Contoh: saat pengiriman disahkan, sistem
memperbarui status pengiriman dan mencatat pergerakan stok secara
konsisten. Jika salah satu bagian gagal, seluruh proses harus
dibatalkan.

### Ketepatan nilai

-   Gunakan tipe angka desimal yang tepat untuk uang, seperti `NUMERIC`
    di PostgreSQL, bukan floating point.
-   Tetapkan aturan pembulatan dan presisi.
-   Simpan mata uang jika berpotensi lebih dari satu mata uang.
-   Gunakan zona waktu dan format tanggal yang konsisten.
-   Gunakan nomor dokumen unik dan tidak mudah berubah.

### Koreksi dan audit

-   Dokumen draft dapat diedit.
-   Dokumen posted tidak dihapus diam-diam.
-   Koreksi posted dibuat sebagai dokumen baru yang merujuk ke dokumen
    asal.
-   Simpan pengguna, waktu, alasan, dan perubahan penting.
-   Pembatalan atau pembalikan harus menjaga riwayat stok dan keuangan.

## 8. Struktur Repository

Contoh struktur awal:

``` text
quail-management/
├── backend/
│   ├── cmd/
│   │   └── api/
│   ├── internal/
│   │   ├── auth/
│   │   ├── farm/
│   │   ├── flock/
│   │   ├── production/
│   │   ├── inventory/
│   │   ├── health/
│   │   ├── purchasing/
│   │   ├── sales/
│   │   ├── pricing/
│   │   ├── finance/
│   │   └── reports/
│   ├── migrations/
│   ├── go.mod
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── features/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── types/
│   ├── package.json
│   └── .env.example
├── docs/
│   ├── architecture.md
│   ├── database-design.md
│   └── api-contract.md
├── .gitignore
└── README.md
```

Struktur ini adalah titik awal. Tidak semua folder harus dibuat
sekaligus; buat modul saat mulai mengerjakannya.

## 9. Konvensi API

Gunakan prefix versi agar API dapat dikembangkan tanpa merusak frontend:

``` text
/api/v1/auth
/api/v1/farms
/api/v1/coops
/api/v1/flocks
/api/v1/production
/api/v1/products
/api/v1/prices
/api/v1/inventory
/api/v1/purchases
/api/v1/sales
/api/v1/invoices
/api/v1/payments
/api/v1/finance
/api/v1/reports
```

Konvensi yang disarankan:

-   Gunakan JSON untuk request dan response.
-   Validasi request di backend.
-   Terapkan autentikasi dan otorisasi pada endpoint yang memerlukan
    perlindungan.
-   Gunakan HTTP status code secara konsisten.
-   Format error API harus seragam.
-   Dokumentasikan request, response, validasi, dan aturan status di
    `docs/api-contract.md`.
-   Hindari mengirim informasi rahasia atau kredensial ke frontend.

## 10. Keamanan dan Operasional

-   Gunakan HTTPS pada deployment.
-   Simpan rahasia di environment variable atau secret manager.
-   Jangan commit `.env` ke Git.
-   Sediakan `.env.example` tanpa nilai rahasia.
-   Gunakan password hashing yang aman.
-   Batasi akses berdasarkan peran ketika pengguna bertambah.
-   Lakukan validasi input di backend.
-   Gunakan migrasi database yang dapat ditinjau dan dilacak.
-   Siapkan backup database otomatis dan uji proses pemulihan.
-   Catat error aplikasi tanpa menulis password, token, atau data
    rahasia ke log.
-   Siapkan ekspor data penting ke CSV/Excel bila diperlukan.
-   Pantau kesehatan backend dan koneksi database.

## 11. Tahapan Pengembangan

### Tahap 1 --- Fondasi

-   [ ] Tetapkan keputusan satu atau beberapa peternakan.
-   [ ] Buat ERD dan kamus data.
-   [ ] Buat repository Git dan struktur backend/frontend.
-   [ ] Siapkan PostgreSQL dan sistem migrasi.
-   [ ] Implementasikan autentikasi.
-   [ ] Tetapkan format respons API dan error.
-   [ ] Buat master barang, satuan, pelanggan, pemasok, dan kandang.

### Tahap 2 --- Populasi, produksi, dan stok

-   [ ] Catatan batch dan populasi.
-   [ ] Kematian, afkir, dan perpindahan kandang.
-   [ ] Catatan produksi telur dan telur rusak.
-   [ ] Pergerakan stok dan pemakaian pakan.
-   [ ] Penyesuaian stok dengan alasan.
-   [ ] Uji agar perpindahan kandang tidak mengubah populasi total.

### Tahap 3 --- Harga, penjualan, dan pembelian

-   [ ] Riwayat harga dengan tanggal berlaku.
-   [ ] Snapshot harga pada detail transaksi.
-   [ ] Diskon dan biaya tambahan.
-   [ ] Pembelian dan penerimaan barang.
-   [ ] Penjualan dan pengiriman.
-   [ ] Nota kredit/debit dan koreksi transaksi.
-   [ ] Uji koreksi agar tidak menggandakan perubahan stok atau
    keuangan.

### Tahap 4 --- Tagihan dan keuangan

-   [ ] Faktur pelanggan dan tagihan pemasok.
-   [ ] Pembayaran sebagian/penuh.
-   [ ] Alokasi pembayaran ke tagihan.
-   [ ] Pengeluaran dan arus kas.
-   [ ] Saldo piutang dan utang.
-   [ ] Tentukan kebijakan pengakuan biaya persediaan.

### Tahap 5 --- Dashboard dan laporan

-   [ ] Dashboard operasional.
-   [ ] Laporan produksi dan populasi.
-   [ ] Laporan stok dan pemakaian pakan.
-   [ ] Laporan penjualan dan pembelian.
-   [ ] Laporan harga dan koreksi.
-   [ ] Laporan keuangan dan rekonsiliasi.
-   [ ] Ekspor data dan uji backup/restore.

## 12. Kriteria Selesai untuk Fitur Transaksi

Sebuah fitur transaksi dianggap siap apabila:

-   Data wajib divalidasi.
-   Nomor dokumen unik.
-   Draft tidak memengaruhi stok atau saldo resmi.
-   Posting menghasilkan dampak stok dan keuangan yang tepat.
-   Operasi multi-tabel menggunakan transaksi database.
-   Transaksi lama mempertahankan harga dan nilai historis.
-   Koreksi meninggalkan jejak audit.
-   Pembayaran sebagian menghasilkan saldo yang benar.
-   Laporan konsisten dengan dokumen sumber.
-   Pengujian mencakup kondisi normal dan kondisi gagal.

## 13. Catatan Keputusan

Sebelum mulai implementasi penuh, putuskan dan dokumentasikan:

1.  Satu peternakan atau multi-peternakan.
2.  Satuan standar dan konversi, khususnya butir ke rak/tray.
3.  Apakah pengiriman dan penerimaan dapat dilakukan sebagian.
4.  Apakah pesanan dapat mengalokasikan stok.
5.  Metode penilaian persediaan, misalnya rata-rata tertimbang.
6.  Perlakuan diskon dan biaya pengiriman terhadap persediaan atau
    pendapatan.
7.  Batas koreksi transaksi dan periode keuangan yang ditutup.
8.  Kebutuhan laporan keuangan: arus kas operasional atau akuntansi
    formal.

------------------------------------------------------------------------

## Prinsip yang Tidak Boleh Dilanggar

1.  **Satu sumber kebenaran untuk stok:** catatan pergerakan stok.
2.  **Satu sumber kebenaran untuk pembayaran:** catatan pembayaran dan
    alokasinya.
3.  **Harga transaksi adalah snapshot:** perubahan harga baru tidak
    mengubah dokumen lama.
4.  **Tidak menghapus riwayat transaksi posted:** koreksi melalui
    dokumen yang terlacak.
5.  **Nilai uang menggunakan tipe desimal:** hindari floating point
    untuk perhitungan uang.
6.  **Backend memegang aturan bisnis dan akses database:** frontend
    hanya berkomunikasi melalui API.
7.  **Laporan harus dapat ditelusuri:** angka ringkasan dapat ditelusuri
    ke transaksi sumber.

Dokumen ini adalah panduan awal proyek. Sebelum implementasi, langkah
berikut yang disarankan adalah membuat ERD/database design yang lebih
rinci berdasarkan keputusan bisnis yang belum dikonfirmasi.
