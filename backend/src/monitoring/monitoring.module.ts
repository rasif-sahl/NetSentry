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
import { Module, Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceGuard, type DeviceRequest } from '../devices/device.guard';
import { IngestionService } from './ingestion.service';
@Controller({ path: 'devices', version: '1' })
class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}
  @Post(':deviceId/measurements')
  @UseGuards(DeviceGuard)
  ingest(@Req() request: DeviceRequest, @Body() input: unknown) {
    return this.ingestion.ingest(request.monitoringDevice, input);
  }
}
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
