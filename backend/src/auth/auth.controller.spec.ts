import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

describe('AuthController.refresh', () => {
  const config = {
    getOrThrow: (key: string) =>
      ({ COOKIE_SECURE: false, JWT_ACCESS_EXPIRES_MINUTES: 30 })[key],
  } as unknown as ConfigService;
  const refreshTokens = {
    ttlMilliseconds: 7 * 24 * 60 * 60 * 1000,
  } as RefreshTokensService;

  const req = { cookies: { refresh_token: 'raw-token' } } as unknown as Request;
  const makeRes = () => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn() };
    return res as typeof res & Response;
  };
  const controllerWith = (refresh: () => Promise<never>) =>
    new AuthController(
      { refresh } as unknown as AuthService,
      refreshTokens,
      config,
    );

  it('clears the session cookies when the token is rejected (401)', async () => {
    const res = makeRes();
    const controller = controllerWith(() =>
      Promise.reject(new UnauthorizedException()),
    );

    await expect(controller.refresh(req, res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('keeps the cookies on a transient failure (DB down), so the client can retry', async () => {
    const res = makeRes();
    const controller = controllerWith(() =>
      Promise.reject(new Error('connect ECONNREFUSED')),
    );

    await expect(controller.refresh(req, res)).rejects.toThrow('ECONNREFUSED');
    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});
