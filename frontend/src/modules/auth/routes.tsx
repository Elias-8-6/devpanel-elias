import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '../../shared/components/Spinner.tsx'
import { useAuth } from './useAuth.ts'

export interface LoginLocationState {
  from?: string
  expired?: boolean
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50">
      <Spinner size="size-8" />
    </div>
  )
}

// Wait for the session check before deciding, so a logged-in user who
// reloads never sees a flash of the login page.
export function ProtectedRoute() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') return <FullScreenLoader />
  if (state.status === 'anonymous') {
    const loginState: LoginLocationState = {
      from: location.pathname + location.search,
      expired: state.expired,
    }
    return <Navigate to="/login" replace state={loginState} />
  }
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { state } = useAuth()

  if (state.status === 'loading') return <FullScreenLoader />
  if (state.status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
