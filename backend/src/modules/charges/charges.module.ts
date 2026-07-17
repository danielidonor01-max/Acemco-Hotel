import { Module } from '@nestjs/common';
import { ChargesService } from './charges.service';
import { ChargesController } from './charges.controller';
import { TaxModule } from '../tax/tax.module';

@Module({
  // Tax is computed inside ChargesService.post — the one entry point every module bills through.
  imports: [TaxModule],
  controllers: [ChargesController],
  providers: [ChargesService],
  exports: [ChargesService],
})
export class ChargesModule {}
