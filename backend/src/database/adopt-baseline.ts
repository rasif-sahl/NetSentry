import type { DataSource } from 'typeorm';

export async function adoptBaseline(source: DataSource): Promise<void> {
  if (
    source.migrations.length !== 1 ||
    source.migrations[0].name !== 'InitialIdentitySchema1794738635363'
  ) {
    throw new Error(
      'Baseline adoption requires exactly the initial migration. Review later migrations separately.',
    );
  }
  const difference = await source.driver.createSchemaBuilder().log();
  if (difference.upQueries.length)
    throw new Error(
      'Schema does not match the baseline. No migration history was adopted.',
    );
  await source.runMigrations({ fake: true });
}
