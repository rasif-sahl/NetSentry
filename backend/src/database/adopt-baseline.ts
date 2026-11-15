import { DataSource } from 'typeorm';
import { baselineEntities } from './baseline';
import { InitialIdentitySchema1794738635363 } from './migrations/1794738635363-InitialIdentitySchema';

export async function adoptBaseline(source: DataSource): Promise<void> {
  const baseline = new DataSource({
    ...source.options,
    entities: baselineEntities,
    migrations: [InitialIdentitySchema1794738635363],
    synchronize: false,
    migrationsRun: false,
  });
  try {
    await baseline.initialize();
    const difference = await baseline.driver.createSchemaBuilder().log();
    if (difference.upQueries.length)
      throw new Error(
        'Schema does not match the baseline. No migration history was adopted.',
      );
    await baseline.runMigrations({ fake: true });
  } finally {
    if (baseline.isInitialized) await baseline.destroy();
  }
}
