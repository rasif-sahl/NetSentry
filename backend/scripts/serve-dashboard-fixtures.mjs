// Isolated browser-test server only. Never imported by production startup.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const url = process.env.TEST_DATABASE_URL;
assert.ok(
  url && new URL(url).pathname.endsWith('_test'),
  'Supply an isolated empty TEST_DATABASE_URL ending in _test.',
);
Object.assign(process.env, {
  NODE_ENV: 'test',
  TZ: 'UTC',
  API_RATE_LIMIT: '2000',
  DATABASE_URL: url,
  DATABASE_SSL: process.env.TEST_DATABASE_SSL ?? 'false',
  DB_SYNCHRONIZE: 'false',
  API_PREFIX: 'api',
  CORS_ORIGINS: 'http://127.0.0.1:54111',
  ROUTER_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 12).toString('base64'),
  ACCOUNT_MAIL_ENCRYPTION_KEY: Buffer.alloc(32, 11).toString('base64'),
  JWT_ACCESS_TOKEN_SECRET:
    'dashboard-fixture-access-secret-never-use-in-production',
  JWT_REFRESH_TOKEN_SECRET:
    'dashboard-fixture-refresh-secret-never-use-in-production',
  MAIL_ENABLED: 'false',
  BILLING_MODE: 'sandbox',
  BILLING_EVENT_SECRET: 'synthetic-dashboard-billing-secret-123456789',
});
const { DataSource } = require('typeorm');
const { databaseOptions } = require('../dist/database/options.js');
const { NestFactory } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { configureHttp } = require('../dist/common/configure-http.js');
const { decryptMail } = require('../dist/mail/other/mail-crypto.js');
const source = await new DataSource(databaseOptions(process.env)).initialize();
let ready = false;
let developerTimer;
let developerBusy = false;
let developerRunning;
let app,
  ownsSchema = false,
  stopping = false;
