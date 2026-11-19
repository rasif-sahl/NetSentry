import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { DeviceGuard, type DeviceRequest } from '../devices/other/device.guard';
import { IngestionService } from './ingestion.service';

@Controller({ path: 'devices', version: '1' })
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}
  @Post(':deviceId/measurements')
  @UseGuards(DeviceGuard)
  ingest(@Req() request: DeviceRequest, @Body() input: unknown) {
    return this.ingestion.ingest(request.monitoringDevice, input);
  }
}
