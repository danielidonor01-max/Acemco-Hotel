import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChargesService } from '../charges/charges.service';
import { conferenceNumber } from '../../common/utils/number-generator';

export interface NewConference {
  companyId: string;
  name: string;
  date: string;
  attendees?: number;
  hallFee: number;
  mealsAmount?: number;
  coffeeAmount?: number;
  roomsAmount?: number;
}

/**
 * Conference & Event booking — a lightweight reservation workflow. It doesn't build a
 * full event system; it posts the event's charges (hall, meals, coffee, rooms) to the
 * Charge Ledger against the company, so they flow onto the company invoice.
 */
@Injectable()
export class ConferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly charges: ChargesService,
  ) {}

  async create(dto: NewConference) {
    const count = await this.prisma.chargeLedger.count({ where: { referenceNumber: { startsWith: 'CONF-' }, department: 'CONFERENCE' } });
    const ref = conferenceNumber(count + 1);
    const lines: { department: 'CONFERENCE' | 'RESTAURANT' | 'ROOM'; label: string; amount: number }[] = [
      { department: 'CONFERENCE', label: 'Conference hall', amount: dto.hallFee },
      { department: 'RESTAURANT', label: 'Meals', amount: dto.mealsAmount ?? 0 },
      { department: 'CONFERENCE', label: 'Coffee break', amount: dto.coffeeAmount ?? 0 },
      { department: 'ROOM', label: 'Room allotment', amount: dto.roomsAmount ?? 0 },
    ];
    for (const l of lines) {
      if (l.amount > 0) {
        await this.charges.post({
          companyId: dto.companyId,
          department: l.department,
          sourceModule: 'conferences',
          referenceNumber: ref,
          description: `${dto.name} · ${l.label}`,
          amount: l.amount,
        });
      }
    }
    return { reference: ref, name: dto.name };
  }

  /** Conferences grouped from the ledger (by CONF reference). */
  async list() {
    const rows = await this.prisma.chargeLedger.findMany({
      where: { referenceNumber: { startsWith: 'CONF-' } },
      orderBy: { date: 'desc' },
      include: { company: { select: { id: true, name: true } } },
    });
    const map = new Map<string, { reference: string; name: string; company: string | null; companyId: string | null; date: Date; total: number; status: string }>();
    for (const r of rows) {
      const ref = r.referenceNumber!;
      const eventName = r.description.split(' · ')[0];
      if (!map.has(ref)) map.set(ref, { reference: ref, name: eventName, company: r.company?.name ?? null, companyId: r.company?.id ?? null, date: r.date, total: 0, status: r.status });
      const c = map.get(ref)!;
      c.total += Number(r.amount) + Number(r.tax);
      if (r.status === 'POSTED' || r.status === 'INVOICED') c.status = 'OUTSTANDING';
      else if (c.status !== 'OUTSTANDING') c.status = r.status;
    }
    return [...map.values()];
  }
}
