import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';
import { ReservationsService } from './reservations.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { paginationSchema } from '../../common/utils/pagination';
import { createReservationSchema, cancelSchema, CreateReservationDto } from './dto/reservation.dto';

@ApiTags('reservations')
@Controller('v1/reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  @RequirePermissions('reservations:VIEW')
  @ApiOperation({ summary: 'List reservations' })
  list(@Query() query: Record<string, string>) {
    const pg = paginationSchema.parse(query);
    return this.reservations.list({ ...pg, status: query.status as ReservationStatus | undefined });
  }

  @Get(':id')
  @RequirePermissions('reservations:VIEW')
  get(@Param('id') id: string) {
    return this.reservations.get(id);
  }

  @Post()
  @RequirePermissions('reservations:CREATE')
  create(
    @Body(new ZodValidationPipe(createReservationSchema)) dto: CreateReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservations.create(dto, user.id);
  }

  @Post(':id/confirm')
  @RequirePermissions('reservations:APPROVE')
  @ApiOperation({ summary: 'Confirm a pending reservation' })
  confirm(@Param('id') id: string) {
    return this.reservations.confirm(id);
  }

  @Post(':id/cancel')
  @RequirePermissions('reservations:UPDATE')
  @ApiOperation({ summary: 'Cancel a reservation' })
  cancel(@Param('id') id: string, @Body(new ZodValidationPipe(cancelSchema)) dto: { reason?: string }) {
    return this.reservations.cancel(id, dto.reason);
  }
}
