import {
  ApplicationCatalog,
  ApplicationWindow,
  ApplicationDay,
} from '../monitoring/application.entities';
import {
  AgentDeveloper,
  DeveloperCommand,
  DeveloperAudit,
} from '../agents/developer.entities';
import { Agent, AgentEnrolment, AgentEvent } from '../agents/agent.entities';
import {
  AlertRule,
  AlertOccurrence,
  NotificationDelivery,
  NotificationPreference,
} from '../monitoring/alert.entities';
import {
  RetentionPolicy,
  Measurement,
  MeasurementReceipt,
  SyncBatch,
  CollectionGap,
  DailyUsage,
  MonitoringRun,
  UsageNetwork,
  DeviceUsageNetwork,
} from '../monitoring/entities';
import type { DataSourceOptions } from 'typeorm';
import { validateDatabaseEnvironment } from '../config/environment';
import { Session } from '../auth/session.entity';
import { User } from '../users/user.entity';
import { Membership } from '../workspaces/membership.entity';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { PrivacyEvent } from '../account/privacy-event.entity';
import { DeviceEnrolment } from '../devices/enrolment.entity';
import { DeviceEvent } from '../devices/device-event.entity';
import { WorkspaceInvitation } from '../workspaces/invitation.entity';
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
      ApplicationCatalog,
      ApplicationWindow,
      ApplicationDay,
      AgentDeveloper,
      DeveloperCommand,
      DeveloperAudit,
      Agent,
      AgentEnrolment,
      AgentEvent,
      User,
      Session,
      Workspace,
      Membership,
      RegisteredDevice,
      AccountAction,
      MailOutbox,
      WorkspaceInvitation,
      DeviceEnrolment,
      DeviceEvent,
      PrivacyEvent,
      AlertRule,
      AlertOccurrence,
      NotificationDelivery,
      NotificationPreference,
      RetentionPolicy,
      Measurement,
      MeasurementReceipt,
      SyncBatch,
      CollectionGap,
      DailyUsage,
      MonitoringRun,
      UsageNetwork,
      DeviceUsageNetwork,
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
