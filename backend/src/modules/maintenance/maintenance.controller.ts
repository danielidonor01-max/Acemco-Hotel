import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssetStatus, AssetArea, WorkOrderType, WorkOrderPriority, WorkOrderStatus } from '@prisma/client';
import { z } from 'zod';
import { MaintenanceService } from './maintenance.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const createAssetSchema = z.object({
  assetNumber: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  area: z.nativeEnum(AssetArea).default('OTHER'),
  roomNumber: z.string().optional(),
  location: z.string().min(1),
  status: z.nativeEnum(AssetStatus).default('OPERATIONAL'),
  nextInspection: z.string().optional(),
});
const updateAssetSchema = z.object({
  status: z.nativeEnum(AssetStatus).optional(),
  area: z.nativeEnum(AssetArea).optional(),
  roomNumber: z.string().optional(),
  nextInspection: z.string().optional(),
  location: z.string().optional(),
});
const createWorkOrderSchema = z.object({
  assetId: z.string().uuid().optional(),
  type: z.nativeEnum(WorkOrderType).default('CORRECTIVE'),
  priority: z.nativeEnum(WorkOrderPriority).default('NORMAL'),
  assignedTo: z.string().optional(),
  estimatedCost: z.number().min(0).default(0),
});
const updateWorkOrderSchema = z.object({
  status: z.nativeEnum(WorkOrderStatus).optional(),
  priority: z.nativeEnum(WorkOrderPriority).optional(),
  assignedTo: z.string().optional(),
  estimatedCost: z.number().min(0).optional(),
});

@ApiTags('maintenance')
@Controller('v1')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get('assets')
  @RequirePermissions('maintenance:VIEW')
  listAssets() {
    return this.maintenance.listAssets();
  }

  @Post('assets')
  @RequirePermissions('maintenance:CREATE')
  createAsset(@Body(new ZodValidationPipe(createAssetSchema)) dto: z.infer<typeof createAssetSchema>) {
    const { nextInspection, ...rest } = dto;
    return this.maintenance.createAsset({ ...rest, nextInspection: nextInspection ? new Date(nextInspection) : null });
  }

  @Patch('assets/:id')
  @RequirePermissions('maintenance:UPDATE')
  updateAsset(@Param('id') id: string, @Body(new ZodValidationPipe(updateAssetSchema)) dto: z.infer<typeof updateAssetSchema>) {
    const { nextInspection, ...rest } = dto;
    return this.maintenance.updateAsset(id, { ...rest, ...(nextInspection ? { nextInspection: new Date(nextInspection) } : {}) });
  }

  @Get('work-orders')
  @RequirePermissions('maintenance:VIEW')
  listWorkOrders() {
    return this.maintenance.listWorkOrders();
  }

  @Post('work-orders')
  @RequirePermissions('maintenance:CREATE')
  createWorkOrder(@Body(new ZodValidationPipe(createWorkOrderSchema)) dto: z.infer<typeof createWorkOrderSchema>) {
    return this.maintenance.createWorkOrder(dto);
  }

  @Patch('work-orders/:id')
  @RequirePermissions('maintenance:UPDATE')
  updateWorkOrder(@Param('id') id: string, @Body(new ZodValidationPipe(updateWorkOrderSchema)) dto: z.infer<typeof updateWorkOrderSchema>) {
    return this.maintenance.updateWorkOrder(id, dto);
  }
}
