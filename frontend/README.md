# Frontend Manajemen Puyuh

Antarmuka web untuk pencatatan dan pemantauan usaha telur burung puyuh.

## Teknologi

-   React 19 + TypeScript
-   Vite
-   Tailwind CSS v4
-   React Router 7
-   Axios
-   Recharts
-   lucide-react

## Menjalankan

``` bash
npm install
npm run dev
```

Aplikasi berjalan di `http://localhost:5173`. Request ke `/api`
diteruskan ke backend `http://localhost:8080` melalui proxy Vite (lihat
`vite.config.ts`).

## Perintah

| Perintah | Keterangan |
| --- | --- |
| `npm run dev` | Menjalankan development server |
| `npm run build` | Type-check dan build production ke `dist/` |
| `npm run preview` | Melihat hasil build |
| `npm run lint` | Menjalankan Oxlint |

## Struktur

``` text
src/
├── components/   # komponen UI, tabel, modal, grafik
├── hooks/        # hook data dan utilitas
├── layouts/      # layout utama (sidebar, topbar)
├── pages/        # halaman per modul
├── services/     # client Axios dan endpoint API
├── types/        # tipe kontrak API
├── utils/        # format angka/tanggal
├── App.tsx       # definisi route
└── main.tsx      # entry point
```

## Autentikasi

Token JWT disimpan di `localStorage` sebagai `puyuh_token` dan data
pengguna sebagai `puyuh_user`. Route selain `/login` dilindungi oleh
`ProtectedRoute`.

## Catatan

-   Seluruh teks antarmuka menggunakan Bahasa Indonesia.
-   Backend adalah sumber kebenaran untuk perhitungan; frontend hanya
    menampilkan dan mengirim input.
-   Gunakan akun demo `admin@kandang.local` / `Admin123!` setelah backend
    dijalankan dengan data seed.
