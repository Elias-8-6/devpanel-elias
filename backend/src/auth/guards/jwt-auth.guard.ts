import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_COOKIE, readCookie } from '../auth.cookies.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AuthenticatedRequest, JwtPayload } from '../jwt-payload.interface.js';

// Registered globally (APP_GUARD): secure by default, opt out with @Public().
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request, ACCESS_COOKIE);
    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Se requiere iniciar sesión',
      });
    }

    try {
      // Algorithm, issuer and audience are pinned in JwtModule verifyOptions.
      request.user = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch (err: unknown) {
      const expired = err instanceof Error && err.name === 'TokenExpiredError';
      // TOKEN_EXPIRED tells the client to call /auth/refresh and retry.
      throw new UnauthorizedException({
        code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: expired ? 'La sesión expiró' : 'Token inválido',
      });
    }
    return true;
  }
}
