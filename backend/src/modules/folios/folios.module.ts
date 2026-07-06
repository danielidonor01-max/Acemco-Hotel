import { Module } from '@nestjs/common';
import { FoliosService } from './folios.service';
import { FoliosController } from './folios.controller';

@Module({
  controllers: [FoliosController],
  providers: [FoliosService],
  exports: [FoliosService],
})
export class FoliosModule {}
