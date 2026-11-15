import { Controller, Get } from '@nestjs/common';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  @Get()
  health() {
    // Liveness only; dependency readiness is a separate operational concern.
    return { status: 'ok', apiVersion: '1' };
  }
}
