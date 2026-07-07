import { Controller, Get, Query } from '@nestjs/common';
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

  @Get('dashboard/brief')
  brief() {
    return this.dashboard.brief();
  }

  @Get('reports/overview')
  @RequirePermissions('reports:VIEW')
  reportsOverview() {
    return this.dashboard.reportsOverview();
  }

  @Get('reports/occupancy')
  @RequirePermissions('reports:VIEW')
  occupancy(@Query('days') days?: string) {
    return this.dashboard.occupancy(Math.min(Number(days) || 30, 365));
  }
}
