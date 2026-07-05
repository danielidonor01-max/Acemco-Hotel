import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Storefront } from '@prisma/client';
import { OrdersService } from './orders.service';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { publicOrderSchema, PublicOrderDto } from './dto/order.dto';

@ApiTags('public')
@Public()
@Controller('public')
export class PublicOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('menus/:storefront')
  @ApiOperation({ summary: 'Public menu for a storefront (restaurant | lounge)' })
  menu(@Param('storefront') storefront: string) {
    const sf = storefront.toUpperCase();
    if (sf !== 'RESTAURANT' && sf !== 'LOUNGE') {
      throw new BadRequestException({ code: 'INVALID_STOREFRONT', message: 'Unknown storefront.' });
    }
    return this.orders.publicMenu(sf as Storefront);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Place a website order (saved first, then WhatsApp handoff client-side)' })
  create(@Body(new ZodValidationPipe(publicOrderSchema)) dto: PublicOrderDto) {
    return this.orders.createPublic(dto);
  }
}
