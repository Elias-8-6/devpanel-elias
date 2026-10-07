import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout.tsx'
import { AuthProvider } from './modules/auth/AuthProvider.tsx'
import { LoginPage } from './modules/auth/LoginPage.tsx'
import { ProtectedRoute, PublicOnlyRoute } from './modules/auth/routes.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
