import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { assertValidDateSpan } from '../../common/utils/date-span';

@ApiTags('availability')
@Controller('v1/availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  @RequirePermissions('reservations:VIEW')
  @ApiOperation({ summary: 'Room-type availability for a date span' })
  byType(@Query('checkIn') checkIn: string, @Query('checkOut') checkOut: string) {
    assertValidDateSpan(checkIn, checkOut);
    return this.availability.byType(checkIn, checkOut);
  }

  @Get('rooms')
  @RequirePermissions('reservations:VIEW')
  @ApiOperation({ summary: 'Assignable physical rooms of a type for a date span' })
  rooms(
    @Query('roomTypeId') roomTypeId: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('exclude') exclude?: string,
  ) {
    if (!roomTypeId) throw new BadRequestException({ code: 'PARAMS_REQUIRED', message: 'roomTypeId is required.' });
    assertValidDateSpan(checkIn, checkOut);
    return this.availability.rooms(roomTypeId, checkIn, checkOut, exclude);
  }

  @Get('calendar')
  @RequirePermissions('reservations:VIEW')
  @ApiOperation({ summary: 'Per-type free-room count for the next N days' })
  calendar(@Query('days') days?: string) {
    return this.availability.calendar(days ? Number(days) : 14);
  }
}
