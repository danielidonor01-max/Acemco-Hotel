import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createApp } from './bootstrap';

/** Local / long-running server (VPS, Docker, `npm run start`). */
async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
  logger.log(`AEHOP API running on http://localhost:${port}/api`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
