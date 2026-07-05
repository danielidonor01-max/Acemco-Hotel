import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { Public } from '../../common/decorators/public.decorator';

/** Public, unauthenticated room endpoints for the website (Blueprint §4). */
@ApiTags('public')
@Public()
@Controller('public/rooms')
export class PublicRoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'Active room types for the public site' })
  list() {
    return this.rooms.listRoomTypes(true);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Room type detail + availability' })
  async detail(@Param('slug') slug: string) {
    const roomType = await this.rooms.getRoomTypeBySlug(slug);
    const available = await this.rooms.availabilityByType(roomType.id);
    return { ...roomType, available };
  }
}
