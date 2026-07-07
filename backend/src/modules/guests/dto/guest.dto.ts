import { z } from 'zod';
import { Title, IdType, GuestTier } from '@prisma/client';

export const createGuestSchema = z.object({
  title: z.nativeEnum(Title).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(3),
  email: z.string().email().optional(),
  nationality: z.string().optional(),
  idType: z.nativeEnum(IdType).optional(),
  idNumber: z.string().optional(),
  isVip: z.boolean().optional(),
});
export type CreateGuestDto = z.infer<typeof createGuestSchema>;

export const updateGuestSchema = createGuestSchema.partial().extend({
  isBlacklisted: z.boolean().optional(),
  tier: z.nativeEnum(GuestTier).optional(),
});
export type UpdateGuestDto = z.infer<typeof updateGuestSchema>;
