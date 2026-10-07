import { apiJson } from '../../lib/api.ts'

// Mirrors GET /api/v1/metrics/summary (MetricsSummaryDto).
export interface MetricsSummary {
  totalUsers: number
  activeUsers: number
  admins: number
  newThisMonth: number
  generatedAt: string
}

export function getMetricsSummary(signal: AbortSignal) {
  return apiJson<MetricsSummary>('/metrics/summary', { signal })
}
