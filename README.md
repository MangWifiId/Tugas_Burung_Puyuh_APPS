# Web Manajemen Usaha Telur Burung Puyuh

## 1. Deskripsi Proyek

Web Manajemen Usaha Telur Burung Puyuh adalah aplikasi berbasis web yang
digunakan untuk membantu pemilik usaha peternakan puyuh dalam melakukan
pencatatan, pemantauan, dan analisis kondisi usaha.

Aplikasi berfokus pada: - Produksi telur. - Penjualan telur ke PT. -
Pencatatan pakan dan perubahan harga pakan. - Manajemen populasi
burung. - Pencatatan kematian. - Kalender kegiatan kandang. - Warning
atau peringatan otomatis. - Dashboard dan grafik perkembangan usaha.

Aplikasi ini ditujukan untuk monitoring dan pencatatan usaha, bukan
marketplace, toko online, atau aplikasi kasir.

## 2. Tujuan Proyek

1.  Mempermudah pencatatan kegiatan operasional peternakan.
2.  Memantau produksi telur setiap hari.
3.  Menyimpan riwayat pengambilan dan penjualan telur kepada PT.
4.  Memantau jumlah populasi burung yang masih hidup.
5.  Mengetahui perkembangan jumlah kematian burung.
6.  Menyimpan riwayat penerimaan pakan dan perubahan harga pakan.
7.  Mengetahui umur burung puyuh secara otomatis.
8.  Mengingatkan pemilik usaha terhadap kegiatan penting.
9.  Memberikan warning jika kondisi usaha mulai mengkhawatirkan.
10. Menampilkan grafik untuk membantu analisis perkembangan usaha.

## 3. Teknologi

### Backend

-   **Go** --- bahasa pemrograman backend.
-   **Gin** --- framework untuk membangun HTTP server dan REST API.
-   **GORM** --- ORM untuk berinteraksi dengan database.
-   **PostgreSQL** --- database utama untuk production.
-   **Neon** --- layanan PostgreSQL cloud yang dapat digunakan sebagai
    database online.
-   **SQLite** --- database pengembangan lokal agar aplikasi dapat
    dijalankan tanpa server database.
-   **REST API** --- komunikasi data antara frontend dan backend.

### Frontend

-   **React** --- membangun antarmuka aplikasi berbasis komponen.
-   **TypeScript** --- JavaScript dengan sistem tipe untuk membantu
    mengurangi kesalahan kode.
-   **Vite** --- development server dan build tool frontend.
-   **Tailwind CSS** --- styling dan layout antarmuka.
-   **Recharts** --- membuat grafik produksi, penjualan, populasi,
    mortalitas, dan harga pakan.
-   **React Router** --- navigasi antarhalaman aplikasi.
-   **Axios** --- mengirim request HTTP dari frontend ke backend REST
    API.

### Arsitektur Aplikasi

Frontend dan backend dikembangkan sebagai dua bagian terpisah:

``` text
Browser
  |
  v
Frontend (React + TypeScript + Vite)
  |
  | HTTP request / REST API
  v
Backend (Go + Gin + GORM)
  |
  | Database connection
  v
PostgreSQL / Neon (production)  atau  SQLite (development)
```

Frontend bertanggung jawab atas tampilan, form, tabel, grafik, dan
navigasi. Backend bertanggung jawab atas validasi, aturan bisnis,
autentikasi, dan pengolahan data. Backend menjadi satu-satunya bagian
aplikasi yang berkomunikasi langsung dengan database.

Pemilihan database dilakukan otomatis: jika `DATABASE_URL` diisi maka
backend memakai PostgreSQL, jika tidak maka backend memakai SQLite lokal
(`backend/data/puyuh.db`). Perilaku ini dapat dipaksa melalui `DB_DRIVER`.

### Struktur Folder Utama

``` text
Manajemen_Puyuh/
├── backend/
│   ├── cmd/
│   │   └── api/
│   │       └── main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── database/
│   │   ├── handlers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── data/              # database SQLite lokal (tidak di-commit)
│   ├── go.mod
│   ├── .env.example
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
├── .gitignore
└── README.md
```

