import { Module } from '@nestjs/common';
import { ConferencesService } from './conferences.service';
import { ConferencesController } from './conferences.controller';
import { ChargesModule } from '../charges/charges.module';

@Module({
  imports: [ChargesModule],
  controllers: [ConferencesController],
  providers: [ConferencesService],
})
export class ConferencesModule {}
