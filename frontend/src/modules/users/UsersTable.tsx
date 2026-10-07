import { useCallback, useState } from 'react'
import { Badge } from '../../shared/components/Badge.tsx'
import { Spinner } from '../../shared/components/Spinner.tsx'
import { useApiQuery } from '../../shared/hooks/useApiQuery.ts'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue.ts'
import { listUsers } from './api.ts'
import {
  ROLE_LABELS,
  ROLE_TONES,
  STATUS_LABELS,
  USER_ROLES,
  USER_STATUSES,
  type UserRole,
  type UserStatus,
} from './types.ts'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium' })

const selectClass =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none'

export function UsersTable() {
  const [searchInput, setSearchInput] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS)

  // The page belongs to a given filter combination: when the filters change,
  // the derived page falls back to 1 without an extra render or effect.
  const filterKey = `${search}|${role}|${status}`
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 })
  const page = pageState.key === filterKey ? pageState.page : 1
  const goToPage = (next: number) => setPageState({ key: filterKey, page: next })

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      listUsers(
        {
          search: search || undefined,
          role: role || undefined,
          status: status || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
        signal,
      ),
    [search, role, status, page],
  )
  const { data, error, loading, reload } = useApiQuery(fetcher)

  const meta = data?.meta
  const users = data?.data ?? []
  const hasFilters = Boolean(search || role || status)

  return (
    <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
        <h2 className="text-base font-semibold text-slate-900 sm:mr-auto">Usuarios</h2>

        <div className="relative">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre o email…"
            aria-label="Buscar usuarios"
            maxLength={100}
            className="w-full rounded-md border border-slate-300 py-2 pr-9 pl-3 text-sm shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none sm:w-64"
          />
          {loading && data && (
            <span className="absolute top-1/2 right-3 -translate-y-1/2">
              <Spinner size="size-4" />
            </span>
          )}
        </div>

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole | '')}
          aria-label="Filtrar por rol"
          className={selectClass}
        >
          <option value="">Todos los roles</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as UserStatus | '')}
          aria-label="Filtrar por estado"
          className={selectClass}
        >
          <option value="">Todos los estados</option>
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>No se pudieron cargar los usuarios: {error.message}</span>
          <button type="button" onClick={reload} className="font-semibold hover:underline">
            Reintentar
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">Nombre</th>
              <th scope="col" className="px-4 py-3">Email</th>
              <th scope="col" className="px-4 py-3">Rol</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3">Creado</th>
            </tr>
          </thead>
          <tbody
            className={`divide-y divide-slate-100 transition-opacity ${loading && data ? 'opacity-60' : ''}`}
          >
            {!data && loading &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-3">
                    <span className="block h-5 animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))}

            {data && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  {hasFilters ? 'Ningún usuario coincide con la búsqueda.' : 'No hay usuarios.'}
                </td>
              </tr>
            )}

            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium whitespace-nowrap text-slate-900">
                  {user.name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={user.status === 'active' ? 'emerald' : 'rose'}>
                    {STATUS_LABELS[user.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {dateFormat.format(new Date(user.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <nav
          aria-label="Paginación"
          className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm"
        >
          <p className="text-slate-500">
            {(meta.page - 1) * meta.pageSize + 1}–
            {Math.min(meta.page * meta.pageSize, meta.total)} de {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded-md px-3 py-1.5 font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-slate-500">
              Página {meta.page} de {meta.totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= meta.totalPages || loading}
              className="rounded-md px-3 py-1.5 font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </nav>
      )}
    </section>
  )
}
