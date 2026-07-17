import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateAdjustment } from '@prisma/client';
import { z } from 'zod';
import { PricingService } from './pricing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const rateRuleSchema = z
  .object({
    name: z.string().min(1).max(60),
    roomTypeId: z.string().uuid().nullable().optional(),
    startDate: dateStr.nullable().optional(),
    endDate: dateStr.nullable().optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
    minOccupancy: z.number().int().min(0).max(100).nullable().optional(),
    maxOccupancy: z.number().int().min(0).max(100).nullable().optional(),
    adjustment: z.nativeEnum(RateAdjustment),
    value: z.number(),
    priority: z.number().int().default(0),
    isActive: z.boolean().default(true),
  })
  .refine((d) => !d.startDate || !d.endDate || new Date(d.endDate) >= new Date(d.startDate), {
    message: 'End date must not be before start date', path: ['endDate'],
  })
  .refine((d) => d.minOccupancy == null || d.maxOccupancy == null || d.maxOccupancy >= d.minOccupancy, {
    message: 'Max occupancy must not be below min occupancy', path: ['maxOccupancy'],
  })
  // A FIXED rate of 0 would give the room away; a negative one is meaningless.
  .refine((d) => d.adjustment !== 'FIXED' || d.value > 0, {
    message: 'A fixed rate must be greater than zero', path: ['value'],
  });
const updateRateRuleSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  roomTypeId: z.string().uuid().nullable().optional(),
  startDate: dateStr.nullable().optional(),
  endDate: dateStr.nullable().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  minOccupancy: z.number().int().min(0).max(100).nullable().optional(),
  maxOccupancy: z.number().int().min(0).max(100).nullable().optional(),
  adjustment: z.nativeEnum(RateAdjustment).optional(),
  value: z.number().optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const toDate = (v?: string | null) => (v === undefined ? undefined : v === null ? null : new Date(v));

@ApiTags('pricing')
@Controller('v1/pricing')
export class PricingController {
  constructor(
    private readonly pricing: PricingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('rules')
  @RequirePermissions('rooms:VIEW')
  @ApiOperation({ summary: 'List rate rules' })
  rules() {
    return this.prisma.rateRule.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: { roomType: { select: { name: true, slug: true } } },
    });
  }

  @Post('rules')
  @RequirePermissions('rooms:UPDATE')
  @ApiOperation({ summary: 'Add a rate rule' })
  create(@Body(new ZodValidationPipe(rateRuleSchema)) dto: z.infer<typeof rateRuleSchema>) {
    return this.prisma.rateRule.create({
      data: { ...dto, startDate: toDate(dto.startDate), endDate: toDate(dto.endDate) },
    });
  }

  @Patch('rules/:id')
  @RequirePermissions('rooms:UPDATE')
  @ApiOperation({ summary: 'Edit a rate rule' })
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(updateRateRuleSchema)) dto: z.infer<typeof updateRateRuleSchema>) {
    if (!(await this.prisma.rateRule.findUnique({ where: { id } }))) {
      throw new NotFoundException({ code: 'RATE_RULE_NOT_FOUND', message: 'Rate rule not found.' });
    }
    return this.prisma.rateRule.update({
      where: { id },
      data: { ...dto, ...(dto.startDate !== undefined ? { startDate: toDate(dto.startDate) } : {}), ...(dto.endDate !== undefined ? { endDate: toDate(dto.endDate) } : {}) },
    });
  }

  @Delete('rules/:id')
  @RequirePermissions('rooms:DELETE')
  @ApiOperation({ summary: 'Remove a rate rule' })
  async remove(@Param('id') id: string) {
    if (!(await this.prisma.rateRule.findUnique({ where: { id } }))) {
      throw new NotFoundException({ code: 'RATE_RULE_NOT_FOUND', message: 'Rate rule not found.' });
    }
    await this.prisma.rateRule.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * What a stay would cost, night by night, and why. Lets staff preview the effect
   * of a rule before it reaches a guest.
   */
  @Get('quote')
  @RequirePermissions('reservations:VIEW')
  @ApiOperation({ summary: 'Preview a priced stay with its per-night breakdown' })
  async quote(
    @Query('roomTypeId') roomTypeId: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
  ) {
    if (!roomTypeId || !checkIn || !checkOut) {
      throw new BadRequestException({ code: 'INVALID_QUOTE', message: 'roomTypeId, checkIn and checkOut are required.' });
    }
    const rt = await this.prisma.roomType.findUnique({ where: { id: roomTypeId } });
    if (!rt) throw new NotFoundException({ code: 'ROOM_TYPE_NOT_FOUND', message: 'Room type not found.' });
    return this.pricing.quote(rt.id, Number(rt.basePrice), checkIn, checkOut);
  }
}
