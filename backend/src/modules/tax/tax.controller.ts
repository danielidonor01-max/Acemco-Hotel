import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChargeDepartment } from '@prisma/client';
import { z } from 'zod';
import { TaxService } from './tax.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const taxRateSchema = z.object({
  name: z.string().min(1).max(60),
  code: z.string().min(1).max(20),
  // A negative rate isn't a tax, and >100% is always a typo that would silently
  // multiply every guest's bill.
  rate: z.number().min(0).max(100),
  appliesTo: z.array(z.nativeEnum(ChargeDepartment)).min(1),
  isInclusive: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
const updateTaxRateSchema = taxRateSchema.partial();

@ApiTags('tax')
@Controller('v1/tax')
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  @Get('rates')
  @RequirePermissions('settings:VIEW')
  @ApiOperation({ summary: 'List configured tax rates' })
  list() {
    return this.tax.list();
  }

  @Post('rates')
  @RequirePermissions('settings:UPDATE')
  @ApiOperation({ summary: 'Add a tax rate' })
  create(@Body(new ZodValidationPipe(taxRateSchema)) dto: z.infer<typeof taxRateSchema>) {
    return this.tax.create(dto);
  }

  @Patch('rates/:id')
  @RequirePermissions('settings:UPDATE')
  @ApiOperation({ summary: 'Edit a tax rate' })
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateTaxRateSchema)) dto: z.infer<typeof updateTaxRateSchema>) {
    return this.tax.update(id, dto);
  }

  @Delete('rates/:id')
  @RequirePermissions('settings:UPDATE')
  @ApiOperation({ summary: 'Deactivate a tax rate (never deleted — historical charges cite it)' })
  deactivate(@Param('id') id: string) {
    return this.tax.deactivate(id);
  }

  @Get('report')
  @RequirePermissions('finance:VIEW')
  @ApiOperation({ summary: 'Tax collected per department for a period (VAT return)' })
  report(@Query('from') from: string, @Query('to') to: string) {
    if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
      throw new BadRequestException({ code: 'INVALID_RANGE', message: 'from and to must be YYYY-MM-DD dates.' });
    }
    if (new Date(from) > new Date(to)) {
      throw new BadRequestException({ code: 'INVALID_RANGE', message: '`from` must not be after `to`.' });
    }
    return this.tax.report(from, to);
  }
}