## 4. Ruang Lingkup Sistem

Aplikasi digunakan oleh pemilik usaha untuk melakukan monitoring dan
pencatatan peternakan.

Sistem tidak berfungsi sebagai: - Marketplace. - Toko online. - Aplikasi
kasir. - Sistem penjualan langsung kepada konsumen.

Penjualan telur hanya dicatat sebagai riwayat transaksi penjualan kepada
PT.

Perhitungan potongan harga pakan dilakukan oleh PT dan tidak dihitung
ulang oleh aplikasi.

## 5. Modul dan Fitur

### 5.1 Dashboard

Halaman utama aplikasi menampilkan: - Total produksi telur hari ini. -
Total produksi telur bulan ini. - Total penjualan telur bulan ini. -
Jumlah populasi burung. - Total kematian. - Jumlah pakan yang
diterima. - Grafik produksi telur. - Grafik penjualan telur. - Grafik
kematian. - Grafik populasi. - Grafik harga pakan. - Warning atau
peringatan aktif. - Kegiatan kalender terdekat.

Dashboard menyediakan filter berdasarkan periode tanggal.

### 5.2 Produksi Telur

Digunakan untuk mencatat jumlah telur yang dihasilkan setiap hari.

Data: - Tanggal produksi. - Jumlah telur. - Catatan tambahan.

Fitur: - Tambah catatan produksi. - Edit catatan produksi. - Lihat
riwayat produksi. - Filter berdasarkan periode. - Grafik produksi
harian, mingguan, dan bulanan.

Jumlah telur yang diproduksi tidak otomatis dianggap sama dengan jumlah
telur yang terjual.

### 5.3 Penjualan Telur ke PT

PT mengambil telur setiap Senin dan Kamis.

Data: - Tanggal pengambilan. - Jumlah telur yang diambil. - Harga jual
per satuan jika diketahui. - Total penjualan berdasarkan nota. - Nomor
nota jika tersedia. - Catatan transaksi.

Fitur: - Tambah riwayat pengambilan telur. - Edit data pengambilan. -
Lihat riwayat penjualan. - Lihat total pendapatan berdasarkan nota PT. -
Grafik jumlah telur terjual. - Grafik pendapatan penjualan. - Filter
berdasarkan periode.

#### Aturan bisnis penjualan

1.  Pengambilan telur dilakukan setiap Senin dan Kamis.
2.  Pengambilan hari Senin dicatat sebagai transaksi penjualan.
3.  Nota hasil penjualan diberikan PT pada hari Kamis.
4.  Nota hari Kamis mencakup perhitungan penjualan dan potongan pakan
    oleh PT.
5.  Aplikasi mencatat pendapatan berdasarkan nota yang diterima.
6.  Aplikasi tidak menghitung ulang potongan harga pakan.
7.  Modul pakan dan penjualan merupakan pencatatan terpisah.
8.  Pendapatan penjualan tidak dikurangi harga pakan secara manual di
    aplikasi.

Jika nota mencakup hasil penjualan dari beberapa kali pengambilan,
aplikasi harus dapat menghubungkan nota dengan transaksi pengambilan
terkait.

### 5.4 Manajemen Pakan

Digunakan untuk mencatat pakan yang diberikan PT. Pakan diberikan setiap
Senin.

Data: - Tanggal penerimaan pakan. - Jumlah pakan dalam sak. - Harga
pakan per sak. - Jenis pakan jika diperlukan. - Catatan.

Fitur: - Tambah pencatatan pakan. - Edit data pakan. - Riwayat
penerimaan pakan. - Riwayat perubahan harga. - Grafik jumlah pakan. -
Grafik perubahan harga pakan. - Filter berdasarkan periode.

#### Aturan bisnis harga pakan

1.  Harga pakan dapat naik atau turun.
2.  Setiap perubahan harga disimpan sebagai riwayat.
3.  Harga lama tidak boleh ditimpa oleh harga baru.
4.  Data penerimaan pakan tetap menyimpan harga yang berlaku saat
    transaksi dicatat.
