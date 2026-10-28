# Backend Manajemen Puyuh

REST API untuk aplikasi pencatatan dan pemantauan usaha telur burung
puyuh.

## Teknologi

-   Go + Gin
-   GORM (`AutoMigrate`)
-   PostgreSQL/Neon untuk production
-   SQLite untuk pengembangan lokal
-   JWT untuk autentikasi

## Menjalankan

``` bash
cp .env.example .env        # Windows: Copy-Item .env.example .env
go mod download
go run ./cmd/api
```

Server berjalan di `http://localhost:8080`. Health check tersedia di
`GET /health`.

### SQLite (default lokal)

Jika `DATABASE_URL` kosong dan `DB_DRIVER` tidak diisi, backend memakai
SQLite:

``` env
SQLITE_PATH=data/puyuh.db
SEED_DEMO=true
```

Database dan data demo dibuat otomatis saat pertama kali dijalankan.

### PostgreSQL/Neon

``` env
DB_DRIVER=postgres
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
SEED_DEMO=false
```

Tabel dibuat otomatis melalui `AutoMigrate` saat start.

## Environment

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `APP_ENV` | `development` | `production` mengaktifkan mode rilis |
| `PORT` | `8080` | Port HTTP |
| `APP_TIMEZONE` | `Asia/Jakarta` | Zona waktu perhitungan tanggal |
| `DB_DRIVER` | otomatis | `postgres` atau `sqlite` |
| `DATABASE_URL` | - | URL PostgreSQL/Neon |
| `SQLITE_PATH` | `data/puyuh.db` | Lokasi file SQLite |
| `JWT_SECRET` | `dev-secret-change-me` | Wajib diganti di production |
| `JWT_EXPIRY_HOURS` | `24` | Masa berlaku token |
| `ADMIN_NAME` | `Pemilik Kandang` | Nama admin awal |
| `ADMIN_EMAIL` | `admin@kandang.local` | Email admin awal |
| `ADMIN_PASSWORD` | `Admin123!` | Password admin awal |
| `SEED_DEMO` | `false` | Membuat data contoh |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Origin frontend yang diizinkan |

## Struktur

``` text
backend/
├── cmd/api/main.go          # startup, migrasi, seed, warning berkala
├── internal/
│   ├── config/              # pembacaan environment
│   ├── database/            # koneksi, migrasi, seed
│   ├── handlers/            # HTTP handler
│   ├── middleware/          # JWT auth
│   ├── models/              # model GORM
│   ├── routes/              # definisi endpoint
│   ├── services/            # aturan bisnis
│   └── utils/               # hash password, helper
└── data/                    # database SQLite lokal
```

## Aturan bisnis penting

-   Populasi aktif = populasi awal - kematian - pengurangan + penambahan.
-   Kematian tidak boleh melebihi populasi yang tersedia.
-   Produksi telur unik per batch dan tanggal.
-   Nota PT dapat ditautkan ke beberapa pengambilan; pendapatan dicatat
    dari nilai nota, bukan dihitung ulang.
-   Riwayat harga pakan bersifat append-only.
-   Setiap perubahan data penting dicatat di `activity_logs`.
-   Warning dibuat dari aturan yang dapat dikonfigurasi dan dideduplikasi
    berdasarkan `(code, event_date)`.

## Pemeriksaan

``` bash
go build ./...
go vet ./...
```
