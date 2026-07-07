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

export const checkOutSchema = z.object({ paymentMethod: z.nativeEnum(PaymentMethod).optional() });
