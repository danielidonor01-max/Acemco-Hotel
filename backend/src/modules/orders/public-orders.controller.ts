import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Storefront } from '@prisma/client';
import { OrdersService } from './orders.service';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { publicOrderSchema, PublicOrderDto, verifyGuestSchema, VerifyGuestDto } from './dto/order.dto';

@ApiTags('public')
@Public()
@Controller('public')
export class PublicOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('menus/:storefront')
  @ApiOperation({ summary: 'Public menu for a storefront (restaurant | lounge | boutique)' })
  menu(@Param('storefront') storefront: string) {
    const sf = storefront.toUpperCase();
    if (sf !== 'RESTAURANT' && sf !== 'LOUNGE' && sf !== 'BOUTIQUE') {
      throw new BadRequestException({ code: 'INVALID_STOREFRONT', message: 'Unknown storefront.' });
    }
    return this.orders.publicMenu(sf as Storefront);
  }

  // Unauthenticated and answers "is <surname> staying in room <n>?" — throttle it so
  // it can't be used to enumerate who is in the hotel.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('verify-guest')
  @ApiOperation({ summary: 'Confirm the requester is a checked-in guest before ordering' })
  verify(@Body(new ZodValidationPipe(verifyGuestSchema)) dto: VerifyGuestDto) {
    return this.orders.verifyInHouse(dto.roomNumber, dto.lastName);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Place a room-service order (verified in-house guest only)' })
  create(@Body(new ZodValidationPipe(publicOrderSchema)) dto: PublicOrderDto) {
    return this.orders.createPublic(dto);
  }
}
