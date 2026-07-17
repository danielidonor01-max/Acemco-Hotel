import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Seeded once on first read. These are the hotel's REAL details — this row is the
 * single source of truth for operational contact (the number bookings route to),
 * per the domain rule that the CMS never holds operational data. Edit them in
 * Manage → Settings, never here.
 */
const DEFAULTS = {
  hotelName: 'Acemco Express',
  tagline: 'Holiday Inn',
  phone: '+234 807 712 5775',
  // E.164 without '+' — the form wa.me links require.
  whatsapp: '2348077125775',
  email: '',
  address: '12 Marina Crescent',
  city: 'Warri, Delta State, Nigeria',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Singleton row keyed 'hotel'. Created on first read with sensible defaults. */
  get() {
    return this.prisma.setting.upsert({
      where: { id: 'hotel' },
      update: {},
      create: { id: 'hotel', ...DEFAULTS },
    });
  }

  async update(dto: Prisma.SettingUpdateInput) {
    await this.get();
    return this.prisma.setting.update({ where: { id: 'hotel' }, data: dto });
  }
}
