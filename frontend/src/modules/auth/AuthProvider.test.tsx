import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from './AuthContext.ts'
import { AuthProvider } from './AuthProvider.tsx'
import { useAuth } from './useAuth.ts'

const api = vi.hoisted(() => ({
  fetchCurrentUser: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
}))
vi.mock('./api.ts', () => api)

// Exposes the context to the test; written in an effect, not during render.
const authRef: { current: AuthContextValue | null } = { current: null }
function Probe() {
  const value = useAuth()
  useEffect(() => {
    authRef.current = value
  })
  return <p>status: {value.state.status}</p>
}

const user = {
  id: '1',
  name: 'Admin',
  email: 'admin@devpanel.local',
  role: 'admin',
  status: 'active',
  createdAt: '2026-10-07T00:00:00Z',
}

async function renderLoggedIn() {
  api.fetchCurrentUser.mockResolvedValue(user)
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
  await screen.findByText('status: authenticated')
}

describe('AuthProvider', () => {
  it('restores the session from /auth/me on mount', async () => {
    await renderLoggedIn()
  })

  it('stays logged in when the logout request fails (cookies are still valid)', async () => {
    await renderLoggedIn()
    api.logout.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await act(async () => {
      await expect(authRef.current!.logout()).rejects.toThrow('Failed to fetch')
    })
    expect(screen.getByText('status: authenticated')).toBeTruthy()
  })

  it('becomes anonymous once the server confirms the logout', async () => {
    await renderLoggedIn()
    api.logout.mockResolvedValueOnce(undefined)

    await act(async () => {
      await authRef.current!.logout()
    })
    expect(screen.getByText('status: anonymous')).toBeTruthy()
  })
})
