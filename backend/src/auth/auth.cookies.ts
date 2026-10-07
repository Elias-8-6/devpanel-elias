import type { CookieOptions, Request } from 'express';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

// The refresh token is only ever sent to the auth endpoints, never to the
// rest of the API.
const ACCESS_PATH = '/api';
const REFRESH_PATH = '/api/v1/auth';

const baseOptions = (secure: boolean): CookieOptions => ({
  httpOnly: true,
  secure,
  sameSite: 'strict',
});

export const accessCookieOptions = (
  secure: boolean,
  maxAgeMs: number,
): CookieOptions => ({
  ...baseOptions(secure),
  path: ACCESS_PATH,
  maxAge: maxAgeMs,
});

export const refreshCookieOptions = (
  secure: boolean,
  maxAgeMs: number,
): CookieOptions => ({
  ...baseOptions(secure),
  path: REFRESH_PATH,
  maxAge: maxAgeMs,
});

// clearCookie must receive the same path/flags the cookie was set with.
export const clearAccessCookieOptions = (secure: boolean): CookieOptions => ({
  ...baseOptions(secure),
  path: ACCESS_PATH,
});

export const clearRefreshCookieOptions = (secure: boolean): CookieOptions => ({
  ...baseOptions(secure),
  path: REFRESH_PATH,
});

// cookie-parser types cookies as `any`; narrow to string here once.
export function readCookie(req: Request, name: string): string | undefined {
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) return undefined;
  const value: unknown = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
