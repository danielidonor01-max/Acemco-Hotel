import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PublicOrdersController } from './public-orders.controller';
import { FinanceModule } from '../finance/finance.module';
import { FoliosModule } from '../folios/folios.module';
import { TaxModule } from '../tax/tax.module';

@Module({
  imports: [FinanceModule, FoliosModule, TaxModule],
  controllers: [OrdersController, PublicOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
