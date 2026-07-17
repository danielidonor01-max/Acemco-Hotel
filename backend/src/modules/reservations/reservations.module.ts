import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { PublicReservationsController } from './public-reservations.controller';
import { AvailabilityModule } from '../availability/availability.module';
import { ChargesModule } from '../charges/charges.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [AvailabilityModule, ChargesModule, PricingModule],
  controllers: [ReservationsController, PublicReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
