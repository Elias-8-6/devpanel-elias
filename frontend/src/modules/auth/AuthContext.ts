import { createContext } from 'react'
import type { User } from '../users/types.ts'

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User }
  // `expired` distinguishes "session ran out" from "never logged in".
  | { status: 'anonymous'; expired: boolean }

export interface AuthContextValue {
  state: AuthState
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