5.  Modul pakan tidak digunakan untuk menghitung pendapatan penjualan
    telur.
6.  Potongan pakan pada nota PT tidak dihitung ulang oleh aplikasi.

### 5.5 Manajemen Populasi

Digunakan untuk mengetahui jumlah burung puyuh yang masih hidup.

Data: - Nama kelompok atau batch puyuh. - Tanggal menetas. - Tanggal
masuk kandang. - Populasi awal. - Tanggal mulai produksi jika
diperlukan. - Catatan.

Fitur: - Tambah kelompok puyuh. - Lihat populasi awal. - Lihat populasi
saat ini. - Lihat umur puyuh. - Riwayat populasi. - Grafik populasi.

#### Aturan bisnis populasi

Populasi saat ini dihitung dari:

`Populasi saat ini = Populasi awal - Total kematian - Pengurangan populasi lainnya`

Pengurangan populasi lainnya dapat mencakup afkir atau penjualan burung
jika fitur tersebut diaktifkan.

Semua perubahan populasi harus memiliki riwayat pencatatan.

### 5.6 Pencatatan Kematian

Digunakan untuk mencatat jumlah burung puyuh yang mati.

Data: - Tanggal. - Kelompok puyuh. - Jumlah kematian. - Catatan penyebab
jika diketahui.

Fitur: - Tambah catatan kematian. - Edit catatan kematian. - Riwayat
kematian. - Total kematian per hari. - Total kematian per bulan. -
Grafik kematian harian. - Grafik kematian bulanan.

#### Aturan bisnis kematian

1.  Kematian dicatat berdasarkan tanggal kejadian.
2.  Jumlah kematian harus berupa angka positif.
3.  Populasi burung berkurang secara otomatis setelah pencatatan
    kematian.
4.  Sistem tidak boleh mengizinkan jumlah kematian melebihi populasi
    yang tersedia.
5.  Perubahan atau koreksi catatan kematian harus tercatat.

### 5.7 Kalender dan Catatan Kandang

Digunakan untuk mencatat kegiatan penting dan jadwal kandang.

Contoh kegiatan: - Puyuh naik ke baterai. - Pemberian vitamin. -
Pemberian obat. - Pemberian vaksin. - Perubahan jenis pakan. - Kegiatan
penting lainnya.

Data kalender: - Judul kegiatan. - Tanggal kegiatan. - Kelompok puyuh. -
Jenis kegiatan. - Catatan. - Pengingat jika diperlukan.

Fitur: - Kalender bulanan. - Kalender mingguan. - Tambah kegiatan. -
Edit kegiatan. - Hapus kegiatan. - Lihat detail kegiatan. - Lihat
riwayat kegiatan. - Pengingat kegiatan mendatang.

#### Perhitungan umur puyuh

Umur puyuh dihitung otomatis berdasarkan tanggal menetas.

`Umur puyuh = Tanggal hari ini - Tanggal menetas`

Umur ditampilkan dalam hari atau minggu.

Tanggal naik baterai dapat dicatat sebagai kegiatan kalender. Sistem
juga dapat menampilkan umur puyuh saat kegiatan tersebut dilakukan.

### 5.8 Warning atau Peringatan Otomatis

Digunakan untuk memberikan peringatan jika kondisi peternakan mulai
mengkhawatirkan.

#### Warning kematian

-   Jumlah kematian harian meningkat.
-   Persentase kematian melewati batas.
-   Kematian meningkat dibandingkan periode sebelumnya.

#### Warning produksi

-   Produksi telur turun.
-   Produksi telur di bawah standar.
-   Produktivitas telur menurun dibandingkan rata-rata periode
    sebelumnya.

#### Warning populasi

-   Populasi berkurang secara signifikan.
-   Jumlah populasi tidak sesuai dengan data operasional.

#### Warning pakan

-   Jumlah pakan yang diterima tidak sesuai kebutuhan.
-   Stok pakan mencapai batas minimum jika stok pakan diimplementasikan.

#### Aturan warning

