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

  // Number of reverse proxies in front of the API (0 = connect directly).
  // Rate limiting keys on req.ip, so this must match the real topology:
  // trusting more hops than exist lets clients spoof X-Forwarded-For.
  app.set('trust proxy', config.getOrThrow<number>('TRUST_PROXY_HOPS'));

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
