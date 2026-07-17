import { Module } from '@nestjs/common';
import { CashService } from './cash.service';
import { CashController } from './cash.controller';

@Module({
  controllers: [CashController],
  providers: [CashService],
  // Exported so checkout and POS can attach their cash payments to the open shift.
  exports: [CashService],
})
export class CashModule {}
