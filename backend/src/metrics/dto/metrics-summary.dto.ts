export interface MetricsSummaryDto {
  totalUsers: number;
  activeUsers: number;
  admins: number;
  // Users created since the first day of the current month (UTC).
  newThisMonth: number;
  generatedAt: string;
}
