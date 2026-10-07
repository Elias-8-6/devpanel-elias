import { ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerOptions } from '@nestjs/throttler';

const MINUTE_MS = 60_000;
const IS_LOGIN_ROUTE = 'rateLimit:login';

// Marks the route that receives credentials; enables the login throttlers.
export const LoginRateLimit = () => SetMetadata(IS_LOGIN_ROUTE, true);

const reflector = new Reflector();
const isNotLoginRoute = (context: ExecutionContext): boolean =>
  reflector.get<boolean | undefined>(IS_LOGIN_ROUTE, context.getHandler()) !==
  true;

const clientIp = (req: Record<string, unknown>): string =>
  typeof req.ip === 'string' ? req.ip : 'unknown';

// Account targeted by the attempt. Normalized like UsersService does, and
// capped so arbitrary payloads can't create huge keys.
const attemptedEmail = (req: Record<string, unknown>): string => {
  const body = req.body;
  if (typeof body !== 'object' || body === null) return '-';
  const email: unknown = (body as Record<string, unknown>).email;
  return typeof email === 'string'
    ? email.trim().toLowerCase().slice(0, 254)
    : '-';
};

export interface RateLimitSettings {
  globalTtlMs: number;
  globalLimit: number;
}

// Layered limits: a single per-IP counter is either too strict (locks out
// everyone behind the same NAT/proxy) or too lax (distributed attacks).
export function buildThrottlers({
  globalTtlMs,
  globalLimit,
}: RateLimitSettings): ThrottlerOptions[] {
  return [
    // General API abuse, every route.
    { name: 'default', ttl: globalTtlMs, limit: globalLimit },

    // Classic brute force: one source hammering one account.
    {
      name: 'login-ip-account',
      ttl: MINUTE_MS,
      limit: 5,
      skipIf: isNotLoginRoute,
      getTracker: (req) => `${clientIp(req)}|${attemptedEmail(req)}`,
    },

    // Credential stuffing: one source trying many accounts.
    {
      name: 'login-ip',
      ttl: MINUTE_MS,
      limit: 20,
      skipIf: isNotLoginRoute,
      getTracker: (req) => clientIp(req),
    },

    // Distributed brute force: many sources against one account. Temporary
    // lock (15 min) to keep the "lock out a victim" abuse bounded.
    {
      name: 'login-account',
      ttl: 15 * MINUTE_MS,
      limit: 10,
      blockDuration: 15 * MINUTE_MS,
      skipIf: isNotLoginRoute,
      getTracker: (req) => attemptedEmail(req),
    },
  ];
}