1.  Batas warning harus dapat dikonfigurasi.
2.  Sistem memiliki level peringatan.
3.  Warning ditampilkan di dashboard.
4.  Warning memiliki tanggal dan waktu.
5.  Warning memiliki deskripsi penyebab.
6.  Warning dapat ditandai sebagai sudah diperiksa.
7.  Warning tidak boleh hilang tanpa riwayat.

Level warning: - Normal. - Waspada. - Kritis.

Batas awal harus ditentukan berdasarkan kondisi peternakan dan
dikonfirmasi pemilik usaha. Warning tidak menggantikan pemeriksaan
langsung terhadap kondisi burung.

### 5.9 Laporan dan Grafik

Aplikasi menyediakan laporan visual untuk membantu pemilik usaha
memantau perkembangan.

Grafik: - Produksi telur per hari. - Produksi telur per minggu. -
Produksi telur per bulan. - Penjualan telur per periode. - Pendapatan
penjualan per periode. - Harga pakan dari waktu ke waktu. - Jumlah pakan
yang diterima. - Kematian burung per periode. - Populasi burung. -
Produktivitas telur.

Filter laporan: - Hari ini. - Minggu ini. - Bulan ini. - Bulan
sebelumnya. - Rentang tanggal khusus.

## 6. Struktur Menu

Menu utama aplikasi:

1.  Dashboard
2.  Produksi Telur
3.  Penjualan PT
4.  Manajemen Pakan
5.  Populasi Burung
6.  Pencatatan Kematian
7.  Kalender Kandang
8.  Warning
9.  Laporan dan Grafik
10. Pengaturan

## 7. Rancangan Database

Rancangan tabel utama:

-   `users` --- data pengguna.
-   `quail_batches` --- kelompok atau batch puyuh.
-   `egg_productions` --- produksi telur harian.
-   `egg_pickups` --- riwayat pengambilan telur oleh PT.
-   `sales_notes` --- nota penjualan yang diterima dari PT.
-   `feed_receipts` --- penerimaan pakan dari PT.
-   `feed_price_history` --- riwayat perubahan harga pakan.
-   `mortality_records` --- pencatatan kematian burung.
-   `population_adjustments` --- perubahan populasi selain kematian jika
    diperlukan.
-   `calendar_events` --- kegiatan penting dan jadwal kandang.
-   `warning_rules` --- aturan dan batas warning.
-   `warning_events` --- riwayat warning yang dihasilkan sistem.
-   `app_settings` --- konfigurasi aplikasi.

Relasi tabel harus dirancang agar data transaksi dan riwayat tetap
terjaga.

## 8. Struktur Backend

Contoh struktur folder:

``` text
backend/
├── cmd/
│   └── api/
│       └── main.go
├── internal/
│   ├── config/
│   ├── database/
│   ├── middleware/
│   ├── models/
│   ├── handlers/
│   ├── services/
│   ├── repositories/
│   ├── routes/
│   └── utils/
├── migrations/
├── .env.example
├── go.mod
└── README.md
```

## 9. Struktur Frontend

Contoh struktur folder:

``` text
frontend/
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── features/
│   ├── services/
│   ├── hooks/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
├── tsconfig.json
└── README.md
```

## 10. Tahapan Implementasi

Pengerjaan dilakukan secara bertahap agar setiap modul dapat diuji
sebelum melanjutkan ke modul berikutnya.

### Tahap 1 - Fondasi Proyek

-   Membuat repository.
-   Membuat backend Go.
-   Membuat frontend React.
-   Menghubungkan PostgreSQL.
-   Menyiapkan konfigurasi environment.
-   Membuat struktur folder.
-   Menyiapkan migrasi database.

### Tahap 2 - Autentikasi

-   Login.
-   Logout.
-   Proteksi endpoint.
-   Proteksi halaman frontend.

### Tahap 3 - Manajemen Populasi

-   CRUD kelompok puyuh.
-   Pencatatan populasi awal.
-   Perhitungan umur puyuh.

### Tahap 4 - Produksi Telur

-   CRUD produksi harian.
-   Riwayat produksi.
-   Grafik produksi.

### Tahap 5 - Penjualan PT

