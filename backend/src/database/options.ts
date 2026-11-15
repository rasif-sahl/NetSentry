import type { DataSourceOptions } from 'typeorm';
import { validateDatabaseEnvironment } from '../config/environment';
import { Session } from '../auth/session.entity';
import { User } from '../users/user.entity';
import { Membership } from '../workspaces/membership.entity';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { AccountAction } from '../auth/account-action.entity';
import { MailOutbox } from '../mail/mail-outbox.entity';
import { join } from 'node:path';

export function databaseOptions(
  input: Record<string, unknown>,
): DataSourceOptions {
  const config = validateDatabaseEnvironment(input);
  return {
    type: 'postgres',
    url: config.DATABASE_URL,
    entities: [
      User,
      Session,
      Workspace,
      Membership,
      RegisteredDevice,
      AccountAction,
      MailOutbox,
    ],
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
    migrationsTableName: 'netsentry_migrations',
    migrationsRun: false,
    synchronize: config.DB_SYNCHRONIZE,
    installExtensions: false,
    ssl: config.DATABASE_SSL
      ? {
          rejectUnauthorized: true,
          ...(config.DATABASE_SSL_CA ? { ca: config.DATABASE_SSL_CA } : {}),
        }
      : false,
    extra: { options: '-c timezone=UTC' },
  };
}
