import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { LoginRateLimit } from '../common/rate-limit/rate-limit.config.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearAccessCookieOptions,
  clearRefreshCookieOptions,
  readCookie,
  refreshCookieOptions,
} from './auth.cookies.js';
import { AuthService, AuthSession } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './jwt-payload.interface.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

const MINUTE_MS = 60_000;

// Tokens travel only in HttpOnly cookies; response bodies carry the user,
// never a token, so page scripts can't read or leak them.
@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;
  private readonly accessTtlMs: number;

  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokens: RefreshTokensService,
    config: ConfigService,
  ) {
    this.secureCookies = config.getOrThrow<boolean>('COOKIE_SECURE');
    this.accessTtlMs =
      config.getOrThrow<number>('JWT_ACCESS_EXPIRES_MINUTES') * MINUTE_MS;
  }

  @Public()
  // Per IP+account, per IP and per account limits (rate-limit.config.ts).
  @LoginRateLimit()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    const session = await this.authService.login(dto);
    this.setSessionCookies(res, session);
    return session.user;
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: MINUTE_MS } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    const token = readCookie(req, REFRESH_COOKIE);
    if (!token) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Sesión inválida o expirada',
      });
    }
    try {
      const session = await this.authService.refresh(token);
      this.setSessionCookies(res, session);
      return session.user;
    } catch (err: unknown) {
      this.clearSessionCookies(res);
      throw err;
    }
  }

  // Public on purpose: logging out must work even with an expired access token.
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(readCookie(req, REFRESH_COOKIE));
    this.clearSessionCookies(res);
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    return this.authService.me(user.sub);
  }

  private setSessionCookies(res: Response, session: AuthSession): void {
    res.cookie(
      ACCESS_COOKIE,
      session.accessToken,
      accessCookieOptions(this.secureCookies, this.accessTtlMs),
    );
    res.cookie(
      REFRESH_COOKIE,
      session.refreshToken,
      refreshCookieOptions(
        this.secureCookies,
        this.refreshTokens.ttlMilliseconds,
      ),
    );
  }

  private clearSessionCookies(res: Response): void {
    res.clearCookie(
      ACCESS_COOKIE,
      clearAccessCookieOptions(this.secureCookies),
    );
    res.clearCookie(
      REFRESH_COOKIE,
      clearRefreshCookieOptions(this.secureCookies),
    );
  }
}
