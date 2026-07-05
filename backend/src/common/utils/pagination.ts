import { z } from 'zod';
import { PaginationMeta } from '../types/api-response.types';

/** Standard pagination query (Blueprint §11). */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;

export function buildMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, meta: buildMeta(total, page, pageSize) };
}
