import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';
import { z } from 'zod';
import { RoomsService } from './rooms.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const updateStatusSchema = z.object({ status: z.nativeEnum(RoomStatus) });

@ApiTags('rooms')
@Controller('v1')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get('rooms')
  @RequirePermissions('rooms:VIEW')
  @ApiOperation({ summary: 'List rooms' })
  listRooms(@Query('status') status?: RoomStatus) {
    return this.rooms.listRooms(status);
  }

  @Get('rooms/:id')
  @RequirePermissions('rooms:VIEW')
  getRoom(@Param('id') id: string) {
    return this.rooms.getRoom(id);
  }

  @Get('rooms/:id/detail')
  @RequirePermissions('rooms:VIEW')
  @ApiOperation({ summary: 'Room detail: occupant, housekeeping, assets + open maintenance' })
  getRoomDetail(@Param('id') id: string) {
    return this.rooms.getRoomDetail(id);
  }

  @Patch('rooms/:id/status')
  @RequirePermissions('rooms:UPDATE')
  @ApiOperation({ summary: 'Change a room status' })
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStatusSchema)) dto: { status: RoomStatus },
  ) {
    return this.rooms.updateStatus(id, dto.status);
  }

  @Get('room-types')
  @RequirePermissions('rooms:VIEW')
  @ApiOperation({ summary: 'List room types' })
  listRoomTypes() {
    return this.rooms.listRoomTypes();
  }
}
