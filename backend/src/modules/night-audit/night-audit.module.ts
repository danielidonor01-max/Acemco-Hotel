import { Module } from '@nestjs/common';
import { NightAuditService } from './night-audit.service';
import { NightAuditController } from './night-audit.controller';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({
  // No-shows are marked through ReservationsService so the cancellation policy
  // (fee, deposit) applies exactly as it would by hand.
  imports: [ReservationsModule],
  controllers: [NightAuditController],
  providers: [NightAuditService],
  exports: [NightAuditService],
})
export class NightAuditModule {}
