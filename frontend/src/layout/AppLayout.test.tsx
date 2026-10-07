import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../modules/auth/AuthContext.ts'
import { AppLayout } from './AppLayout.tsx'

const user = {
  id: '1',
  name: 'Admin DevPanel',
  email: 'admin@devpanel.local',
  role: 'admin' as const,
  status: 'active' as const,
  createdAt: '2026-10-07T00:00:00Z',
}

function renderLayout(logout: AuthContextValue['logout']) {
  const value: AuthContextValue = {
    state: { status: 'authenticated', user },
    login: vi.fn(),
    logout,
  }
  return render(
    <AuthContext value={value}>
      <MemoryRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<p>dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext>,
  )
}

describe('AppLayout logout (review #9)', () => {
  it('shows the logged-in user', () => {
    renderLayout(vi.fn())
    expect(screen.getByText('Admin DevPanel')).toBeTruthy()
    expect(screen.getByText('Administrador')).toBeTruthy()
  })

  it('reports a failed logout instead of an unhandled rejection, and allows retrying', async () => {
    const logout = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    renderLayout(logout)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo cerrar la sesión',
    )
    const button = screen.getByRole('button', { name: 'Cerrar sesión' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(logout).toHaveBeenCalledOnce()
  })
})