-   Pencatatan pengambilan telur.
-   Pencatatan nota PT.
-   Riwayat penjualan.
-   Grafik penjualan dan pendapatan.

### Tahap 6 - Manajemen Pakan

-   Pencatatan pakan.
-   Riwayat harga.
-   Grafik jumlah pakan.
-   Grafik harga pakan.

### Tahap 7 - Pencatatan Kematian

-   Pencatatan kematian.
-   Pengurangan populasi otomatis.
-   Riwayat kematian.
-   Grafik kematian.

### Tahap 8 - Kalender Kandang

-   Kalender kegiatan.
-   Catatan kegiatan.
-   Perhitungan umur saat kegiatan.
-   Pengingat kegiatan.

### Tahap 9 - Warning

-   Warning kematian.
-   Warning produksi.
-   Warning populasi.
-   Warning pakan jika stok diterapkan.
-   Konfigurasi batas warning.

### Tahap 10 - Dashboard dan Laporan

-   Ringkasan data.
-   Grafik.
-   Filter periode.
-   Penyempurnaan UI/UX.

### Tahap 11 - Pengujian

-   Pengujian backend.
-   Pengujian API.
-   Pengujian frontend.
-   Pengujian integrasi.
-   Pengujian perhitungan populasi.
-   Pengujian warning.
-   Pengujian data historis.

## 11. Prinsip Pengembangan

1.  Backend dan frontend harus terpisah.
2.  Semua data disimpan di PostgreSQL.
3.  Backend menjadi sumber kebenaran untuk perhitungan.
4.  Data historis tidak boleh hilang saat harga berubah.
5.  Setiap modul memiliki endpoint API yang terstruktur.
6.  Perhitungan populasi harus konsisten.
7.  Warning harus memiliki aturan yang dapat dikonfigurasi.
8.  Grafik menggunakan data yang tersimpan di database.
9.  Hindari membuat fitur di luar ruang lingkup sebelum MVP selesai.
10. Implementasi dilakukan satu modul pada satu waktu.

## 12. Target MVP

Versi pertama aplikasi harus memiliki:

-   Login.
-   Dashboard.
-   Produksi telur.
-   Penjualan PT.
-   Pencatatan pakan.
-   Riwayat harga pakan.
-   Populasi burung.
-   Pencatatan kematian.
-   Kalender kandang.
-   Warning dasar.
-   Grafik utama.

Fitur tambahan seperti pengeluaran operasional, stok obat, laporan
akuntansi, multi-user, dan integrasi eksternal dapat dikembangkan pada
tahap selanjutnya.

## 13. Status Proyek

Status: **MVP selesai dan dapat dijalankan secara lokal.**

Modul yang sudah diimplementasikan:

-   Login, logout, proteksi halaman, dan proteksi endpoint (JWT).
-   Dashboard dengan ringkasan, grafik, warning aktif, dan agenda
    terdekat.
-   Produksi telur harian (CRUD, filter periode, grafik).
-   Penjualan PT: pengambilan telur Senin/Kamis, nota PT, tautan nota ke
    pengambilan, ringkasan pendapatan.
-   Manajemen pakan: penerimaan, riwayat harga yang tidak saling
    menimpa, grafik harga dan jumlah pakan.
-   Populasi: batch, umur otomatis, populasi aktif, penyesuaian
    (afkir/penambahan).
-   Pencatatan kematian dengan validasi populasi tersedia.
-   Kalender kandang dan agenda mendatang.
-   Warning otomatis dengan level waspada/kritis, aturan yang dapat
    dikonfigurasi, dan riwayat pemeriksaan.
-   Laporan dan grafik dengan filter periode.
-   Pengaturan usaha, profil/akun, dan activity log.

Catatan implementasi:

-   Migrasi tabel dijalankan otomatis melalui GORM `AutoMigrate` saat
    backend start.
-   Data demo dapat dibuat otomatis dengan `SEED_DEMO=true`.
-   Penghapusan/penolakan data operasional tetap meninggalkan jejak di
    `activity_logs`.
-   Riwayat harga pakan bersifat append-only; harga lama tidak ditimpa.
-   Aplikasi tidak menghitung ulang potongan pakan pada nota PT.

