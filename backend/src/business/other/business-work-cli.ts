import 'reflect-metadata';
import { config } from 'dotenv';
import { isUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../../database/options';
import { maintainBusiness } from './business-maintenance';
config({ quiet: true });
async function main() {
  const id = process.argv[2];
  if (!id || !isUUID(id)) throw new Error('Provide a workspace UUID.');
  const source = await new DataSource(
    databaseOptions({ ...process.env, DB_SYNCHRONIZE: false }),
  ).initialize();
  try {
    console.log(JSON.stringify(await maintainBusiness(source, id)));
  } finally {
    await source.destroy();
  }
}
void main().catch(() => {
  console.error(
    'Business audit maintenance failed; check private deployment configuration.',
  );
  process.exitCode = 1;
});
