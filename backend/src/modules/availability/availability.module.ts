import { Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  // Availability quotes the price, so it must quote through the same engine that bills.
  imports: [PricingModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
