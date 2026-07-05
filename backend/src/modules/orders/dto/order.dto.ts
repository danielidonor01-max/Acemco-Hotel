import { z } from 'zod';
import { Storefront, OrderSource } from '@prisma/client';

const line = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  storefront: z.nativeEnum(Storefront),
  source: z.nativeEnum(OrderSource).default('INTERNAL_POS'),
  items: z.array(line).min(1),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  roomNumber: z.string().optional(),
  tableNumber: z.string().optional(),
  deliveryLocation: z.string().optional(),
  specialInstructions: z.string().optional(),
});
export type CreateOrderDto = z.infer<typeof createOrderSchema>;

export const publicOrderSchema = z.object({
  storefront: z.enum(['RESTAURANT', 'LOUNGE']),
  items: z.array(line).min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(3),
  roomNumber: z.string().optional(),
  deliveryLocation: z.string().optional(),
  specialInstructions: z.string().optional(),
});
export type PublicOrderDto = z.infer<typeof publicOrderSchema>;
