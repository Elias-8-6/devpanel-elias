import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../modules/auth/useAuth.ts'
import { ROLE_LABELS, ROLE_TONES } from '../modules/users/types.ts'
import { Badge } from '../shared/components/Badge.tsx'

export function AppLayout() {
  const { state, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  // ProtectedRoute guarantees an authenticated user here.
  const user = state.status === 'authenticated' ? state.user : null

  async function handleLogout() {
    setLoggingOut(true)
    setLogoutError(null)
    try {
      await logout()
    } catch {
      setLogoutError('No se pudo cerrar la sesión. Inténtalo de nuevo.')
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <span className="text-lg font-semibold tracking-tight text-slate-900">DevPanel</span>

          {user && (
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
              </button>
            </div>
          )}
        </div>
      </header>

      {logoutError && (
        <p
          role="alert"
          className="bg-rose-50 px-4 py-2 text-center text-sm text-rose-700 ring-1 ring-rose-200"
        >
          {logoutError}
        </p>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
