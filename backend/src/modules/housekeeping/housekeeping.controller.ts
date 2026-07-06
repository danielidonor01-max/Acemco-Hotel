import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HousekeepingType, HousekeepingStatus, HousekeepingPriority } from '@prisma/client';
import { z } from 'zod';
import { HousekeepingService } from './housekeeping.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const createSchema = z.object({
  roomNumber: z.string().min(1),
  type: z.nativeEnum(HousekeepingType).default('CHECKOUT_CLEAN'),
  priority: z.nativeEnum(HousekeepingPriority).default('NORMAL'),
  assignedTo: z.string().optional(),
});
const updateSchema = z.object({
  status: z.nativeEnum(HousekeepingStatus).optional(),
  priority: z.nativeEnum(HousekeepingPriority).optional(),
  assignedTo: z.string().optional(),
});

@ApiTags('housekeeping')
@Controller('v1/housekeeping')
export class HousekeepingController {
  constructor(private readonly housekeeping: HousekeepingService) {}

  @Get()
  @RequirePermissions('housekeeping:VIEW')
  list() {
    return this.housekeeping.list();
  }

  @Post()
  @RequirePermissions('housekeeping:CREATE')
  create(@Body(new ZodValidationPipe(createSchema)) dto: z.infer<typeof createSchema>) {
    return this.housekeeping.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('housekeeping:UPDATE')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateSchema)) dto: z.infer<typeof updateSchema>) {
    return this.housekeeping.update(id, dto);
  }
}
