import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChargeDepartment, ChargeStatus } from '@prisma/client';
import { z } from 'zod';
import { ChargesService } from './charges.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const postSchema = z.object({
  reservationId: z.string().uuid().optional(),
  guestId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  department: z.nativeEnum(ChargeDepartment),
  description: z.string().min(1),
  amount: z.number(),
  tax: z.number().min(0).optional(),
});

@ApiTags('charges')
@Controller('v1/charges')
export class ChargesController {
  constructor(private readonly charges: ChargesService) {}

  @Get()
  @RequirePermissions('finance:VIEW')
  list(
    @Query('companyId') companyId?: string,
    @Query('guestId') guestId?: string,
    @Query('reservationId') reservationId?: string,
    @Query('status') status?: ChargeStatus,
  ) {
    return this.charges.list({ companyId, guestId, reservationId, status });
  }

  @Post()
  @RequirePermissions('reservations:UPDATE')
  post(@Body(new ZodValidationPipe(postSchema)) dto: z.infer<typeof postSchema>) {
    return this.charges.post({ ...dto, sourceModule: 'manual' });
  }

  @Patch(':id/void')
  @RequirePermissions('finance:APPROVE')
  void(@Param('id') id: string) {
    return this.charges.void(id);
  }
}
