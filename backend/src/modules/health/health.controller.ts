import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { sentryEnabled } from '../../common/observability/sentry';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness + database connectivity' })
  async check() {
    let database = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    // `errorTracking` reports only WHETHER a DSN is loaded (a boolean) — never the
    // DSN itself — so it's safe on a public endpoint and lets us confirm the env
    // var actually reached the running build.
    return { status: 'ok', database, errorTracking: sentryEnabled(), timestamp: new Date().toISOString() };
  }
}
