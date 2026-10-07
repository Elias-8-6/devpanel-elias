import { apiJson, apiVoid } from '../../lib/api.ts'
import type { User } from '../users/types.ts'

// Tokens live in HttpOnly cookies set by the backend; these calls only ever
// see the user profile.
export function login(email: string, password: string) {
  return apiJson<User>('/auth/login', { method: 'POST', body: { email, password } })
}

export function logout() {
  return apiVoid('/auth/logout', { method: 'POST' })
}

export function fetchCurrentUser(signal: AbortSignal) {
  return apiJson<User>('/auth/me', { signal })
}
