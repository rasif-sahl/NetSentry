import 'reflect-metadata';
import 'dotenv/config';
import { isUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../../database/options';
import { cleanupAgents } from './cleanup';
async function main() {
  const id = process.argv[2];
  if (!id || !isUUID(id)) throw new Error('Supply one workspace UUID.');
  const source = await new DataSource(
    databaseOptions(process.env),
  ).initialize();
  try {
    console.log(JSON.stringify(await cleanupAgents(source, id)));
  } finally {
    await source.destroy();
  }
}
void main().catch(() => {
  console.error(
    'Agent cleanup failed. Check workspace/configuration and retry.',
  );
  process.exitCode = 1;
});
