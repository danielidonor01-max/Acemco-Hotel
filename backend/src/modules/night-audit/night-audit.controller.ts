import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { NightAuditService } from './night-audit.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const closeSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});

@ApiTags('night-audit')
@Controller('v1/night-audit')
export class NightAuditController {
  constructor(
    private readonly audit: NightAuditService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Pinged hourly by the Vercel cron; runs the close only when the hotel's
   * configured hour has arrived.
   *
   * @Public because a cron carries no session — so it is gated on a shared secret
   * instead. Without one configured it refuses to run rather than leaving an
   * unauthenticated endpoint that mutates reservations and charges fees.
   */
  @Public()
  // GET, not POST: Vercel Cron invokes the path with a GET request, so a POST
  // handler would simply never fire.
  @Get('tick')
  @HttpCode(200)
  @ApiOperation({ summary: 'Scheduler tick — closes the day at the configured hour' })
  async tick(@Headers('authorization') authHeader?: string) {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret) {
      throw new ForbiddenException({
        code: 'CRON_NOT_CONFIGURED',
        message: 'CRON_SECRET is not set — refusing to run an unauthenticated night audit.',
      });
    }
    // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
    if (authHeader !== `Bearer ${secret}`) {
      throw new ForbiddenException({ code: 'BAD_CRON_SECRET', message: 'Invalid cron credentials.' });
    }
    return this.audit.tick();
  }

  @Get('status')
  @RequirePermissions('settings:VIEW')
  @ApiOperation({ summary: 'Close configuration, local time, and the last close' })
  status() {
    return this.audit.status();
  }

  @Get('history')
  @RequirePermissions('reports:VIEW')
  @ApiOperation({ summary: 'Closed days — frozen figures' })
  history(@Query('limit') limit?: string) {
    return this.audit.history(Number(limit) || 30);
  }

  /** Close a day by hand — for a missed night or a manual cut-off. */
  @Post('close')
  @RequirePermissions('reports:EXPORT')
  @HttpCode(200)
  @ApiOperation({ summary: 'Close a business day manually' })
  close(
    @Body(new ZodValidationPipe(closeSchema)) dto: z.infer<typeof closeSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Closing the future would freeze figures for a day that hasn't happened.
    if (new Date(dto.businessDate) > new Date()) {
      throw new BadRequestException({ code: 'FUTURE_DATE', message: 'That day has not happened yet.' });
    }
    return this.audit.close(dto.businessDate, user.id);
  }
}
