import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './app/context'
import { getSessionToken } from './app/storage'
import { LoginPage } from './pages/Login'
import { MenuPage } from './pages/Menu'
import { OpenBoxPage } from './pages/OpenBox'
import { PickingPage } from './pages/Picking'
import { FinishPage } from './pages/Finish'
import { ReopenPage } from './pages/Reopen'
import { HistoryPage } from './pages/History'
import { SettingsPage } from './pages/Settings'
import { SupervisorPage } from './pages/Supervisor'
import { AdminPage } from './pages/Admin'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <PortraitOnly />
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route
            path="/menu"
            element={
              <RequireAuth>
                <MenuPage />
              </RequireAuth>
            }
          />
          <Route
            path="/caixa/abrir"
            element={
              <RequireAuth>
                <OpenBoxPage />
              </RequireAuth>
            }
          />
          <Route
            path="/caixa/reabrir"
            element={
              <RequireAuth>
                <ReopenPage />
              </RequireAuth>
            }
          />
          <Route
            path="/picking"
            element={
              <RequireAuth>
                <PickingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/caixa/finalizar"
            element={
              <RequireAuth>
                <FinishPage />
              </RequireAuth>
            }
          />
          <Route
            path="/historico"
            element={
              <RequireAuth>
                <HistoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/supervisor"
            element={
              <RequireAuth>
                <SupervisorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminOnly>
                  <AdminPage />
                </AdminOnly>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const token = getSessionToken()
  if (!token) return <Navigate to="/" replace />
  return <>{children}</>
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { session } = useApp()
  if (session?.role !== 'ADMIN') return <Navigate to="/menu" replace />
  return <>{children}</>
}

function PortraitOnly() {
  const [isLandscape, setIsLandscape] = useState(
    () => window.matchMedia && window.matchMedia('(orientation: landscape)').matches,
  )
  const [minSide, setMinSide] = useState(() => Math.min(window.innerWidth, window.innerHeight))

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    const onChange = () => setIsLandscape(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    const onResize = () => setMinSide(Math.min(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isMobileSized = minSide <= 520
  if (!isLandscape || !isMobileSized) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-app-bg px-6 text-center">
      <div className="max-w-[380px] rounded-xl border border-app-border bg-app-panel p-5 shadow-panel">
        <div className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-app-muted">
          Orientação
        </div>
        <div className="mt-2 text-[15px] font-semibold text-app-text">
          Use o coletor na vertical (portrait).
        </div>
      </div>
    </div>
  )
}
