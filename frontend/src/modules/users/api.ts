import { apiJson } from '../../lib/api.ts'
import type { ListUsersParams, Paginated, User } from './types.ts'

export function listUsers(params: ListUsersParams, signal: AbortSignal) {
  return apiJson<Paginated<User>>('/users', { query: { ...params }, signal })
}
