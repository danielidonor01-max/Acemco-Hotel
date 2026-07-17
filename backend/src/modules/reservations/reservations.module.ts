import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { PublicReservationsController } from './public-reservations.controller';
import { AvailabilityModule } from '../availability/availability.module';
import { ChargesModule } from '../charges/charges.module';

@Module({
  imports: [AvailabilityModule, ChargesModule],
  controllers: [ReservationsController, PublicReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
