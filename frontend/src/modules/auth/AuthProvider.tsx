import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { isAbortError, onSessionExpired } from '../../lib/api.ts'
import * as authApi from './api.ts'
import { AuthContext, type AuthContextValue, type AuthState } from './AuthContext.ts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  // Restores the session after a reload: the cookies survive, so /auth/me
  // tells us who is logged in (refreshing the access token if it expired).
  useEffect(() => {
    const controller = new AbortController()
    authApi
      .fetchCurrentUser(controller.signal)
      .then((user) => setState({ status: 'authenticated', user }))
      .catch((err: unknown) => {
        if (!isAbortError(err)) setState({ status: 'anonymous', expired: false })
      })
    return () => controller.abort()
  }, [])

  // Fired by the API client when a 401 can't be fixed by refreshing.
  useEffect(
    () =>
      onSessionExpired(() =>
        setState((prev) =>
          prev.status === 'authenticated' ? { status: 'anonymous', expired: true } : prev,
        ),
      ),
    [],
  )

  const login = useCallback(async (email: string, password: string) => {
    const user = await authApi.login(email, password)
    setState({ status: 'authenticated', user })
  }, [])

  // Only drops the local session once the server confirmed it. If the request
  // fails, the HttpOnly cookies are still in the browser (JS can't delete
  // them) and a reload would silently log the user back in, so pretending
  // to be logged out would be misleading. The error propagates to the UI.
  const logout = useCallback(async () => {
    await authApi.logout()
    setState({ status: 'anonymous', expired: false })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, logout }),
    [state, login, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
