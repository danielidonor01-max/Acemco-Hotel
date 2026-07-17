import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupService } from './group.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { groupBookingSchema, cancelSchema, GroupBookingDto } from './dto/reservation.dto';

@ApiTags('reservations')
@Controller('v1/groups')
export class GroupsController {
  constructor(private readonly groups: GroupService) {}

  @Get()
  @RequirePermissions('reservations:VIEW')
  @ApiOperation({ summary: 'List group bookings' })
  list(@Query('limit') limit?: string) {
    return this.groups.list(Number(limit) || 30);
  }

  @Get(':id')
  @RequirePermissions('reservations:VIEW')
  @ApiOperation({ summary: 'A group with its rooms and combined totals' })
  get(@Param('id') id: string) {
    return this.groups.get(id);
  }

  @Post()
  @RequirePermissions('reservations:CREATE')
  @ApiOperation({ summary: 'Create a multi-room group booking (all-or-nothing)' })
  create(@Body(new ZodValidationPipe(groupBookingSchema)) dto: GroupBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.groups.create(dto, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('reservations:UPDATE')
  @ApiOperation({ summary: 'Cancel a whole group (checked-in/out rooms are left alone)' })
  cancel(@Param('id') id: string, @Body(new ZodValidationPipe(cancelSchema)) dto: { reason?: string }, @CurrentUser() user: AuthenticatedUser) {
    return this.groups.cancel(id, dto.reason, user.id);
  }
}
