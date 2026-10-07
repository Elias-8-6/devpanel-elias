import { type FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { type ApiError, asApiError } from '../../lib/api.ts'
import { Spinner } from '../../shared/components/Spinner.tsx'
import type { LoginLocationState } from './routes.tsx'
import { useAuth } from './useAuth.ts'

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email o contraseña incorrectos.',
  VALIDATION_ERROR: 'Revisa el formato del email y la contraseña.',
  NETWORK_ERROR: 'No se pudo conectar con el servidor.',
}

const waitText = (seconds: number): string =>
  seconds < 60 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`

function loginErrorMessage(err: ApiError): string {
  if (err.code === 'TOO_MANY_REQUESTS') {
    return err.retryAfterSeconds
      ? `Demasiados intentos. Inténtalo de nuevo en ${waitText(err.retryAfterSeconds)}.`
      : 'Demasiados intentos. Inténtalo más tarde.'
  }
  return ERROR_MESSAGES[err.code] ?? err.message
}

// Only redirect to paths inside the app (avoids open redirects via state).
const safeRedirect = (from: string | undefined): string =>
  from && from.startsWith('/') && !from.startsWith('//') ? from : '/'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = (location.state ?? {}) as LoginLocationState

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(safeRedirect(locationState.from), { replace: true })
    } catch (err: unknown) {
      setError(loginErrorMessage(asApiError(err)))
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">DevPanel</h1>
          <p className="mt-1 text-sm text-slate-500">Inicia sesión para continuar</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          {locationState.expired && !error && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
              Tu sesión expiró. Vuelve a iniciar sesión.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200"
            >
              {error}
            </p>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Spinner size="size-4" tone="light" />}
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        {import.meta.env.DEV && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Demo: admin@devpanel.local / DevPanel#2026
          </p>
        )}
      </div>
    </main>
  )
}
