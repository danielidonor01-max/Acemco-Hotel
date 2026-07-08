import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompanyTier, CompanyStatus, PaymentMethod } from '@prisma/client';
import { z } from 'zod';
import { CompaniesService } from './companies.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.types';
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
const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod).optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Expected YYYY-MM-DD').optional(),
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

  // Declared before ':id' so "aging" isn't captured as a company id.
  @Get('aging')
  @RequirePermissions('finance:VIEW')
  aging() {
    return this.companies.aging();
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

  @Post(':id/payments')
  @RequirePermissions('finance:APPROVE')
  recordPayment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(paymentSchema)) dto: z.infer<typeof paymentSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companies.recordPayment(id, dto, user.id);
  }

  @Post(':id/settle')
  @RequirePermissions('finance:APPROVE')
  settle(@Param('id') id: string) {
    return this.companies.settle(id);
  }
}
