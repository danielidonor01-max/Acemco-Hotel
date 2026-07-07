import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { FinanceModule } from '../finance/finance.module';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [FinanceModule, AvailabilityModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
