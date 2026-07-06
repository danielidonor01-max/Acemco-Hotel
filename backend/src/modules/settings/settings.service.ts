import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULTS = {
  hotelName: 'Acemco Express',
  tagline: 'Holiday Inn',
  phone: '+234 800 000 0000',
  whatsapp: '2348000000000',
  email: 'reservations@acemcohotel.com',
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
