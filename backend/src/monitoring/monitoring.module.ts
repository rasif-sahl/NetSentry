import { ApplicationService } from './application.service';
import {
  ApplicationController,
  ApplicationIngestionController,
} from './application.controller';
import {
  AlertController,
  NotificationPreferenceController,
} from './alert.controller';
import { AlertService } from './alert.service';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceGuard } from '../devices/other/device.guard';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    ApplicationController,
    ApplicationIngestionController,
    IngestionController,
    ReportController,
    AlertController,
    NotificationPreferenceController,
  ],
  providers: [
    ApplicationService,
    DeviceGuard,
    IngestionService,
    ReportService,
    AlertService,
  ],
})
export class MonitoringModule {}
