import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompanyTier, CompanyStatus } from '@prisma/client';
import { z } from 'zod';
import { CompaniesService } from './companies.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const createSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  billingEmail: z.string().email().optional(),
  tier: z.nativeEnum(CompanyTier).default('STANDARD'),
  notes: z.string().optional(),
});
const updateSchema = z.object({
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  billingEmail: z.string().email().optional(),
  tier: z.nativeEnum(CompanyTier).optional(),
  status: z.nativeEnum(CompanyStatus).optional(),
  notes: z.string().optional(),
});

@ApiTags('companies')
@Controller('v1/companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @RequirePermissions('guests:VIEW')
  list() {
    return this.companies.list();
  }

  @Get(':id')
  @RequirePermissions('guests:VIEW')
  get(@Param('id') id: string) {
    return this.companies.get(id);
  }

  @Post()
  @RequirePermissions('guests:CREATE')
  create(@Body(new ZodValidationPipe(createSchema)) dto: z.infer<typeof createSchema>) {
    return this.companies.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('guests:UPDATE')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateSchema)) dto: z.infer<typeof updateSchema>) {
    return this.companies.update(id, dto);
  }

  @Get(':id/invoice')
  @RequirePermissions('finance:VIEW')
  invoice(@Param('id') id: string) {
    return this.companies.invoice(id);
  }

  @Post(':id/settle')
  @RequirePermissions('finance:APPROVE')
  settle(@Param('id') id: string) {
    return this.companies.settle(id);
  }
}
