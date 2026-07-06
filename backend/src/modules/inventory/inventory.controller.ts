import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InventoryDepartment } from '@prisma/client';
import { z } from 'zod';
import { InventoryService } from './inventory.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const createSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  department: z.nativeEnum(InventoryDepartment).default('GENERAL'),
  unit: z.string().min(1),
  currentQty: z.number().int().min(0).default(0),
  minStockLevel: z.number().int().min(0).default(0),
  unitCost: z.number().min(0).default(0),
  location: z.string().optional(),
});
const updateSchema = createSchema.partial().omit({ sku: true });

@ApiTags('inventory')
@Controller('v1/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermissions('inventory:VIEW')
  list(@Query('department') department?: InventoryDepartment) {
    return this.inventory.list(department);
  }

  @Post()
  @RequirePermissions('inventory:CREATE')
  create(@Body(new ZodValidationPipe(createSchema)) dto: z.infer<typeof createSchema>) {
    return this.inventory.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('inventory:UPDATE')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateSchema)) dto: z.infer<typeof updateSchema>) {
    return this.inventory.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('inventory:UPDATE')
  remove(@Param('id') id: string) {
    return this.inventory.remove(id);
  }
}
