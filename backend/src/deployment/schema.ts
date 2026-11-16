import { DataSource } from 'typeorm';
export async function checkHistory(source: DataSource, pendingAllowed = false) {
  const [table] = await source.query(
    "SELECT to_regclass('public.netsentry_migrations') AS name",
  );
  const actual: string[] = table.name
    ? (await source.query('SELECT name FROM netsentry_migrations'))
        .map((r: { name: string }) => r.name)
        .sort()
    : [];
  const expected = source.migrations.map((m) => m.name).sort();
  if (
    actual.some((name) => !expected.includes(name)) ||
    new Set(actual).size !== actual.length ||
    (!pendingAllowed && actual.join('|') !== expected.join('|'))
  )
    throw new Error('Migration history does not match this release.');
}
export async function checkSchema(source: DataSource) {
  await checkHistory(source);
  if ((await source.driver.createSchemaBuilder().log()).upQueries.length)
    throw new Error('Schema drift detected.');
}
