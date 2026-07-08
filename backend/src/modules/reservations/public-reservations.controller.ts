import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { AvailabilityService } from '../availability/availability.service';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { publicReservationSchema, PublicReservationDto } from './dto/reservation.dto';

@ApiTags('public')
@Public()
@Controller('public')
export class PublicReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly availability: AvailabilityService,
  ) {}

  /**
   * Public availability check — no authentication required.
   * Returns per-room-type counts for a requested date span so guests can
   * see what is free before submitting a reservation request.
   */
  @Get('availability')
  @ApiOperation({ summary: 'Public availability by room type for a date span' })
  checkAvailability(
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
  ) {
    if (!checkIn || !checkOut)
      throw new BadRequestException({ code: 'DATES_REQUIRED', message: 'checkIn and checkOut are required.' });
    if (new Date(checkOut) <= new Date(checkIn))
      throw new BadRequestException({ code: 'INVALID_DATES', message: 'checkOut must be after checkIn.' });
    return this.availability.byType(checkIn, checkOut);
  }

  /**
   * Submit a reservation request from the public website.
   * Creates a PENDING reservation — no payment taken.
   */
  @Post('reservations')
  @ApiOperation({ summary: 'Submit a reservation request from the website' })
  create(@Body(new ZodValidationPipe(publicReservationSchema)) dto: PublicReservationDto) {
    return this.reservations.createPublic(dto);
  }
}
