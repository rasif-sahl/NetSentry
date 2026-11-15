import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { databaseOptions } from './options';

config({ quiet: true });
// CLI operations must never synchronize a schema, even if a developer opted in.
export default new DataSource(
  databaseOptions({ ...process.env, DB_SYNCHRONIZE: false }),
);
