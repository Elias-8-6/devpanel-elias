import { useCallback, useEffect, useState } from 'react'
import { type ApiError, asApiError, isAbortError } from '../../lib/api.ts'

export interface ApiQueryState<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
  reload: () => void
}

interface Settled<T> {
  data: T | null
  error: ApiError | null
  // Which request this result answers.
  fetcher: unknown
  reloadToken: number
}

// Runs `fetcher` whenever its identity changes (memoize it with useCallback).
// The previous data stays on screen while the next request loads, and stale
// requests are aborted so a slow response can't overwrite a newer one.
export function useApiQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
): ApiQueryState<T> {
  const [reloadToken, setReloadToken] = useState(0)
  const [settled, setSettled] = useState<Settled<T>>({
    data: null,
    error: null,
    fetcher: null,
    reloadToken: -1,
  })

  useEffect(() => {
    const controller = new AbortController()
    fetcher(controller.signal)
      .then((data) => setSettled({ data, error: null, fetcher, reloadToken }))
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        // Keep the previous data only if it answered this same query (a failed
        // reload). Data from other parameters must not be shown as this
        // query's result next to its error.
        setSettled((prev) => ({
          data: prev.fetcher === fetcher ? prev.data : null,
          error: asApiError(err),
          fetcher,
          reloadToken,
        }))
      })
    return () => controller.abort()
  }, [fetcher, reloadToken])

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  // Derived during render: loading means "the latest result is for an older request".
  const isCurrent = settled.fetcher === fetcher && settled.reloadToken === reloadToken
  return {
    data: settled.data,
    error: isCurrent ? settled.error : null,
    loading: !isCurrent,
    reload,
  }
}
