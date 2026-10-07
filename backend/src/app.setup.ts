import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

// Gateway-level cross-cutting concerns. Shared by main.ts and the e2e tests
// so both exercise the exact same HTTP pipeline.
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);

  // Which peers may set X-Forwarded-For: the proxy's IP/CIDR (preferred) or a
  // hop count (0 = no proxy). Rate limiting keys on req.ip, so trusting a
  // peer that isn't the proxy lets that caller choose its own IP.
  app.set('trust proxy', config.getOrThrow<number | string>('TRUST_PROXY'));

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGIN'),
    credentials: true,
  });

  // Every service contract lives under /api/v1/...
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
}
