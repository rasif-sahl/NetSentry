import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Controller({ path: 'ready', version: '1' })
export class ReadinessController {
  constructor(private readonly source: DataSource) {}
  @Get() async ready() {
    try {
      await this.source.query('SELECT 1');
      const [table] = await this.source.query(
        "SELECT to_regclass('public.netsentry_migrations') AS name",
      );
      if (!table.name) throw new Error();
      const actual = (
        await this.source.query('SELECT name FROM netsentry_migrations')
      )
        .map((r: { name: string }) => r.name)
        .sort();
      const expected = this.source.migrations.map((m) => m.name).sort();
      if (actual.join('|') !== expected.join('|')) throw new Error();
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Service is not ready.');
    }
  }
}
