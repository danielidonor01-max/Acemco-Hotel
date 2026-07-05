import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { PublicRoomsController } from './public-rooms.controller';

@Module({
  controllers: [RoomsController, PublicRoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
