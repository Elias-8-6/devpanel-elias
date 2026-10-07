import type { BadgeTone } from '../../shared/components/Badge.tsx'

// Mirrors the backend contract of GET /api/v1/users (UserResponseDto).
export const USER_ROLES = ['admin', 'editor', 'viewer'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const USER_STATUSES = ['active', 'inactive'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

export interface ListUsersParams {
  search?: string
  role?: UserRole
  status?: UserStatus
  page: number
  pageSize: number
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Lector',
}

export const ROLE_TONES: Record<UserRole, BadgeTone> = {
  admin: 'indigo',
  editor: 'sky',
  viewer: 'slate',
}

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
}
