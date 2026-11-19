import 'reflect-metadata';
import { validateEnvironment } from '../../config/environment';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../../database/options';
import { maintenanceBatch, maintenanceHealth } from './maintenance';
import { checkHistory, checkSchema } from './schema';
async function main() {
  const mode = process.argv[2];
  if (mode === 'config-check') {
    validateEnvironment({
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_SSL: 'true',
      DB_SYNCHRONIZE: false,
    });
    console.log(JSON.stringify({ status: 'configuration-valid' }));
    return;
  }
  if (
    ![
      'migrate',
      'schema-check',
      'maintenance-once',
      'maintenance-health',
      'maintenance-worker',
    ].includes(mode)
  )
    throw new Error('Unknown deployment operation.');
  const options = databaseOptions({ ...process.env, DB_SYNCHRONIZE: false });
  const source = await new DataSource({
    ...options,
    extra: {
      options:
        '-c timezone=UTC -c statement_timeout=30000 -c lock_timeout=5000',
      connectionTimeoutMillis: 10000,
    },
  }).initialize();
  let stop = false;
  let wake: (() => void) | undefined;
  const shutdown = () => {
    stop = true;
    wake?.();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  try {
    if (mode === 'migrate') {
      if (process.env.MIGRATION_CONFIRM !== 'APPLY_REVIEWED_MIGRATIONS')
        throw new Error('Migration confirmation required.');
      const lease = source.createQueryRunner();
      await lease.connect();
      try {
        if (
          !(
            await lease.query('SELECT pg_try_advisory_lock(17949313) AS locked')
          )[0].locked
        )
          throw new Error('Migration already in progress.');
        await checkHistory(source, true);
        await source.runMigrations({ transaction: 'all' });
        await checkSchema(source);
        console.log(JSON.stringify({ status: 'schema-ready' }));
      } finally {
        await lease
          .query('SELECT pg_advisory_unlock(17949313)')
          .catch(() => {});
        await lease.release();
      }
    } else if (mode === 'schema-check') {
      await checkSchema(source);
      console.log(JSON.stringify({ status: 'schema-ready' }));
    } else if (mode === 'maintenance-health') {
      const report = await maintenanceHealth(source);
      console.log(JSON.stringify(report));
      if (!report.healthy) process.exitCode = 1;
    } else {
      do {
        const report = await maintenanceBatch(source);
        console.log(JSON.stringify(report));
        if (mode === 'maintenance-once') {
          if (report.status === 'failed') process.exitCode = 1;
          break;
        }
        if (!stop)
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 60000);
            wake = () => {
              clearTimeout(timer);
              resolve();
            };
          });
      } while (!stop);
    }
  } finally {
    await source.destroy();
    process.removeListener('SIGTERM', shutdown);
    process.removeListener('SIGINT', shutdown);
  }
}
void main().catch(() => {
  console.error(
    'Deployment operation failed. Inspect schema, worker health and private configuration. No connection details are logged.',
  );
  process.exitCode = 1;
});
