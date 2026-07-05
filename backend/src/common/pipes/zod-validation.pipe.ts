import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Validates request payloads against a Zod schema (Blueprint §11/§12 — schemas
 * are the single source of validation truth, shared in spirit with the frontend).
 * Usage: `@Body(new ZodValidationPipe(createRoomSchema)) dto: CreateRoomDto`
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
