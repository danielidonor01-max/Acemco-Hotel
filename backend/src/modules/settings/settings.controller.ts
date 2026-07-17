import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SettingsService } from './settings.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const updateSchema = z.object({
  hotelName: z.string().min(1).optional(),
  tagline: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  // Rate guardrails. A floor of 0 would let a rule give rooms away; a ceiling
  // below the floor makes every rate nonsense.
  rateFloorMultiplier: z.number().min(0.1).max(1).optional(),
  rateCeilingMultiplier: z.number().min(1).max(10).optional(),
  // Cancellation policy.
  cancellationFreeUntilHours: z.number().int().min(0).max(720).optional(),
  cancellationLateFeePercent: z.number().min(0).max(100).optional(),
  noShowFeePercent: z.number().min(0).max(100).optional(),
  depositRefundable: z.boolean().optional(),
}).refine(
  (d) => d.rateFloorMultiplier === undefined || d.rateCeilingMultiplier === undefined || d.rateCeilingMultiplier >= d.rateFloorMultiplier,
  { message: 'The rate ceiling must not be below the floor', path: ['rateCeilingMultiplier'] },
);

@ApiTags('settings')
@Controller('v1/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // Public read so the site can show live hotel profile without auth.
  @Public()
  @Get()
  get() {
    return this.settings.get();
  }

  @Patch()
  @RequirePermissions('settings:UPDATE')
  update(@Body(new ZodValidationPipe(updateSchema)) dto: z.infer<typeof updateSchema>) {
    return this.settings.update(dto);
  }
}
