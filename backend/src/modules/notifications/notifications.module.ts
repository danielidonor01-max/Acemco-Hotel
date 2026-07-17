import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { NotificationsController } from './notifications.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [NotificationsController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class NotificationsModule {}
