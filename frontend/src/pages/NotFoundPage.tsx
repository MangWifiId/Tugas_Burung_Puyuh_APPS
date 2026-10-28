import { Link } from 'react-router-dom'
import { ArrowLeft, Bird, SearchX } from 'lucide-react'
import { usePageTitle } from '../components/ProtectedRoute'
import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  usePageTitle('Halaman tidak ditemukan')

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
          <SearchX className="h-8 w-8" />
        </div>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
          Error 404
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Alamat yang Anda buka tidak tersedia atau sudah dipindahkan. Kembali ke dashboard untuk
          melanjutkan pencatatan.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/">
            <Button icon={<ArrowLeft className="h-4 w-4" />}>Kembali ke dashboard</Button>
          </Link>
          <Link to="/produksi">
            <Button variant="secondary" icon={<Bird className="h-4 w-4" />}>
              Produksi telur
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
