import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { isUUID } from 'class-validator';
import { databaseOptions } from '../database/options';
import { maintainNetworks } from './network-maintenance';
config({ quiet: true });
async function main() {
  const id = process.argv[2];
  if (!id || !isUUID(id)) throw new Error('Provide one workspace UUID.');
  const source = await new DataSource(
    databaseOptions({ ...process.env, DB_SYNCHRONIZE: false }),
  ).initialize();
  try {
    console.log(JSON.stringify(await maintainNetworks(source, id)));
  } finally {
    await source.destroy();
  }
}
void main().catch(() => {
  console.error(
    'Network maintenance failed; check private deployment configuration and database availability.',
  );
  process.exitCode = 1;
});
