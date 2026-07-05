import { z } from 'zod';
import { ReservationSource } from '@prisma/client';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Expected YYYY-MM-DD');

export const createReservationSchema = z
  .object({
    guestId: z.string().uuid(),
    roomTypeId: z.string().uuid(),
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
