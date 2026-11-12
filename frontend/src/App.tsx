import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './providers/ToastProvider'
import { ConfirmProvider } from './providers/ConfirmProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProductionPage } from './pages/ProductionPage'
import { SalesPage } from './pages/SalesPage'
import { FeedPage } from './pages/FeedPage'
import { PopulationPage } from './pages/PopulationPage'
import { MortalityPage } from './pages/MortalityPage'
import { CalendarPage } from './pages/CalendarPage'
import { WarningsPage } from './pages/WarningsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/daftar" element={<RegisterPage />} />
              <Route path="/verifikasi-email" element={<VerifyEmailPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="produksi" element={<ProductionPage />} />
                  <Route path="penjualan" element={<SalesPage />} />
                  <Route path="pakan" element={<FeedPage />} />
                  <Route path="populasi" element={<PopulationPage />} />
                  <Route path="kematian" element={<MortalityPage />} />
                  <Route path="kalender" element={<CalendarPage />} />
                  <Route path="warning" element={<WarningsPage />} />
                  <Route path="laporan" element={<ReportsPage />} />
                  <Route path="pengaturan" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
