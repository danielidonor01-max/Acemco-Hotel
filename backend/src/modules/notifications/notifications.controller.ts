import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('notifications')
@Controller('v1/notifications')
export class NotificationsController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  /** The guest's confirmation message + a wa.me link, ready for the desk to send. */
  @Get('reservations/:id/whatsapp/guest')
  @RequirePermissions('reservations:VIEW')
  @ApiOperation({ summary: 'Composed WhatsApp confirmation for the guest' })
  async guest(@Param('id') id: string) {
    const out = await this.whatsapp.guestConfirmation(id);
    if (!out) throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Reservation not found.' });
    return out;
  }

  /** The desk's own copy of the booking (guest number attached), for forwarding. */
  @Get('reservations/:id/whatsapp/desk')
  @RequirePermissions('reservations:VIEW')
  @ApiOperation({ summary: 'Composed booking alert for the hotel line' })
  async desk(@Param('id') id: string) {
    const out = await this.whatsapp.bookingAlert(id);
    if (!out) throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Reservation not found.' });
    return out;
  }
}
