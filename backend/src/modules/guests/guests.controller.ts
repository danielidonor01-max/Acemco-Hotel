import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuestsService } from './guests.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { paginationSchema } from '../../common/utils/pagination';
import { createGuestSchema, updateGuestSchema, CreateGuestDto, UpdateGuestDto } from './dto/guest.dto';

@ApiTags('guests')
@Controller('v1/guests')
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get()
  @RequirePermissions('guests:VIEW')
  @ApiOperation({ summary: 'List guests (paginated, searchable)' })
  list(@Query() query: Record<string, string>) {
    const pg = paginationSchema.parse(query);
    return this.guests.list({ ...pg, search: query.search });
  }

  @Get(':id')
  @RequirePermissions('guests:VIEW')
  get(@Param('id') id: string) {
    return this.guests.get(id);
  }

  @Get(':id/profile')
  @RequirePermissions('guests:VIEW')
  @ApiOperation({ summary: 'Guest profile — history, lifetime spend, favourites, loyalty score' })
  profile(@Param('id') id: string) {
    return this.guests.profile(id);
  }

  @Post()
  @RequirePermissions('guests:CREATE')
  create(@Body(new ZodValidationPipe(createGuestSchema)) dto: CreateGuestDto) {
    return this.guests.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('guests:UPDATE')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateGuestSchema)) dto: UpdateGuestDto) {
    return this.guests.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('guests:DELETE')
  archive(@Param('id') id: string) {
    return this.guests.archive(id);
  }
}
