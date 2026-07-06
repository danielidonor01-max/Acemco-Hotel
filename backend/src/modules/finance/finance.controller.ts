import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TransactionType, TransactionDirection, TransactionStatus } from '@prisma/client';
import { z } from 'zod';
import { FinanceService } from './finance.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const createSchema = z.object({
  type: z.nativeEnum(TransactionType),
  amount: z.number().min(0),
  direction: z.nativeEnum(TransactionDirection),
  account: z.string().min(1),
  description: z.string().min(1),
  date: z.string(),
  status: z.nativeEnum(TransactionStatus).default('PENDING'),
});
const statusSchema = z.object({ status: z.nativeEnum(TransactionStatus) });

@ApiTags('finance')
@Controller('v1/finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  @RequirePermissions('finance:VIEW')
  summary() {
    return this.finance.summary();
  }

  @Get('transactions')
  @RequirePermissions('finance:VIEW')
  list(@Query('type') type?: TransactionType, @Query('status') status?: TransactionStatus) {
    return this.finance.list({ type, status });
  }

  @Post('transactions')
  @RequirePermissions('finance:CREATE')
  create(@Body(new ZodValidationPipe(createSchema)) dto: z.infer<typeof createSchema>) {
    return this.finance.create(dto);
  }

  @Patch('transactions/:id')
  @RequirePermissions('finance:APPROVE')
  setStatus(@Param('id') id: string, @Body(new ZodValidationPipe(statusSchema)) dto: z.infer<typeof statusSchema>) {
    return this.finance.setStatus(id, dto.status);
  }
}
