// HTTP client for the DevPanel API.
// - Same-origin requests (Vite proxies /api), so the HttpOnly session
//   cookies travel automatically and JS never touches a token.
// - On 401, refreshes the session once and retries the request.
// - Refreshes never run in parallel, neither within a tab (shared promise)
//   nor across tabs (Web Locks): the backend rotates refresh tokens and
//   treats a reused one as theft, so two tabs refreshing with the same
//   cookie would log the user out everywhere.

const API_BASE = '/api/v1'

// Endpoints whose 401 means "bad credentials / no session", not "expired".
const NO_REFRESH_PATHS = new Set(['/auth/login', '/auth/refresh', '/auth/logout'])

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: string[]
  // From the Retry-After header on 429 responses.
  readonly retryAfterSeconds: number | null

  constructor(
    status: number,
    code: string,
    message: string,
    details: string[] = [],
    retryAfterSeconds: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError'

// Normalizes anything thrown by fetch/apiJson (network failures included).
export const asApiError = (err: unknown): ApiError =>
  err instanceof ApiError
    ? err
    : new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor')

type QueryValue = string | number | undefined
export interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
}

const sessionExpiredListeners = new Set<() => void>()

// Lets the auth layer react (redirect to login) when a session can't be renewed.
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

const REFRESH_LOCK = 'devpanel:auth-refresh'
let refreshInFlight: Promise<boolean> | null = null

// Serializes `task` across every tab of this origin. A tab that waited for
// the lock sends the refresh cookie the previous tab just rotated (the cookie
// jar is shared and read at send time), so it's a valid rotation, not reuse.
function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(REFRESH_LOCK, task)
    : task()
}

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= withCrossTabLock(() =>
    fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
      .then((res) => res.ok)
      .catch(() => false),
  ).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`
}

function send(path: string, { method = 'GET', body, query, signal }: RequestOptions) {
  return fetch(buildUrl(path, query), {
    method,
    signal,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// Maps the backend error contract { error: { code, message, details? } }.
async function toApiError(res: Response): Promise<ApiError> {
  const payload: unknown = await res.json().catch(() => null)
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null
  const code = typeof error?.code === 'string' ? error.code : `HTTP_${res.status}`
  const message =
    typeof error?.message === 'string' ? error.message : 'Error inesperado del servidor'
  const details = Array.isArray(error?.details)
    ? error.details.filter((d): d is string => typeof d === 'string')
    : []
  const retryAfter = Number(res.headers.get('Retry-After'))
  return new ApiError(
    res.status,
    code,
    message,
    details,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  )
}

async function execute(path: string, options: RequestOptions): Promise<Response> {
  let res = await send(path, options)

  if (res.status === 401 && !NO_REFRESH_PATHS.has(path)) {
    if (await refreshSession()) {
      res = await send(path, options)
    }
    if (res.status === 401) {
      sessionExpiredListeners.forEach((listener) => listener())
    }
  }

  if (!res.ok) throw await toApiError(res)
  return res
}

// The response shape is trusted to match the backend DTOs (same repo, same
// contract); there's no runtime schema validation.
export async function apiJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await execute(path, options)
  return (await res.json()) as T
}

export async function apiVoid(path: string, options: RequestOptions = {}): Promise<void> {
  await execute(path, options)
}
