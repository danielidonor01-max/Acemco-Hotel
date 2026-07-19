import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { assertSecrets } from './common/config/assert-secrets';
import { initSentry } from './common/observability/sentry';

/**
 * Builds and configures the Nest app WITHOUT calling listen().
 * Shared by the local server (main.ts) and the Vercel serverless handler (api/index.ts).
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  // Refuse to boot with a missing/placeholder signing key rather than falling back
  // to a hardcoded one and accepting forged tokens.
  assertSecrets(config);

  // Error tracking — no-op unless SENTRY_DSN is set.
  initSentry(config.get<string>('SENTRY_DSN'), config.get<string>('NODE_ENV') ?? 'production');

  // Baseline security headers (nosniff, frameguard, HSTS, referrer-policy, hides
  // x-powered-by). CSP is disabled because this is a JSON API — a content policy
  // adds little here and would break the Swagger UI document in development.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000',
    credentials: true,
  });

  // API docs are a full map of every route + DTO — useful in development, free
  // reconnaissance in production. Only mount them outside production.
  if ((config.get<string>('NODE_ENV') ?? 'production') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AEHOP API')
      .setDescription('Acemco Express Hotel Operations Platform — API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  return app;
}
