import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { PublicReservationsController } from './public-reservations.controller';
import { AvailabilityModule } from '../availability/availability.module';
import { ChargesModule } from '../charges/charges.module';
import { PricingModule } from '../pricing/pricing.module';
import { FinanceModule } from '../finance/finance.module';
import { CancellationService } from './cancellation.service';

@Module({
  imports: [AvailabilityModule, ChargesModule, PricingModule, FinanceModule],
  controllers: [ReservationsController, PublicReservationsController],
  providers: [ReservationsService, CancellationService],
  exports: [ReservationsService, CancellationService],
})
export class ReservationsModule {}
