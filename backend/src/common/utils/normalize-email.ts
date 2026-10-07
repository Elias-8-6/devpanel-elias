// Single source of truth for comparing emails. Used both for the DB lookup
// and for rate-limit keys: if they diverged, variants of the same address
// would land in different rate-limit buckets.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
