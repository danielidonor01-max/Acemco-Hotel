import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';
import { z } from 'zod';
import { RoomsService } from './rooms.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const updateStatusSchema = z.object({ status: z.nativeEnum(RoomStatus) });

const createRoomTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  bedConfiguration: z.string().optional(),
  maxOccupancy: z.number().int().min(1).optional(),
  basePrice: z.number().min(0).optional(),
  features: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
const updateRoomTypeSchema = createRoomTypeSchema.partial();
type RoomTypeDto = z.infer<typeof createRoomTypeSchema>;

const createRoomsBulkSchema = z.object({
  roomNumbers: z.array(z.string().min(1)).min(1),
  floor: z.number().int(),
  roomTypeId: z.string().uuid(),
  notes: z.string().optional(),
});

const updateRoomSchema = z.object({
  roomNumber: z.string().min(1).optional(),
  floor: z.number().int().optional(),
  roomTypeId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

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

  @Post('rooms/bulk')
  @RequirePermissions('rooms:CREATE')
  @ApiOperation({ summary: 'Create physical rooms in bulk' })
  createRoomsBulk(@Body(new ZodValidationPipe(createRoomsBulkSchema)) dto: z.infer<typeof createRoomsBulkSchema>) {
    return this.rooms.createRoomsBulk(dto);
  }

  @Patch('rooms/:id')
  @RequirePermissions('rooms:UPDATE')
  @ApiOperation({ summary: 'Update physical room details' })
  updateRoom(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRoomSchema)) dto: z.infer<typeof updateRoomSchema>,
  ) {
    return this.rooms.updateRoom(id, dto);
  }

  @Delete('rooms/:id')
  @RequirePermissions('rooms:DELETE')
  @ApiOperation({ summary: 'Deactivate a physical room' })
  deactivateRoom(@Param('id') id: string) {
    return this.rooms.deactivateRoom(id);
  }

  @Get('room-types')
  @RequirePermissions('rooms:VIEW')
  @ApiOperation({ summary: 'List room types (with room/reservation counts)' })
  listRoomTypes() {
    return this.rooms.listRoomTypes();
  }

  @Post('room-types')
  @RequirePermissions('rooms:CREATE')
  @ApiOperation({ summary: 'Create a room type/category (slug generated from name)' })
  createRoomType(@Body(new ZodValidationPipe(createRoomTypeSchema)) dto: RoomTypeDto) {
    return this.rooms.createRoomType(dto);
  }

  @Patch('room-types/:id')
  @RequirePermissions('rooms:UPDATE')
  @ApiOperation({ summary: 'Update a room type (slug is immutable)' })
  updateRoomType(@Param('id') id: string, @Body(new ZodValidationPipe(updateRoomTypeSchema)) dto: Partial<RoomTypeDto>) {
    return this.rooms.updateRoomType(id, dto);
  }

  @Delete('room-types/:id')
  @RequirePermissions('rooms:DELETE')
  @ApiOperation({ summary: 'Delete a room type (blocked if rooms/reservations use it)' })
  deleteRoomType(@Param('id') id: string) {
    return this.rooms.deleteRoomType(id);
  }
}
