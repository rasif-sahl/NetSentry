import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../database/options';
import { maintainOperations } from './maintenance';
async function main() {
  const source = await new DataSource(
    databaseOptions({ ...process.env, DB_SYNCHRONIZE: false }),
  ).initialize();
  try {
    console.log(JSON.stringify(await maintainOperations(source)));
  } finally {
    await source.destroy();
  }
}
void main().catch(() => {
  console.error(
    'Operations maintenance failed. Check private deployment configuration.',
  );
  process.exitCode = 1;
});
