import { Module } from '@nestjs/common';
import { FoliosService } from './folios.service';
import { FoliosController } from './folios.controller';
import { ChargesModule } from '../charges/charges.module';

@Module({
  imports: [ChargesModule],
  controllers: [FoliosController],
  providers: [FoliosService],
  exports: [FoliosService],
})
export class FoliosModule {}
