import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { publicReservationSchema, PublicReservationDto } from './dto/reservation.dto';

@ApiTags('public')
@Public()
@Controller('public/reservations')
export class PublicReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a reservation request from the website' })
  create(@Body(new ZodValidationPipe(publicReservationSchema)) dto: PublicReservationDto) {
    return this.reservations.createPublic(dto);
  }
}