const file = new URL('../../dashboard/.test/fixtures.json', import.meta.url);
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(developerTimer);
  if (developerRunning) await developerRunning;
  if (app) await app.close();
  if (ownsSchema)
    while (
      Number(
        (
          await source.query('SELECT count(*) AS n FROM netsentry_migrations')
        )[0].n,
      )
    )
      await source.undoLastMigration();
  await source.destroy();
  await rm(file, { force: true });
}
try {
  assert.equal(
    (
      await source.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name<>'netsentry_migrations'",
      )
    ).length,
    0,
    'Refusing a populated fixture database.',
  );
  const history = (
    await source.query(
      "SELECT to_regclass('public.netsentry_migrations') AS name",
    )
  )[0].name;
  if (history)
    assert.equal(
      Number(
        (
          await source.query('SELECT count(*) AS n FROM netsentry_migrations')
        )[0].n,
      ),
      0,
    );
  await source.runMigrations();
  ownsSchema = true;
  app = await NestFactory.create(require('../dist/app.module.js').AppModule, {
    logger: false,
    rawBody: true,
    abortOnError: false,
  });
  // Browser tests share loopback IPs; only this isolated server uses an unbounded counter.
  // Production authentication, authorization and throttling are unchanged.
  app.get(require('@nestjs/throttler').ThrottlerStorage).increment =
    async () => ({
      totalHits: 1,
      timeToExpire: 1,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  app
    .getHttpAdapter()
    .get('/__dashboard-ready', (_request, response) =>
      response.status(ready ? 200 : 503).json({ ready }),
    );
  configureHttp(app, app.get(ConfigService));
  await app.listen(54110, '127.0.0.1');
  const base = 'http://127.0.0.1:54110/api/v1';
  async function call(path, method = 'GET', body, token) {
    const result = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!result.ok)
      throw new Error(`Fixture setup failed at ${path}: ${result.status}`);
    return result.json();
  }
  const password = 'fixture-dashboard-password-123';
  const accounts = {};
  for (const name of [
    'owner',
    'viewer',
    'unverified',
    'recovery',
    'child',
    'guardian',
    'employee',
    'businessAnalyst',
    'businessNetwork',
  ]) {
    const input = {
      email: `${name}@dashboard.example.invalid`,
      displayName: `Fixture ${name}`,
      password,
    };
    // Bulk synthetic setup uses the real service, preserving production rate limits.
    const session = ['employee', 'businessAnalyst', 'businessNetwork'].includes(
      name,
    )
      ? await app
          .get(require('../dist/auth/auth.service.js').AuthService)
          .register(input, {})
      : await call('/auth/register', 'POST', input);
    accounts[name] = session;
    if (name !== 'unverified')
      await source.query(
        'UPDATE users SET "emailVerifiedAt"=now() WHERE id=$1',
        [session.user.id],
      );
  }
  const owner = accounts.owner;
  const pagingWorkspace = await call(
    '/workspaces',
    'POST',
    { name: 'Fixture pagination', type: 'FAMILY', timezone: 'UTC' },
    owner.accessToken,
  );
  const pagingRule = await call(
    `/workspaces/${pagingWorkspace.id}/monitoring/rules`,
    'POST',
    {
      kind: 'threshold',
      metric: 'mobile_data_bytes',
      period: 'month',
      threshold: 1,
      severity: 'warning',
      channels: ['in_app'],
      enabled: true,
    },
    owner.accessToken,
  );
  await source.query(
    `WITH inserted AS (
       INSERT INTO alerts ("ruleId", cycle, "sourceDeviceIds", snapshot, "createdAt")
       SELECT $1, i, '[]'::jsonb,
         jsonb_build_object('kind','threshold','severity','warning','value',i::text,'windowKey','fixture-page'),
         date_trunc('second', now()) - CASE WHEN i <= 30 THEN interval '1 minute' ELSE interval '0 second' END
       FROM generate_series(1, 130) AS i RETURNING id, cycle
     )
     INSERT INTO notification_deliveries ("alertId", channel, status, "dueAt")
     SELECT id, 'in_app', CASE WHEN cycle <= 30 THEN 'delivered' ELSE 'suppressed' END, now()
     FROM inserted`,
    [pagingRule.id],
  );
  const workspace = await call(
    '/workspaces',
    'POST',
    { name: 'Fixture family', type: 'FAMILY', timezone: 'America/New_York' },
    owner.accessToken,
  );
  const empty = await call(
    '/workspaces',
    'POST',
    { name: 'Fixture empty', type: 'BUSINESS', timezone: 'UTC' },
    owner.accessToken,
  );
  await source.query(
    'INSERT INTO memberships ("workspaceId","userId",role) VALUES ($1,$2,\'VIEWER\')',
    [workspace.id, accounts.viewer.user.id],
  );
  for (const session of [owner, accounts.viewer])
    await call(
      `/workspaces/${workspace.id}/select`,
      'POST',
      {},
      session.accessToken,
    );
  const code = await call(
    '/devices/enrolments',
    'POST',
    {
      workspaceId: workspace.id,
      installationId: randomUUID(),
      platform: 'ANDROID',
    },
    owner.accessToken,
  );
  const pair = await call(
    '/devices/enrol',
    'POST',
    {
      token: code.token,
      name: 'Fixture Android',
      disclosureVersion: 'device-enrolment-v1',
      accepted: true,
    },
    owner.accessToken,
  );
  const consent = await call(
    `/devices/${pair.device.id}/consent`,
    'POST',
    {
      disclosureVersion: 'monitoring-v3',
      accepted: true,
      scopes: ['network_usage', 'app_usage'],
    },
    owner.accessToken,
  );
  const now = new Date().toISOString();
  await call(
    `/devices/${pair.device.id}/heartbeat`,
    'POST',
    {
      generation: consent.generation,
      permissionStatus: 'granted',
      monitoringHealth: 'healthy',
      applicationVersion: 'synthetic-1',
      capabilityReport: {
        schemaVersion: 1,
        workspaceId: workspace.id,
        deviceId: pair.device.id,
        reportedAt: now,
        capabilities: ['network.mobile_data', 'usage.screen_time'].map(
          (id) => ({
            id,
            status: 'supported',
            reason: 'Synthetic browser-test fixture only',
            source: 'os',
            checkedAt: now,
            requiredSetup: [],
            availableActions: ['measure'],
          }),
        ),
      },
    },
    pair.deviceToken,
  );
  const start = new Date(Date.now() - 3601000).toISOString(),
    end = new Date(Date.now() - 1000).toISOString();
  await source.query(
    'UPDATE registered_devices SET "enrolledAt"=$2 WHERE id=$1',
    [pair.device.id, new Date(Date.parse(start) - 1000)],
  );
  await source.query(
    'UPDATE device_events SET "createdAt"=$2 WHERE "deviceId"=$1 AND kind=\'consent_granted\'',
    [pair.device.id, new Date(Date.parse(start) - 1000)],
  );
  const event = {
    schemaVersion: 1,
    eventId: randomUUID(),
    workspaceId: workspace.id,
    deviceId: pair.device.id,
    metric: 'mobile_data_bytes',
    value: 10485760,
    unit: 'bytes',
    source: { kind: 'android', collectorVersion: 'synthetic-browser-1' },
    intervalStart: start,
    intervalEnd: end,
    collectedAt: now,
    quality: 'measured',
  };
  await call(
    `/devices/${pair.device.id}/measurements`,
    'POST',
    {
      schemaVersion: 1,
      batchId: randomUUID(),
      generation: consent.generation,
      events: [
        event,
        {
          ...event,
          eventId: randomUUID(),
          quality: 'estimated',
          value: 9437184,
        },
      ],
      gaps: [
        {
          gapId: randomUUID(),
          metric: 'mobile_data_bytes',
          intervalStart: start,
          intervalEnd: end,
          reason: 'offline',
        },
      ],
    },
    pair.deviceToken,
  );
  await call(
    `/workspaces/${workspace.id}/monitoring/rules`,
    'POST',
    {
      kind: 'threshold',
      deviceId: pair.device.id,
      metric: 'mobile_data_bytes',
      period: 'month',
      threshold: 1,
      severity: 'warning',
      channels: ['in_app'],
      enabled: true,
    },
    owner.accessToken,
  );
  const {
    evaluateWorkspace,
    deliverWorkspace,
  } = require('../dist/monitoring/alert.service.js');
  await evaluateWorkspace(source, workspace.id);
  await deliverWorkspace(source, workspace.id);
  const iosCode = await call(
    '/devices/enrolments',
    'POST',
    {
      workspaceId: workspace.id,
      installationId: randomUUID(),
      platform: 'IOS',
    },
    owner.accessToken,
  );
  const ios = await call(
    '/devices/enrol',
    'POST',
    {
      token: iosCode.token,
      name: 'Fixture iOS',
      disclosureVersion: 'device-enrolment-v1',
      accepted: true,
    },
    owner.accessToken,
  );
  await call(
    `/devices/${ios.device.id}/heartbeat`,
    'POST',
    {
      generation: ios.device.generation,
      permissionStatus: 'denied',
      capabilityReport: {
        schemaVersion: 1,
        workspaceId: workspace.id,
        deviceId: ios.device.id,
        reportedAt: now,
        capabilities: [
          {
            id: 'network.wifi_data',
            status: 'restricted_by_os',
            reason: 'Synthetic OS restriction; not verified native behavior',
            source: 'os',
            checkedAt: now,
            requiredSetup: [],
            availableActions: [],
          },
        ],
      },
    },
    ios.deviceToken,
  );
  const label = await call(
    `/workspaces/${workspace.id}/monitoring/networks`,
    'POST',
    { name: 'Fixture home label' },
    owner.accessToken,
  );
  await call('/auth/password/forgot', 'POST', {
    email: accounts.recovery.user.email,
  });
  const tokens = {};
  for (const name of ['unverified', 'recovery']) {
    const rows = await source.query(
      'SELECT * FROM mail_outbox WHERE "userId"=$1 ORDER BY "createdAt" DESC',
      [accounts[name].user.id],
    );
    tokens[name] = decryptMail(
      rows[0].encryptedPayload,
      process.env.ACCOUNT_MAIL_ENCRYPTION_KEY,
      rows[0].id,
    ).token;
  }
  // Explicit synthetic service publisher only; no process is discovered or signalled.
  const agentDefinition = {
    installationId: randomUUID(),
    platform: 'darwin',
    name: 'Fixture developer computer',
    modules: { network: false, developer: true },
    backgroundAllowed: false,
    accepted: true,
    disclosureVersion: 'agent-enrolment-v1',
  };
  const agentCode = await call(
    `/workspaces/${workspace.id}/agents/enrolments`,
    'POST',
    agentDefinition,
    owner.accessToken,
  );
  const developerPair = await call('/agents/enrol', 'POST', {
    token: agentCode.token,
    installationId: agentDefinition.installationId,
    platform: 'darwin',
  });
  await call(
    `/workspaces/${workspace.id}/agents/${developerPair.agent.id}/developer-policy`,
    'PATCH',
    {
      sharingAllowed: true,
      controllers: [owner.user.id],
      accepted: true,
      disclosureVersion: 'developer-sharing-v1',
    },
    owner.accessToken,
  );
  async function publishDeveloper() {
    if (stopping || developerBusy) return;
    developerBusy = true;
    try {
      const remote = `/agents/${developerPair.agent.id}/developer`;
      const config = await call(
        `${remote}/configuration`,
        'GET',
        undefined,
        developerPair.agentToken,
      );
      await call(
        `/agents/${developerPair.agent.id}/heartbeat`,
        'POST',
        {
          schemaVersion: 1,
          generation: config.generation,
          version: '0.7.0',
          architecture: 'arm64',
          reportedAt: new Date().toISOString(),
          requested: { network: false, developer: true },
          backgroundAllowed: false,
          droppedEvents: 0,
        },
        developerPair.agentToken,
      );
      if (config.sharingAllowed)
        await call(
          `${remote}/snapshot`,
          'POST',
          {
            schemaVersion: 1,
            generation: config.generation,
            revision: config.revision,
            localControlReady: true,
            platformSupported: true,
            total: 1,
            services: [
              {
                serviceId: 'd'.repeat(64),
                observationId: randomUUID(),
                pid: 30001,
                startedAt: new Date(Date.now() - 7200000).toISOString(),
                observedAt: new Date().toISOString(),
                runtime: 'Node.js',
                project: 'Fixture remote project',
                ports: [3000],
                canStop: true,
                childCount: 0,
              },
            ],
          },
          developerPair.agentToken,
        );
    } catch {
      /* account deletion or explicit revocation may end this fixture */
    } finally {
      developerBusy = false;
    }
  }
  // Named-network observations below are synthetic; no native discovery or router requests.
  const networkDefinition = {
    ...agentDefinition,
    installationId: randomUUID(),
    name: 'Synthetic network collector',
    modules: { network: true, developer: false },
  };
  const networkCode = await call(
    `/workspaces/${workspace.id}/agents/enrolments`,
    'POST',
    networkDefinition,
    owner.accessToken,
  );
  const networkPair = await call('/agents/enrol', 'POST', {
    token: networkCode.token,
    installationId: networkDefinition.installationId,
    platform: 'darwin',
  });
  const monitored = await call(
    `/workspaces/${workspace.id}/networks`,
    'POST',
    { name: 'Synthetic lab network', cidrs: ['192.168.40.0/24'] },
    owner.accessToken,
  );
  const networkPath = `/workspaces/${workspace.id}/networks/${monitored.networkId}`;
  await call(
    `${networkPath}/collectors`,
    'POST',
    {
      agentId: networkPair.agent.id,
      enabled: true,
      accepted: true,
      disclosureVersion: 'network-sharing-v1',
    },
    owner.accessToken,
  );
  async function publishNetwork() {
    const agentPath = `/agents/${networkPair.agent.id}`;
    const config = await call(
      `${agentPath}/network/configuration`,
      'POST',
      {
        networkId: monitored.networkId,
        generation: 1,
        accepted: true,
        disclosureVersion: 'network-sharing-v1',
      },
      networkPair.agentToken,
    );
    await call(
      `${agentPath}/heartbeat`,
      'POST',
      {
        schemaVersion: 1,
        generation: 1,
        version: '0.10.0',
        architecture: 'arm64',
        reportedAt: new Date().toISOString(),
        requested: { network: true, developer: false },
        backgroundAllowed: false,
        droppedEvents: 0,
      },
      networkPair.agentToken,
    );
    await call(
      `${agentPath}/network/snapshot`,
      'POST',
      {
        schemaVersion: 1,
        snapshotId: randomUUID(),
        networkId: monitored.networkId,
        generation: 1,
        revision: config.revision,
        observedAt: new Date().toISOString(),
        interfaces: [
          {
            name: 'fixture0',
            cidr: '192.168.40.20/24',
            gateway: '192.168.40.1',
          },
        ],
        neighbors: [
          {
            address: '192.168.40.50',
            mac: '02:00:00:40:00:01',
            evidence: 'cached',
          },
        ],
        router: null,
      },
      networkPair.agentToken,
    );
  }
  await publishNetwork();
  await publishDeveloper();
  developerTimer = setInterval(() => {
    developerRunning = publishDeveloper()
      .then(() => publishNetwork())
      .catch(() => {});
  }, 2000);
  // Synthetic family scope; no native restriction adapter or device action.
  for (const [name, role] of [
    ['child', 'MEMBER'],
    ['guardian', 'GUARDIAN'],
  ])
    await source.query(
      'INSERT INTO memberships ("workspaceId","userId",role) VALUES ($1,$2,$3)',
      [workspace.id, accounts[name].user.id, role],
    );
  const familyProfile = await call(
    `/workspaces/${workspace.id}/family/profiles`,
    'POST',
    {
      expectedRevision: 0,
      name: 'Synthetic family child',
      avatar: 'owl',
      ageBand: 'teen',
      userId: accounts.child.user.id,
      guardians: [accounts.guardian.user.id],
      networks: [label.id],
      archived: false,
      accepted: true,
      disclosureVersion: 'family-sharing-v1',
    },
    owner.accessToken,
  );
  const familyRules = {
    enabled: true,
    dailyMinutes: 90,
    appLimits: [],
    categoryLimits: [],
    allowedApps: [],
    restrictedApps: [],
    schedules: [],
    pauseUntil: null,
    networkPause: false,
    domains: [],
    domainCategories: [],
  };
  await call(
    `/workspaces/${workspace.id}/family/profiles/${familyProfile.id}/policy`,
    'POST',
    {
      expectedRevision: 0,
      rules: familyRules,
      accepted: true,
      disclosureVersion: 'family-sharing-v1',
    },
    owner.accessToken,
  );
  await mkdir(new URL('../../dashboard/.test/', import.meta.url), {
    recursive: true,
  });
  const { seedBusiness } = await import('./business-dashboard-fixtures.mjs');
  const business = await seedBusiness({ call, source, owner, accounts });
  await source
    .getRepository(
      require('../dist/operations/entity/operations.entities.js').OperatorGrant,
    )
    .save({
      userId: owner.user.id,
      role: 'ADMIN',
      workspaceIds: [workspace.id, business.workspaceId],
      globalAccounts: false,
      globalCatalog: true,
      expiresAt: new Date(Date.now() + 3600000),
    });
  // Larger synthetic lists live in a separate organization so ordinary small-inventory checks stay representative.
  const inventoryWorkspace = await call(
    '/workspaces',
    'POST',
    { name: 'Fixture paged inventory', type: 'BUSINESS', timezone: 'UTC' },
    owner.accessToken,
  );
  const inventoryBase = `/workspaces/${inventoryWorkspace.id}`;
  const inventoryNetwork = await call(
    `${inventoryBase}/networks`,
    'POST',
    { name: 'Paged office network', cidrs: ['192.168.76.0/24'] },
    owner.accessToken,
  );
  const location = await call(
    `${inventoryBase}/business/locations`,
    'POST',
    { name: 'Paged office', expectedRevision: 0 },
    owner.accessToken,
  );
  await call(
    `${inventoryBase}/business/networks/${inventoryNetwork.networkId}/location`,
    'PATCH',
    { locationId: location.id },
    owner.accessToken,
  );
  const unusedLocation = await call(
    `${inventoryBase}/business/locations`,
    'POST',
    { name: 'Empty location', expectedRevision: 0 },
    owner.accessToken,
  );
  const inventoryAgentDefinition = {
    ...networkDefinition,
    installationId: randomUUID(),
    name: 'Paged fixture collector',
  };
  const inventoryCode = await call(
    `${inventoryBase}/agents/enrolments`,
    'POST',
    inventoryAgentDefinition,
    owner.accessToken,
  );
  const inventoryAgent = await call('/agents/enrol', 'POST', {
    token: inventoryCode.token,
    installationId: inventoryAgentDefinition.installationId,
    platform: 'darwin',
  });
  await source.query(
    `INSERT INTO registered_devices ("installationId", "workspaceId", "registeredById", name, platform, "createdAt")
     SELECT uuid_generate_v4()::text, $1, $2, 'Paged device ' || i, 'IOS', now() - i * interval '1 second'
     FROM generate_series(1, 27) i`,
    [inventoryWorkspace.id, owner.user.id],
  );
  await source.query(
    `WITH labels AS (
       INSERT INTO usage_networks ("workspaceId",name) SELECT $1, 'Paged network ' || i FROM generate_series(1,26) i RETURNING id
     ) INSERT INTO network_profiles ("networkId", cidrs) SELECT id, '["192.168.76.0/24"]'::jsonb FROM labels`,
    [inventoryWorkspace.id],
  );
  const endpoints = await source.query(
    `INSERT INTO network_endpoints ("networkId", identity, name, "firstSeenAt", "lastSeenAt", archived)
     SELECT $1, 'page-fixture-' || i, 'Paged endpoint ' || i, now() - i * interval '1 second', now(), i = 205
     FROM generate_series(1,205) i RETURNING id, name`,
    [inventoryNetwork.networkId],
  );
  const historyEndpoint = endpoints.find(
    (record) => record.name === 'Paged endpoint 1',
  ).id;
  await source.query(
    `INSERT INTO network_events ("networkId",kind,severity,"occurredAt")
     SELECT $1,'collector_policy_updated','info',now() - i * interval '1 second' FROM generate_series(1,105) i`,
    [inventoryNetwork.networkId],
  );
  await source.query(
    `INSERT INTO network_presence ("networkId","agentId","endpointId",address,evidence,"firstObservedAt","lastObservedAt")
     SELECT $1,$2,$3,'192.168.76.3','arp_cache',now() - (i + 1) * interval '1 minute',now() - i * interval '1 minute'
     FROM generate_series(1,105) i`,
    [inventoryNetwork.networkId, inventoryAgent.agent.id, historyEndpoint],
  );
  await source.query(
    `INSERT INTO billing_payments (id,"workspaceId","amountMinor",currency,status,"paidAt")
     SELECT uuid_generate_v4(),$1,900,'TST','paid',now() - i * interval '1 second' FROM generate_series(1,102) i`,
    [inventoryWorkspace.id],
  );
  await source.query(
    `INSERT INTO billing_requests ("workspaceId","requestId","requesterId",plan,interval,"expectedRevision",status,"createdAt")
     SELECT $1,uuid_generate_v4(),$2,'business','monthly',0,
       CASE WHEN i <= 21 THEN 'confirmed' ELSE 'pending' END,now() - i * interval '1 second'
     FROM generate_series(1,48) i`,
    [inventoryWorkspace.id, owner.user.id],
  );
  await source.query(
    `INSERT INTO developer_commands ("agentId","requesterId","requestId",generation,revision,target,mode,fingerprint,state,"requestedAt","expiresAt")
     SELECT $1,$2,uuid_generate_v4(),1,0,$3::jsonb,'graceful','fixture','expired',now() - (i + 1) * interval '1 hour',now() - i * interval '1 hour'
     FROM generate_series(1,27) i`,
    [
      developerPair.agent.id,
      owner.user.id,
      JSON.stringify({
        serviceId: 'a'.repeat(64),
        observationId: randomUUID(),
        pid: 30002,
        startedAt: new Date(Date.now() - 30 * 3600000).toISOString(),
        observedAt: new Date(Date.now() - 29 * 3600000).toISOString(),
        runtime: 'Node.js',
        project: 'Historical synthetic command',
        ports: [3002],
        canStop: true,
        childCount: 0,
      }),
    ],
  );
  await writeFile(
    file,
    JSON.stringify({
      password,
      workspaceId: workspace.id,
      emptyId: empty.id,
      pagingWorkspaceId: pagingWorkspace.id,
      inventoryPageFixture: {
        workspaceId: inventoryWorkspace.id,
        networkId: inventoryNetwork.networkId,
        endpointId: historyEndpoint,
        locationId: location.id,
        unusedLocationId: unusedLocation.id,
      },
      deviceId: pair.device.id,
      familyProfileId: familyProfile.id,
      business,
      monitoredNetworkId: monitored.networkId,
      developerAgentId: developerPair.agent.id,
      networkId: label.id,
      accounts: Object.fromEntries(
        Object.entries(accounts).map(([name, session]) => [
          name,
          { id: session.user.id, email: session.user.email },
        ]),
      ),
      tokens,
    }),
    { mode: 0o600 },
  );
  ready = true;
  process.on('SIGTERM', () => void stop().finally(() => process.exit(0)));
  process.on('SIGINT', () => void stop().finally(() => process.exit(0)));
  console.log(
    'Synthetic dashboard fixtures ready on loopback. No external messages or collectors are enabled.',
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Fixture setup failed.',
  );
  await stop();
  process.exitCode = 1;
}
