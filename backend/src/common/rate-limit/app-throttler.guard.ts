import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';

// Same as ThrottlerGuard, but answers with the standard Retry-After header
// (the library only sets per-throttler "Retry-After-<name>" variants) and
// the API's error contract.
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    const retryAfterSeconds = Math.max(1, detail.timeToBlockExpire);
    this.setResponseHeader(res, 'Retry-After', retryAfterSeconds);

    throw new HttpException(
      {
        code: 'TOO_MANY_REQUESTS',
        message: 'Demasiadas solicitudes. Inténtalo más tarde.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
