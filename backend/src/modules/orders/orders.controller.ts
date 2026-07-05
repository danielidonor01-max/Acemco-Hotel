import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderStatus, Storefront } from '@prisma/client';
import { OrdersService } from './orders.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createOrderSchema, CreateOrderDto } from './dto/order.dto';

@ApiTags('orders')
@Controller('v1/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermissions('pos.restaurant:VIEW')
  @ApiOperation({ summary: 'List orders (website + POS + room service)' })
  list(@Query('storefront') storefront?: Storefront, @Query('status') status?: OrderStatus) {
    return this.orders.list({ storefront, status });
  }

  @Get(':id')
  @RequirePermissions('pos.restaurant:VIEW')
  get(@Param('id') id: string) {
    return this.orders.get(id);
  }

  @Post()
  @RequirePermissions('pos.restaurant:CREATE')
  @ApiOperation({ summary: 'Create a POS order' })
  create(@Body(new ZodValidationPipe(createOrderSchema)) dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.create(dto, user.id);
  }

  @Post(':id/advance')
  @RequirePermissions('pos.restaurant:UPDATE')
  @ApiOperation({ summary: 'Advance an order to the next status' })
  advance(@Param('id') id: string) {
    return this.orders.advance(id);
  }

  @Post(':id/cancel')
  @RequirePermissions('pos.restaurant:UPDATE')
  cancel(@Param('id') id: string) {
    return this.orders.cancel(id);
  }
}
