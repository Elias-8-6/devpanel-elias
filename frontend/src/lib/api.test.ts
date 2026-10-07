// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ApiModule = typeof import('./api.ts')

// Each import after resetModules is an independent copy of the module, like
// the API client loaded in a separate browser tab.
async function openTab(): Promise<ApiModule> {
  vi.resetModules()
  return import('./api.ts')
}

// Mimics the backend: refresh tokens are single-use and presenting a rotated
// one revokes the whole session. The cookie jar is shared by all tabs and is
// read when a request is *sent*, like in a browser.
function createFakeServer() {
  const s = {
    validRefresh: 'rt-1',
    cookieJar: 'rt-1',
    accessValid: false,
    sessionRevoked: false,
    refreshCalls: 0,
    concurrentRefreshes: 0,
    maxConcurrentRefreshes: 0,
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)

    if (url.startsWith('/api/v1/auth/refresh')) {
      const sentToken = s.cookieJar
      s.refreshCalls++
      s.concurrentRefreshes++
      s.maxConcurrentRefreshes = Math.max(s.maxConcurrentRefreshes, s.concurrentRefreshes)
      await new Promise((resolve) => setTimeout(resolve, 10))
      s.concurrentRefreshes--

      if (s.sessionRevoked || sentToken !== s.validRefresh) {
        s.sessionRevoked = true // reuse detected
        return new Response(null, { status: 401 })
      }
      s.validRefresh = `rt-${s.refreshCalls + 1}`
      s.cookieJar = s.validRefresh
      s.accessValid = true
      return new Response(null, { status: 200 })
    }

    if (url.startsWith('/api/v1/users')) {
      return s.accessValid
        ? Response.json({ ok: true })
        : Response.json({ error: { code: 'TOKEN_EXPIRED', message: 'expired' } }, { status: 401 })
    }
    return new Response(null, { status: 404 })
  })

  return { state: s, fetchMock }
}

// Minimal Web Locks: tasks for the same lock run one after another.
function createLocks() {
  let tail: Promise<unknown> = Promise.resolve()
  return {
    request<T>(_name: string, task: () => Promise<T>): Promise<T> {
      const run = tail.then(task)
      tail = run.catch(() => undefined)
      return run
    },
  }
}

describe('api client: session refresh', () => {
  let server: ReturnType<typeof createFakeServer>

  beforeEach(() => {
    server = createFakeServer()
    vi.stubGlobal('fetch', server.fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reproduces the multi-tab bug when refreshes are not coordinated', async () => {
    vi.stubGlobal('navigator', {}) // no Web Locks available
    const [tabA, tabB] = [await openTab(), await openTab()]

    const results = await Promise.allSettled([tabA.apiJson('/users'), tabB.apiJson('/users')])

    expect(server.state.sessionRevoked).toBe(true)
    expect(results.some((r) => r.status === 'rejected')).toBe(true)
  })

  it('two tabs with an expired session both recover without revoking it', async () => {
    vi.stubGlobal('navigator', { locks: createLocks() })
    const [tabA, tabB] = [await openTab(), await openTab()]

    await expect(
      Promise.all([tabA.apiJson('/users'), tabB.apiJson('/users')]),
    ).resolves.toEqual([{ ok: true }, { ok: true }])
    expect(server.state.sessionRevoked).toBe(false)
    expect(server.state.maxConcurrentRefreshes).toBe(1)
  })

  it('shares one refresh among concurrent 401s in the same tab', async () => {
    vi.stubGlobal('navigator', { locks: createLocks() })
    const tab = await openTab()

    await Promise.all([tab.apiJson('/users'), tab.apiJson('/users'), tab.apiJson('/users')])
    expect(server.state.refreshCalls).toBe(1)
  })

  it('notifies session expiry and throws when the refresh is rejected', async () => {
    vi.stubGlobal('navigator', { locks: createLocks() })
    server.state.sessionRevoked = true
    const tab = await openTab()
    const onExpired = vi.fn()
    tab.onSessionExpired(onExpired)

    await expect(tab.apiJson('/users')).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_EXPIRED',
    })
    expect(onExpired).toHaveBeenCalledOnce()
  })
})

describe('api client: error mapping', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes Retry-After on 429 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { code: 'TOO_MANY_REQUESTS', message: 'slow down' } },
          { status: 429, headers: { 'Retry-After': '42' } },
        ),
      ),
    )
    const tab = await openTab()

    await expect(tab.apiJson('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      retryAfterSeconds: 42,
    })
  })

  it('maps network failures to NETWORK_ERROR', async () => {
    const { asApiError } = await openTab()
    expect(asApiError(new TypeError('Failed to fetch')).code).toBe('NETWORK_ERROR')
  })
})
