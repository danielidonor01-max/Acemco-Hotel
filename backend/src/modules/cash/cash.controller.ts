import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CashDirection, CashStation, PaymentMethod } from '@prisma/client';
import { z } from 'zod';
import { CashService } from './cash.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const openSchema = z.object({
  station: z.nativeEnum(CashStation),
  openingFloat: z.number().min(0),
});
const movementSchema = z.object({
  direction: z.nativeEnum(CashDirection),
  amount: z.number().positive(),
  reason: z.string().min(1).max(200),
  method: z.nativeEnum(PaymentMethod).optional(),
});
const closeSchema = z.object({
  countedCash: z.number().min(0),
  notes: z.string().max(500).optional(),
});

@ApiTags('cash')
@Controller('v1/cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('shifts')
  @RequirePermissions('cash:VIEW')
  @ApiOperation({ summary: 'Recent cash shifts' })
  list(@Query('limit') limit?: string) {
    return this.cash.list(Number(limit) || 30);
  }

  @Get('shifts/open')
  @RequirePermissions('cash:VIEW')
  @ApiOperation({ summary: 'Currently open shifts across all stations' })
  open() {
    return this.cash.openShifts();
  }

  @Get('unattributed')
  @RequirePermissions('cash:VIEW')
  @ApiOperation({ summary: 'Cash taken while no shift was open — a reconciliation gap' })
  unattributed() {
    return this.cash.unattributed();
  }

  @Get('shifts/:id')
  @RequirePermissions('cash:VIEW')
  @ApiOperation({ summary: 'Shift detail with movements and method breakdown' })
  detail(@Param('id') id: string) {
    return this.cash.shiftDetail(id);
  }

  @Post('shifts')
  @RequirePermissions('cash:CREATE')
  @ApiOperation({ summary: 'Open a drawer shift with a float' })
  openShift(@Body(new ZodValidationPipe(openSchema)) dto: z.infer<typeof openSchema>, @CurrentUser() user: AuthenticatedUser) {
    return this.cash.openShift(dto.station, dto.openingFloat, user.id);
  }

  @Post('shifts/:id/movements')
  @RequirePermissions('cash:CREATE')
  @ApiOperation({ summary: 'Record a manual movement (payout, drop, correction)' })
  movement(@Param('id') id: string, @Body(new ZodValidationPipe(movementSchema)) dto: z.infer<typeof movementSchema>, @CurrentUser() user: AuthenticatedUser) {
    return this.cash.recordMovement(id, { ...dto, userId: user.id });
  }

  @Post('shifts/:id/close')
  @RequirePermissions('cash:CREATE')
  @ApiOperation({ summary: 'Close the drawer with a physical count' })
  close(@Param('id') id: string, @Body(new ZodValidationPipe(closeSchema)) dto: z.infer<typeof closeSchema>, @CurrentUser() user: AuthenticatedUser) {
    return this.cash.closeShift(id, dto.countedCash, user.id, dto.notes);
  }
}
