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
});

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
