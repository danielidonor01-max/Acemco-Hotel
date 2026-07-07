import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChargeDepartment } from '@prisma/client';
import { z } from 'zod';
import { FoliosService } from './folios.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const lineSchema = z.object({
  description: z.string().min(1),
  amount: z.number(),
  type: z.nativeEnum(ChargeDepartment).default('SERVICE'),
});

@ApiTags('folios')
@Controller('v1/folios')
export class FoliosController {
  constructor(private readonly folios: FoliosService) {}

  @Get('reservation/:reservationId')
  @RequirePermissions('reservations:VIEW')
  byReservation(@Param('reservationId') reservationId: string) {
    return this.folios.byReservation(reservationId);
  }

  @Post(':folioId/lines')
  @RequirePermissions('reservations:UPDATE')
  addLine(@Param('folioId') folioId: string, @Body(new ZodValidationPipe(lineSchema)) dto: z.infer<typeof lineSchema>) {
    return this.folios.addLine(folioId, dto);
  }
}
