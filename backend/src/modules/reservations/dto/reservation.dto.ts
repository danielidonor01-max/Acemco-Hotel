import { z } from 'zod';
import { ReservationSource, ReservationType, PaymentMethod } from '@prisma/client';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Expected YYYY-MM-DD');

export const createReservationSchema = z
  .object({
    // Provide an existing guest by id, or guest details to find-or-create.
    guestId: z.string().uuid().optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().min(3).optional(),
    email: z.string().email().optional(),
    // Reservation type + optional corporate account.
    type: z.nativeEnum(ReservationType).default('INDIVIDUAL'),
    companyId: z.string().uuid().optional(),
    // Provide the room type by id or slug.
    roomTypeId: z.string().uuid().optional(),
    roomTypeSlug: z.string().min(1).optional(),
    checkInDate: dateStr,
    checkOutDate: dateStr,
    adults: z.number().int().min(1).default(1),
    children: z.number().int().min(0).default(0),
    source: z.nativeEnum(ReservationSource).default('INTERNAL'),
    specialRequests: z.string().optional(),
    depositAmount: z.number().min(0).optional(),
  })
  .refine((d) => new Date(d.checkOutDate) > new Date(d.checkInDate), {
    message: 'Check-out must be after check-in',
    path: ['checkOutDate'],
  })
  .refine((d) => d.guestId || (d.firstName && d.lastName && d.phone), {
    message: 'Provide a guest id or first name, last name and phone',
    path: ['guestId'],
  })
  .refine((d) => d.roomTypeId || d.roomTypeSlug, {
    message: 'Provide a room type',
    path: ['roomTypeId'],
  });
export type CreateReservationDto = z.infer<typeof createReservationSchema>;

export const publicReservationSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().min(3),
    // Required: this is how the guest receives their confirmation. A booking we
    // can't confirm back to the guest isn't much of a booking.
    whatsapp: z.string().min(7, 'A WhatsApp number is required so we can send your confirmation.'),
    email: z.string().email().optional(),
    roomTypeSlug: z.string().min(1),
    checkInDate: dateStr,
    checkOutDate: dateStr,
    adults: z.number().int().min(1).default(1),
    children: z.number().int().min(0).default(0),
    specialRequests: z.string().optional(),
  })
  .refine((d) => new Date(d.checkOutDate) > new Date(d.checkInDate), {
    message: 'Check-out must be after check-in',
    path: ['checkOutDate'],
  });
export type PublicReservationDto = z.infer<typeof publicReservationSchema>;

export const cancelSchema = z.object({ reason: z.string().optional() });

export const checkInSchema = z.object({ roomId: z.string().uuid().optional() });

// Corporate booking: several rooms/guests created under one company account.
export const corporateBookingSchema = z
  .object({
    companyId: z.string().uuid(),
    checkInDate: dateStr,
    checkOutDate: dateStr,
    guests: z
      .array(
        z.object({
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          phone: z.string().min(3),
          roomTypeSlug: z.string().min(1),
        }),
      )
      .min(1),
  })
  .refine((d) => new Date(d.checkOutDate) > new Date(d.checkInDate), {
    message: 'Check-out must be after check-in',
    path: ['checkOutDate'],
  });
export type CorporateBookingDto = z.infer<typeof corporateBookingSchema>;

export const checkOutSchema = z.object({ paymentMethod: z.nativeEnum(PaymentMethod).optional() });

// Assign (or clear, with null) a specific room to a reservation ahead of check-in.
export const assignRoomSchema = z.object({ roomId: z.string().uuid().nullable() });
export type AssignRoomDto = z.infer<typeof assignRoomSchema>;

// Edit a pending/confirmed reservation — every field optional; the service merges
// with the current values, re-checks availability and recalculates the total.
export const editReservationSchema = z.object({
  roomTypeId: z.string().uuid().optional(),
  roomTypeSlug: z.string().min(1).optional(),
  checkInDate: dateStr.optional(),
  checkOutDate: dateStr.optional(),
  adults: z.number().int().min(1).optional(),
  children: z.number().int().min(0).optional(),
  specialRequests: z.string().optional(),
  type: z.nativeEnum(ReservationType).optional(),
  companyId: z.string().uuid().nullable().optional(),
  depositAmount: z.number().min(0).optional(),
});
export type EditReservationDto = z.infer<typeof editReservationSchema>;
