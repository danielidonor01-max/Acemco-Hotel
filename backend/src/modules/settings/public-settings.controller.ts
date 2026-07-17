import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * The hotel's contact details for the website (Blueprint §4).
 *
 * This is the single source of truth for phone/WhatsApp/email. The public site
 * used to read them from Sanity as well, so the same fact lived in two places and
 * a placeholder number stayed live while the real one sat here. Operational data
 * belongs to the API; the CMS keeps the marketing copy.
 */
@ApiTags('public')
@Public()
@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Hotel profile + contact details for the public site' })
  async get() {
    const s = await this.settings.get();
    // Only what the website renders — never the internal row wholesale.
    return {
      hotelName: s.hotelName,
      tagline: s.tagline,
      phone: s.phone,
      whatsapp: s.whatsapp,
      email: s.email,
      address: s.address,
      city: s.city,
    };
  }
}
