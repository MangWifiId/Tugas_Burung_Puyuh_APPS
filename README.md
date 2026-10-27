# Sistem Manajemen Peternakan Puyuh

Aplikasi web modern untuk manajemen operasional peternakan puyuh dan pencatatan keuangan terintegrasi, dibangun dengan Go (Golang) dan React TypeScript.

---

## 🛠️ Stack Teknologi

- **Backend**: Go (Gin Web Framework, GORM ORM)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts, Lucide Icons
- **Database**: Berkas JSON sebagai penyimpanan utama (atomic write). PostgreSQL bersifat **mirror opsional** untuk analitik/backup.
- **Arsitektur**: Modular Monolith dengan REST API JSON terstandarisasi.

---

## 📂 Struktur Repositori

```text
├── backend/                  # REST API Go (Gin + GORM)
│   ├── cmd/api/main.go       # Entrypoint server backend
│   ├── internal/             # Domain logic (auth, flock, production, inventory, sales, dll.)
│   │   ├── auth/             # JWT authentication & helpers
│   │   ├── config/           # Environment loader & configuration
│   │   ├── database/         # Database connection & auto-migration
│   │   ├── middleware/       # JWT auth & CORS middleware
│   │   ├── models/           # Definisi GORM struct terpadu
│   │   └── response/         # Format amplop respon & error terstandar
│   └── go.mod
├── frontend/                 # Aplikasi Web React + TypeScript + Vite
│   ├── src/
│   │   ├── components/       # Komponen UI bersama (cards, modals, badges, layout)
│   │   ├── pages/            # Halaman fitur (Dashboard, Kandang, Panen, Stok, Penjualan, Keuangan)
│   │   ├── services/         # API client & endpoint calls
│   │   └── types/            # TypeScript type definitions
│   └── package.json
├── docs/                     # Dokumentasi Desain & Spesifikasi
│   ├── database-design.md    # Skema ERD & DDL PostgreSQL lengkap
│   └── api-contract.md       # Spesifikasi kontrak REST API
├── PROMPT.md                 # Spesifikasi dasar proyek
└── README.md
```

---

## 🚀 Panduan Menjalankan Proyek

### 1. Prasyarat
- Go 1.27+
- Node.js v22+ dan npm
- (Opsional) PostgreSQL untuk mirror data

### 2. Menjalankan Backend Go
```powershell
# Masuk ke direktori backend
cd backend

# Salin konfigurasi environment
copy ..\.env.example .env

# Jalankan server API (default port 8080)
go run ./cmd/api
```

Endpoint Health Check: `http://localhost:8080/api/v1/health`

Variabel environment penting:

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `PORT` | `8080` | Port server API |
| `DATA_DIR` | `data` | Folder penyimpanan `database.json` |
| `JWT_SECRET` | — | **Wajib diganti** di produksi |
| `ALLOW_REGISTRATION` | `false` | Izinkan registrasi publik meski akun sudah ada |
| `DATABASE_URL` | kosong | Opsional, mengaktifkan mirror PostgreSQL |

### 3. Menjalankan Frontend React
```powershell
# Masuk ke direktori frontend
cd frontend

# Pasang dependensi
npm install

# Jalankan server development Vite (default port 5173)
npm run dev
```

Buka browser di `http://localhost:5173`. Secara default frontend memanggil `/api/v1`
dan Vite mem-proxy request tersebut ke `http://localhost:8080`, sehingga tidak perlu
mengisi `VITE_API_BASE_URL` saat development.

### 4. Menjalankan dengan Docker (satu container)
Dockerfile bersifat multi-stage: frontend dibangun lebih dulu, lalu backend Go, dan
keduanya disajikan dari satu container.

```powershell
docker build -t quailfarm .
docker run -p 8080:8080 -v quailfarm-data:/data -e JWT_SECRET=ganti-dengan-rahasia-panjang quailfarm
```

Buka `http://localhost:8080`. **Penting:** mount volume ke `/data` (atau set `DATA_DIR`
ke volume persisten) agar data JSON tidak hilang saat container/redeploy.

---

## 📜 Prinsip Desain Utama
1. **Single Source of Truth Persediaan**: Stok fisik dihitung dari mutasi pergerakan barang (`inventory_movements`), bukan saldo manual.
2. **Snapshot Harga Transaksi**: Harga per unit dicatat permanen saat transaksi disahkan (*posted*).
3. **Immutabilitas Dokumen Posted**: Transaksi yang telah disahkan dikoreksi melalui Nota Kredit/Debit atau dokumen retur berjejak audit, bukan dihapus.
4. **Presisi Finansial**: Perhitungan keuangan bebas dari floating-point error.
