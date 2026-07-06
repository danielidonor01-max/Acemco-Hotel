import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('dashboard')
@Controller('v1')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // No permission requirement — the dashboard is the landing page for every signed-in role.
  @Get('dashboard/stats')
  stats() {
    return this.dashboard.stats();
  }

  @Get('reports/overview')
  @RequirePermissions('reports:VIEW')
  reportsOverview() {
    return this.dashboard.reportsOverview();
  }
}
