import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PayrollStatus } from '@prisma/client';
import { z } from 'zod';
import { PayrollService } from './payroll.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const createSchema = z.object({
  periodName: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  status: z.nativeEnum(PayrollStatus).default('DRAFT'),
  totalGross: z.number().min(0).default(0),
  totalNet: z.number().min(0).default(0),
  headcount: z.number().int().min(0).default(0),
});
const statusSchema = z.object({ status: z.nativeEnum(PayrollStatus) });

@ApiTags('payroll')
@Controller('v1/payroll-periods')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get()
  @RequirePermissions('payroll:VIEW')
  list() {
    return this.payroll.list();
  }

  @Post()
  @RequirePermissions('payroll:CREATE')
  create(@Body(new ZodValidationPipe(createSchema)) dto: z.infer<typeof createSchema>) {
    const { startDate, endDate, ...rest } = dto;
    return this.payroll.create({ ...rest, startDate: new Date(startDate), endDate: new Date(endDate) });
  }

  @Patch(':id')
  @RequirePermissions('payroll:APPROVE')
  setStatus(@Param('id') id: string, @Body(new ZodValidationPipe(statusSchema)) dto: z.infer<typeof statusSchema>) {
    return this.payroll.setStatus(id, dto.status);
  }
}
