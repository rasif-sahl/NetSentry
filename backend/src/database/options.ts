import { DeploymentWorkerState } from '../deployment/entity/worker-state.entity';
import { operationEntities } from '../operations/entity/operations.entities';
import { billingEntities } from '../billing/entity/billing.entities';
import { businessEntities } from '../business/entity/business.entities';
import {
  FamilyProfile,
  FamilyAssignment,
  FamilyPolicy,
  FamilyRequest,
  FamilyReceipt,
  FamilyEvent,
} from '../family/entity/family.entities';
import {
  NetworkPresence,
  NetworkProfile,
  NetworkCollector,
  NetworkEndpoint,
  NetworkSighting,
  NetworkRouter,
  NetworkSample,
  NetworkEvent,
  NetworkCompatibility,
} from '../networks/entity/network.entities';
import {
  ApplicationCatalog,
  ApplicationWindow,
  ApplicationDay,
} from '../monitoring/entity/application.entities';
import {
  AgentDeveloper,
  DeveloperCommand,
  DeveloperAudit,
} from '../agents/entity/developer.entities';
import {
  Agent,
  AgentEnrolment,
  AgentEvent,
} from '../agents/entity/agent.entities';
import {
  AlertRule,
  AlertOccurrence,
  NotificationDelivery,
  NotificationPreference,
} from '../monitoring/entity/alert.entities';
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
} from '../monitoring/entity/entities';
import type { DataSourceOptions } from 'typeorm';
import { validateDatabaseEnvironment } from '../config/environment';
import { Session } from '../auth/entity/session.entity';
import { User } from '../users/entity/user.entity';
import { Membership } from '../workspaces/entity/membership.entity';
import { RegisteredDevice } from '../workspaces/entity/registered-device.entity';
import { Workspace } from '../workspaces/entity/workspace.entity';
import { PrivacyEvent } from '../account/entity/privacy-event.entity';
import { DeviceEnrolment } from '../devices/entity/enrolment.entity';
import { DeviceEvent } from '../devices/entity/device-event.entity';
import { WorkspaceInvitation } from '../workspaces/entity/invitation.entity';
import { AccountAction } from '../auth/entity/account-action.entity';
import { MailOutbox } from '../mail/entity/mail-outbox.entity';
import { join } from 'node:path';

export function databaseOptions(
  input: Record<string, unknown>,
): DataSourceOptions {
  const config = validateDatabaseEnvironment(input);
  return {
    type: 'postgres',
    url: config.DATABASE_URL,
    entities: [
      DeploymentWorkerState,
      ...operationEntities,
      ...billingEntities,
      ...businessEntities,
      FamilyProfile,
      FamilyAssignment,
      FamilyPolicy,
      FamilyRequest,
      FamilyReceipt,
      FamilyEvent,
      NetworkPresence,
      NetworkProfile,
      NetworkCollector,
      NetworkEndpoint,
      NetworkSighting,
      NetworkRouter,
      NetworkSample,
      NetworkEvent,
      NetworkCompatibility,
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
