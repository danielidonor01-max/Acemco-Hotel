import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReservationStatus, PaymentMethod } from '@prisma/client';
import { ReservationsService } from './reservations.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { paginationSchema } from '../../common/utils/pagination';
import { createReservationSchema, cancelSchema, checkInSchema, checkOutSchema, corporateBookingSchema, assignRoomSchema, editReservationSchema, CreateReservationDto, CorporateBookingDto, AssignRoomDto, EditReservationDto } from './dto/reservation.dto';

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

  @Get(':id/available-rooms')
  @RequirePermissions('reservations:VIEW')
  @ApiOperation({ summary: 'Rooms of the booked type, flagged assignable for this stay' })
  availableRooms(@Param('id') id: string) {
    return this.reservations.availableRooms(id);
  }

  @Post(':id/assign-room')
  @RequirePermissions('reservations:UPDATE')
  @ApiOperation({ summary: 'Pre-assign (or clear) a specific room ahead of check-in' })
  assignRoom(@Param('id') id: string, @Body(new ZodValidationPipe(assignRoomSchema)) dto: AssignRoomDto) {
    return this.reservations.assignRoom(id, dto.roomId);
  }

  @Post()
  @RequirePermissions('reservations:CREATE')
  create(
    @Body(new ZodValidationPipe(createReservationSchema)) dto: CreateReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservations.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('reservations:UPDATE')
  @ApiOperation({ summary: 'Edit a pending/confirmed reservation (dates, room type, occupancy)' })
  edit(@Param('id') id: string, @Body(new ZodValidationPipe(editReservationSchema)) dto: EditReservationDto) {
    return this.reservations.edit(id, dto);
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

  @Post('corporate')
  @RequirePermissions('reservations:CREATE')
  @ApiOperation({ summary: 'Corporate booking: several rooms/guests under one company' })
  corporate(
    @Body(new ZodValidationPipe(corporateBookingSchema)) dto: CorporateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservations.corporateBooking(dto, user.id);
  }

  @Post('walk-in')
  @RequirePermissions('reservations:CREATE')
  @ApiOperation({ summary: 'Walk-in: create, confirm and check in a guest in one step' })
  walkIn(
    @Body(new ZodValidationPipe(createReservationSchema)) dto: CreateReservationDto & { roomId?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservations.walkIn(dto, user.id);
  }

  @Post(':id/check-in')
  @RequirePermissions('reservations:UPDATE')
  @ApiOperation({ summary: 'Check in a confirmed reservation (assigns a room, opens a folio)' })
  checkIn(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(checkInSchema)) dto: { roomId?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservations.checkIn(id, dto.roomId, user.id);
  }

  @Post(':id/check-out')
  @RequirePermissions('reservations:UPDATE')
  @ApiOperation({ summary: 'Check out an in-house reservation (settles the folio)' })
  checkOut(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(checkOutSchema)) dto: { paymentMethod?: PaymentMethod },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservations.checkOut(id, user.id, dto.paymentMethod);
  }
}
