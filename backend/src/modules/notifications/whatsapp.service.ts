import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { toWhatsAppNumber, waLink } from '../../common/utils/phone';

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');
const day = (d: Date) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

/**
 * WhatsApp messaging — currently link-based (no cost, no Meta account).
 *
 * Business-initiated WhatsApp messages need the Meta Cloud API and an approved
 * template, which the hotel hasn't set up yet. Until then this composes the
 * message and returns a `wa.me` deep link that a human opens and sends:
 *   - `bookingAlert()`  → the hotel's own line, so the desk sees every booking
 *                         with the guest's number attached and can forward it on.
 *   - `guestConfirmation()` → the guest's line, one click from the reservation.
 *
 * The message bodies are the real thing, so when the Cloud API is connected only
 * the transport changes: swap the link for a POST and these stay as the template
 * bodies.
 */
@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private async reservationContext(reservationId: string) {
    const r = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, roomType: true, room: true },
    });
    if (!r) return null;
    const hotel = await this.settings.get();
    const nights = Math.max(
      1,
      Math.round((+new Date(r.checkOutDate) - +new Date(r.checkInDate)) / 86_400_000),
    );
    return { r, hotel, nights };
  }

  /**
   * The desk's copy of a new booking: everything needed to act on it, including
   * the guest's WhatsApp number so it can be forwarded without looking anything up.
   */
  async bookingAlert(reservationId: string) {
    const ctx = await this.reservationContext(reservationId);
    if (!ctx) return null;
    const { r, hotel, nights } = ctx;
    const g = r.guest;

    const lines = [
      `*NEW BOOKING · ${r.reservationNumber}*`,
      '',
      `*Guest:* ${g.firstName} ${g.lastName}`,
      `*WhatsApp:* ${g.whatsapp ? '+' + g.whatsapp : '— not provided —'}`,
      `*Phone:* ${g.phone}`,
      ...(g.email ? [`*Email:* ${g.email}`] : []),
      '',
      `*Room:* ${r.roomType?.name ?? '—'}${r.room ? ` (Room ${r.room.roomNumber})` : ''}`,
      `*Check-in:* ${day(r.checkInDate)}`,
      `*Check-out:* ${day(r.checkOutDate)}`,
      `*Nights:* ${nights}`,
      `*Guests:* ${r.adults} adult(s)${r.children ? `, ${r.children} child(ren)` : ''}`,
      `*Total:* ${naira(Number(r.totalAmount))}`,
      `*Status:* ${r.status}`,
      `*Source:* ${r.source}`,
      ...(r.specialRequests ? ['', `*Requests:* ${r.specialRequests}`] : []),
      '',
      `— ${hotel.hotelName}`,
    ];
    const message = lines.join('\n');
    const to = toWhatsAppNumber(hotel.whatsapp);
    return { to, message, link: to ? waLink(to, message) : null };
  }

  /**
   * The guest's confirmation, ready to send from the reservation in one click.
   * Deliberately says no payment has been taken — the booking is a request the
   * hotel confirms, and implying otherwise would be a promise we can't keep.
   */
  async guestConfirmation(reservationId: string) {
    const ctx = await this.reservationContext(reservationId);
    if (!ctx) return null;
    const { r, hotel, nights } = ctx;
    const g = r.guest;

    const lines = [
      `Hello ${g.firstName}, thank you for booking with *${hotel.hotelName}*.`,
      '',
      `*Reference:* ${r.reservationNumber}`,
      `*Room:* ${r.roomType?.name ?? '—'}${r.room ? ` · Room ${r.room.roomNumber}` : ''}`,
      `*Check-in:* ${day(r.checkInDate)} (from 2:00 PM)`,
      `*Check-out:* ${day(r.checkOutDate)} (by 12:00 noon)`,
      `*Nights:* ${nights}`,
      `*Guests:* ${r.adults} adult(s)${r.children ? `, ${r.children} child(ren)` : ''}`,
      `*Total:* ${naira(Number(r.totalAmount))}`,
      ...(Number(r.depositAmount) > 0 ? [`*Deposit paid:* ${naira(Number(r.depositAmount))}`] : []),
      '',
      r.status === 'CONFIRMED'
        ? 'Your reservation is *confirmed*. We look forward to welcoming you.'
        : 'We have received your request and will confirm your room shortly.',
      '',
      `${hotel.address}, ${hotel.city}`,
      ...(hotel.phone ? [`Reception: ${hotel.phone}`] : []),
      '',
      'Please keep this message — quote your reference on arrival.',
    ];
    const message = lines.join('\n');
    const to = g.whatsapp ? toWhatsAppNumber(g.whatsapp) : toWhatsAppNumber(g.phone);
    return { to, message, link: to ? waLink(to, message) : null };
  }
}
