import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { PublicRoomsController } from './public-rooms.controller';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  // Rooms reads availability from the one engine rather than re-deriving it.
  imports: [AvailabilityModule],
  controllers: [RoomsController, PublicRoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
