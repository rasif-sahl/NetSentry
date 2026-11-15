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
  controllers: [IngestionController, ReportController],
  providers: [DeviceGuard, IngestionService, ReportService],
})
export class MonitoringModule {}
