import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ConferencesService } from './conferences.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const createSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  date: z.string(),
  attendees: z.number().int().min(0).optional(),
  hallFee: z.number().min(0),
  mealsAmount: z.number().min(0).optional(),
  coffeeAmount: z.number().min(0).optional(),
  roomsAmount: z.number().min(0).optional(),
});

@ApiTags('conferences')
@Controller('v1/conferences')
export class ConferencesController {
  constructor(private readonly conferences: ConferencesService) {}

  @Get()
  @RequirePermissions('reservations:VIEW')
  list() {
    return this.conferences.list();
  }

  @Post()
  @RequirePermissions('reservations:CREATE')
  create(@Body(new ZodValidationPipe(createSchema)) dto: z.infer<typeof createSchema>) {
    return this.conferences.create(dto);
  }
}
