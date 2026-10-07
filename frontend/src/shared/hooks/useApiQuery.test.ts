import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../lib/api.ts'
import { useApiQuery } from './useApiQuery.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type Fetcher = (signal: AbortSignal) => Promise<string>

const setup = (initial: Fetcher) =>
  renderHook(({ fetcher }: { fetcher: Fetcher }) => useApiQuery(fetcher), {
    initialProps: { fetcher: initial },
  })

describe('useApiQuery', () => {
  it('keeps the previous data while the next query loads', async () => {
    const { result, rerender } = setup(() => Promise.resolve('page 1'))
    await waitFor(() => expect(result.current.data).toBe('page 1'))

    const next = deferred<string>()
    rerender({ fetcher: () => next.promise })

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBe('page 1')
  })

  it('does not show data from other parameters next to a failed query (review #4)', async () => {
    const { result, rerender } = setup(() => Promise.resolve('all users'))
    await waitFor(() => expect(result.current.data).toBe('all users'))

    const filtered = deferred<string>()
    rerender({ fetcher: () => filtered.promise })
    act(() => filtered.reject(new ApiError(0, 'NETWORK_ERROR', 'offline')))

    await waitFor(() => expect(result.current.error?.code).toBe('NETWORK_ERROR'))
    expect(result.current.data).toBeNull()
  })

  it('keeps the data when a reload of the same query fails', async () => {
    let call = 0
    const fetcher: Fetcher = () =>
      ++call === 1
        ? Promise.resolve('users')
        : Promise.reject(new ApiError(503, 'SERVICE_UNAVAILABLE', 'down'))
    const { result } = setup(fetcher)
    await waitFor(() => expect(result.current.data).toBe('users'))

    act(() => result.current.reload())

    await waitFor(() => expect(result.current.error?.code).toBe('SERVICE_UNAVAILABLE'))
    expect(result.current.data).toBe('users')
  })

  it('ignores a slow stale response that arrives after a newer one', async () => {
    const slow = deferred<string>()
    const { result, rerender } = setup(() => slow.promise)
    rerender({ fetcher: () => Promise.resolve('new search') })
    await waitFor(() => expect(result.current.data).toBe('new search'))

    act(() => slow.resolve('old search'))

    await Promise.resolve()
    expect(result.current.data).toBe('new search')
  })
})
