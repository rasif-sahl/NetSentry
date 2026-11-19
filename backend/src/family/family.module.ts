import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FamilyService } from './family.service';
import { DeviceGuard } from '../devices/other/device.guard';
import {
  FamilyController,
  FamilyDeviceController,
  FamilyPrivacyController,
} from './family.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    FamilyController,
    FamilyDeviceController,
    FamilyPrivacyController,
  ],
  providers: [FamilyService, DeviceGuard],
})
export class FamilyModule {}