## 14. Cara Menjalankan Aplikasi

### Prasyarat

-   Go 1.22 atau lebih baru.
-   Node.js 20 atau lebih baru beserta npm.
-   PostgreSQL/Neon **opsional** untuk lokal; tanpa itu aplikasi memakai
    SQLite.

### Menjalankan backend

``` bash
cd backend
cp .env.example .env        # Windows: Copy-Item .env.example .env
go mod download
go run ./cmd/api
```

Secara default backend berjalan di `http://localhost:8080` dengan
database SQLite di `backend/data/puyuh.db`.

Untuk memakai PostgreSQL/Neon, isi `DATABASE_URL` pada `backend/.env`:

``` env
DB_DRIVER=postgres
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

Untuk pengembangan lokal tanpa PostgreSQL, gunakan:

``` env
DB_DRIVER=sqlite
SQLITE_PATH=data/puyuh.db
SEED_DEMO=true
```

### Menjalankan frontend

``` bash
cd frontend
npm install
npm run dev
```

Buka `http://localhost:5173`. Vite meneruskan request `/api` ke backend
di `http://localhost:8080`.

### Akun awal

Akun admin dibuat otomatis dari environment saat database masih kosong:

-   Email: `admin@kandang.local`
-   Password: `Admin123!`

Ubah `ADMIN_EMAIL` dan `ADMIN_PASSWORD` sebelum dipakai di production.
Pada mode production, `JWT_SECRET` wajib diganti.

### Perintah pemeriksaan

``` bash
# backend
cd backend
go build ./...
go vet ./...

# frontend
cd frontend
npm run build
npm run lint
```

## 15. Ringkasan API

Semua endpoint (kecuali login dan health check) memerlukan header
`Authorization: Bearer <token>`.

| Area | Endpoint utama |
| --- | --- |
| Auth | `POST /api/v1/auth/login`, `GET /auth/me`, `PUT /auth/profile`, `PUT /auth/password` |
| Dashboard & laporan | `GET /api/v1/dashboard`, `GET /reports` |
| Populasi | `GET/POST /api/v1/batches`, `GET/PUT/DELETE /batches/:id`, `GET /batches/:id/history`, `GET/POST /population-adjustments` |
| Produksi | `GET/POST /api/v1/productions`, `GET /productions/summary`, `PUT/DELETE /productions/:id` |
| Penjualan | `GET/POST /api/v1/pickups`, `GET /pickups/linkable`, `GET/POST /sales-notes`, `GET /sales/summary` |
| Pakan | `GET/POST /api/v1/feed-receipts`, `GET/POST /feed-prices`, `GET /feed-prices/latest`, `GET /feed/summary` |
| Kematian | `GET/POST /api/v1/mortality`, `GET /mortality/summary` |
| Kalender | `GET/POST /api/v1/events`, `GET /events/upcoming` |
| Warning | `GET /api/v1/warnings`, `POST /warnings/generate`, `POST /warnings/:id/acknowledge`, `GET/PUT /warning-rules` |
| Pengaturan | `GET/PUT /api/v1/settings`, `GET /activities` |

Format respons: `{ "success": true, "data": ... }`. Untuk data
berhalaman ditambahkan `meta`. Kesalahan menggunakan
`{ "success": false, "error": "..." }`.

## 16. Pengujian yang Sudah Dilakukan

-   Build backend (`go build ./...`) dan frontend (`npm run build`)
    berhasil.
-   Login dan proteksi endpoint diuji melalui API.
-   Produksi ganda pada tanggal yang sama ditolak dengan status `409`.
-   Kematian melebihi populasi tersedia ditolak dengan status `400`.
-   Perhitungan populasi, ringkasan penjualan, riwayat harga pakan, dan
    warning diverifikasi melalui API.
-   Seluruh halaman frontend diverifikasi di browser: dashboard,
    produksi, penjualan, pakan, populasi, kematian, kalender, warning,
    laporan, pengaturan, dan halaman 404.

README ini menjadi panduan utama pengembangan aplikasi.
