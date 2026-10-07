import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorBody {
  error: { code: string; message: string; details?: string[] };
}

const DEFAULT_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// Single error contract for every service: { error: { code, message } }.
// Unexpected errors are logged server-side and never leak details or stack
// traces to the client.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
        },
      } satisfies ErrorBody);
      return;
    }

    const status = exception.getStatus();
    const body = exception.getResponse();
    const error: ErrorBody['error'] = {
      code: DEFAULT_CODES[status] ?? `HTTP_${status}`,
      message: exception.message,
    };

    if (isRecord(body)) {
      if (typeof body.code === 'string') error.code = body.code;
      if (Array.isArray(body.message)) {
        // ValidationPipe returns one message per failed constraint.
        error.message = 'Datos de entrada inválidos';
        error.details = body.message.filter(
          (m): m is string => typeof m === 'string',
        );
      } else if (typeof body.message === 'string') {
        error.message = body.message;
      }
    }

    res.status(status).json({ error } satisfies ErrorBody);
  }
}
