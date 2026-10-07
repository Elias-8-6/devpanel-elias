import { useCallback } from 'react'
import { useApiQuery } from '../../shared/hooks/useApiQuery.ts'
import { getMetricsSummary, type MetricsSummary } from './api.ts'

interface CardDef {
  label: string
  value: (m: MetricsSummary) => number
  hint?: (m: MetricsSummary) => string
}

const percent = (part: number, total: number) =>
  total === 0 ? '0%' : `${Math.round((part / total) * 100)}%`

const CARDS: CardDef[] = [
  { label: 'Usuarios totales', value: (m) => m.totalUsers },
  {
    label: 'Usuarios activos',
    value: (m) => m.activeUsers,
    hint: (m) => `${percent(m.activeUsers, m.totalUsers)} del total`,
  },
  { label: 'Administradores', value: (m) => m.admins },
  { label: 'Nuevos este mes', value: (m) => m.newThisMonth },
]

const numberFormat = new Intl.NumberFormat('es')

export function MetricsCards() {
  const fetcher = useCallback((signal: AbortSignal) => getMetricsSummary(signal), [])
  const { data, error, reload } = useApiQuery(fetcher)

  if (error && !data) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
        <span>No se pudieron cargar las métricas: {error.message}</span>
        <button type="button" onClick={reload} className="font-semibold hover:underline">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => (
        <div key={card.label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <dt className="text-sm font-medium text-slate-500">{card.label}</dt>
          <dd className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {data ? (
              numberFormat.format(card.value(data))
            ) : (
              <span className="block h-9 w-16 animate-pulse rounded bg-slate-100" />
            )}
          </dd>
          {card.hint && data && <p className="mt-1 text-xs text-slate-500">{card.hint(data)}</p>}
        </div>
      ))}
    </dl>
  )
}
