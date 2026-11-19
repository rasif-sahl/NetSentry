import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { checkHistory } from '../deployment/schema';
@Controller({ path: 'ready', version: '1' })
export class ReadinessController {
  constructor(private readonly source: DataSource) {}
  @Get() async ready() {
    try {
      await checkHistory(this.source);
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Service is not ready.');
    }
  }
}
