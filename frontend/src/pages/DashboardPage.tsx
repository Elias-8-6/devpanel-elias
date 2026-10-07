import { MetricsCards } from '../modules/metrics/MetricsCards.tsx'
import { UsersTable } from '../modules/users/UsersTable.tsx'

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
      <MetricsCards />
      <UsersTable />
    </div>
  )
}
