import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceController, DisclosureController } from './device.controller';
import { DeviceService } from './device.service';
import { DeviceGuard } from './device.guard';
@Module({
  imports: [AuthModule],
  controllers: [DeviceController, DisclosureController],
  providers: [DeviceService, DeviceGuard],
  exports: [DeviceService],
})
export class DeviceModule {}
