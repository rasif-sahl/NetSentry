// Synthetic LAN observations only. This suite never contacts a router or scans a LAN.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateApiPayload } =
  await import('../../contracts/scripts/validation.mjs');
const { PrivacyService } = require('../dist/account/privacy.service.js');
const {
  maintainNetworks,
} = require('../dist/networks/other/network-maintenance.js');
export async function checkNetworks({
  request,
  source,
  alice,
  bob,
  workspace,
  apiURL,
  app,
}) {
  const auth = alice.accessToken,
    base = `/workspaces/${workspace.id}/networks`,
    consent = { accepted: true, disclosureVersion: 'network-sharing-v1' };
  const disclosure = await request(
    'GET',
    '/networks/disclosure',
    200,
    'NetworkDisclosure',
  );
  assert.equal(disclosure.adapterProfiles[0].hardwareStatus, 'unverified');
  await request(
    'POST',
    base,
    400,
    'ApiError',
    { name: 'Bad scope', cidrs: ['172.16.0.0/11'] },
    auth,
  );
  const site = await request(
      'POST',
      base,
      201,
      'NetworkSite',
      { name: 'Synthetic fixture network', cidrs: ['192.168.1.0/24'] },
      auth,
    ),
    path = `${base}/${site.networkId}`;
  const pairs = [];
  for (let n = 0; n < 2; n++) {
    const input = {
      installationId: randomUUID(),
      platform: 'darwin',
      name: `Network fixture ${n}`,
      modules: { network: true, developer: false },
      backgroundAllowed: false,
      accepted: true,
      disclosureVersion: 'agent-enrolment-v1',
    };
    const code = await request(
      'POST',
      `/workspaces/${workspace.id}/agents/enrolments`,
      201,
      null,
      input,
      auth,
    );
    const pair = await request('POST', '/agents/enrol', 201, null, {
      token: code.token,
      installationId: input.installationId,
      platform: 'darwin',
    });
    pairs.push(pair);
    await request(
      'POST',
      `/agents/${pair.agent.id}/heartbeat`,
      201,
      'AgentConfiguration',
      {
        schemaVersion: 1,
        generation: pair.agent.generation,
        version: '0.10.0',
        architecture: 'arm64',
        reportedAt: new Date().toISOString(),
        requested: { network: true, developer: false },
        backgroundAllowed: false,
        droppedEvents: 0,
      },
      pair.agentToken,
    );
  }
  const [a, b] = pairs,
    ap = `/agents/${a.agent.id}/network`,
    local = {
      networkId: site.networkId,
      generation: a.agent.generation,
      ...consent,
    };
  await request(
    'POST',
    `${ap}/configuration`,
    403,
    'ApiError',
    local,
    a.agentToken,
  );
  for (const p of pairs)
    await request(
      'POST',
      `${path}/collectors`,
      201,
      'NetworkCollector',
      { agentId: p.agent.id, enabled: true, ...consent },
      auth,
    );
  let conf = await request(
    'POST',
    `${ap}/configuration`,
    201,
    'NetworkConfiguration',
    local,
    a.agentToken,
  );
  assert.equal(conf.router, null);
  const routerInput = {
    agentId: a.agent.id,
    adapter: 'openwrt-ubus-v1',
    url: 'https://192.168.1.1/ubus',
    interfaceName: 'wan',
    caCertificate: '',
    username: 'fixture-router-user',
    password: 'secret-router-fixture',
    manufacturer: 'Synthetic',
    model: 'Protocol fixture',
    firmware: 'Not hardware tested',
    ...consent,
  };
  for (const url of [
    'http://192.168.1.1/ubus',
    'https://public.invalid/ubus',
    'https://192.168.2.1/ubus',
    'https://127.0.0.1/ubus',
  ])
    await request(
      'POST',
      `${path}/router`,
      400,
      'ApiError',
      { ...routerInput, url },
      auth,
    );
  const router = await request(
    'POST',
    `${path}/router`,
    201,
    'NetworkRouter',
    routerInput,
    auth,
  );
  assert.equal(router.credentialConfigured, true);
  assert.ok(!JSON.stringify(router).includes('secret-router'));
  const [stored] = await source.query(
    'SELECT "encryptedCredentials" FROM network_routers WHERE id=$1',
    [router.id],
  );
  assert.ok(!stored.encryptedCredentials.includes(routerInput.password));
  conf = await request(
    'POST',
    `${ap}/configuration`,
    201,
    'NetworkConfiguration',
    local,
    a.agentToken,
  );
  assert.equal(conf.router.password, routerInput.password);
  const otherLocal = { ...local, generation: b.agent.generation };
  const otherConf = await request(
    'POST',
    `/agents/${b.agent.id}/network/configuration`,
    201,
    'NetworkConfiguration',
    otherLocal,
    b.agentToken,
  );
  assert.equal(otherConf.router, null);
  await request(
    'POST',
    `${ap}/configuration`,
    403,
    'ApiError',
    { ...local, networkId: randomUUID() },
    a.agentToken,
  );
  await request(
    'POST',
    `${ap}/configuration`,
    403,
    'ApiError',
    { ...local, generation: local.generation + 1 },
    a.agentToken,
  );
  await request(
    'POST',
    `${ap}/configuration`,
    400,
    'ApiError',
    { ...local, accepted: false },
    a.agentToken,
  );
  const test = await request(
    'POST',
    `${path}/router/test`,
    201,
    'NetworkTestPending',
    null,
    auth,
  );
  let clock = Date.now() - 70000;
  const snapshot = (config, neighbors = [], result = null) => ({
    schemaVersion: 1,
    snapshotId: randomUUID(),
    networkId: site.networkId,
    generation: 1,
    revision: config.revision,
    observedAt: new Date((clock += 1000)).toISOString(),
    interfaces: [
      { name: 'eth0', cidr: '192.168.1.20/24', gateway: '192.168.1.1' },
    ],
    neighbors,
    router: result,
  });
  const rr = {
    routerId: router.id,
    revision: router.revision,
    status: 'ok',
    wanUp: true,
    uptimeSeconds: '100',
    rxBytes: '9007199254740993',
    txBytes: '18446744073709000000',
    model: 'Synthetic fixture',
    firmware: 'Fixture only',
    testRequestId: test.requestId,
  };
  const neighbor = {
    address: '192.168.1.50',
    mac: '02:00:00:00:00:01',
    evidence: 'cached',
  };
  const first = snapshot(conf, [neighbor], rr);
  await request(
    'POST',
    `${ap}/snapshot`,
    201,
    'NetworkSnapshotAck',
    first,
    a.agentToken,
  );
  const replay = await request(
    'POST',
    `${ap}/snapshot`,
    201,
    'NetworkSnapshotAck',
    first,
    a.agentToken,
  );
  assert.equal(replay.replayed, true);
  await request(
    'POST',
    `${ap}/snapshot`,
    409,
    'ApiError',
    { ...first, neighbors: [] },
    a.agentToken,
  );
  await request(
    'POST',
    `${ap}/snapshot`,
    409,
    'ApiError',
    { ...snapshot(conf), revision: conf.revision - 1 },
    a.agentToken,
  );
  await request(
    'POST',
    `${ap}/snapshot`,
    400,
    'ApiError',
    snapshot(conf, [{ ...neighbor, address: '192.168.2.1' }]),
    a.agentToken,
  );
  await request(
    'POST',
    `/agents/${b.agent.id}/network/snapshot`,
    409,
    'ApiError',
    snapshot(otherConf, [], rr),
    b.agentToken,
  );
  await request(
    'POST',
    `/agents/${b.agent.id}/network/snapshot`,
    201,
    'NetworkSnapshotAck',
    snapshot(otherConf, [
      neighbor,
      { address: '192.168.1.51', mac: null, evidence: 'unknown' },
    ]),
    b.agentToken,
  );
  await request(
    'POST',
    `${ap}/snapshot`,
    201,
    'NetworkSnapshotAck',
    snapshot(
      conf,
      [neighbor, { address: '192.168.1.51', mac: null, evidence: 'unknown' }],
      {
        ...rr,
        uptimeSeconds: '110',
        rxBytes: '9007199254741993',
        txBytes: '18446744073709000200',
      },
    ),
    a.agentToken,
  );
  let view = await request('GET', path, 200, 'NetworkView', null, auth);
  assert.equal(
    view.endpoints.length,
    3,
    'MAC merges within site; address-only sources stay separate',
  );
  assert.equal(view.presenceHistory.length, 4);
  assert.equal(view.bandwidth.receivedBytes, '1000');
  assert.equal(view.bandwidth.sentBytes, '200');
  assert.equal(view.router.testStatus, 'succeeded');
  assert.equal(view.endpoints[0].manufacturer, null);
  assert.ok(!JSON.stringify(view).includes(routerInput.password));
  assert.ok(!JSON.stringify(view).includes('encryptedCredentials'));
  await request(
    'POST',
    `${ap}/snapshot`,
    201,
    'NetworkSnapshotAck',
    snapshot(conf, [neighbor], {
      ...rr,
      uptimeSeconds: '1',
      rxBytes: '1',
      txBytes: '2',
    }),
    a.agentToken,
  );
  view = await request('GET', path, 200, 'NetworkView', null, auth);
  assert.equal(view.bandwidth.samples[0].quality, 'counter_reset');
  assert.equal(view.bandwidth.receivedBytes, '1000');
  await source.query(
    `UPDATE network_samples SET "observedAt"="observedAt"-interval '400 seconds',"intervalStart"="intervalStart"-interval '400 seconds' WHERE "routerId"=$1`,
    [router.id],
  );
  await request(
    'POST',
    `${ap}/snapshot`,
    201,
    'NetworkSnapshotAck',
    snapshot(conf, [neighbor], { ...rr, rxBytes: '2000', txBytes: '3000' }),
    a.agentToken,
  );
  view = await request('GET', path, 200, 'NetworkView', null, auth);
  assert.equal(view.bandwidth.samples[0].quality, 'gap');
  const unavailable = {
    ...rr,
    status: 'auth_failed',
    wanUp: null,
    uptimeSeconds: null,
    rxBytes: null,
    txBytes: null,
    testRequestId: null,
  };
  await request(
    'POST',
    `${ap}/snapshot`,
    201,
    'NetworkSnapshotAck',
    snapshot(conf, [neighbor], unavailable),
    a.agentToken,
  );
  view = await request('GET', path, 200, 'NetworkView', null, auth);
  assert.ok(view.events.some((e) => e.kind === 'router_auth_failed'));
  assert.equal(view.wanUp, null);
  await source.query(
    `UPDATE network_routers SET "testStatus"='pending',"testRequestedAt"=$1 WHERE id=$2`,
    [new Date(Date.now() - 91000), router.id],
  );
  view = await request('GET', path, 200, 'NetworkView', null, auth);
  assert.equal(view.router.testStatus, 'expired');
  const endpoint = view.endpoints.find((e) => e.mac === neighbor.mac);
  const label = {
    name: 'Operator label',
    category: 'computer',
    trust: 'blocked_label',
    notes: 'Inventory label; no enforcement',
    archived: true,
    assignedUserId: alice.user.id,
    registeredDeviceId: null,
  };
  await request(
    'PATCH',
    `${path}/endpoints/${endpoint.id}`,
    400,
    'ApiError',
    { ...label, assignedUserId: randomUUID() },
    auth,
  );
  await request(
    'PATCH',
    `${path}/endpoints/${endpoint.id}`,
    200,
    'NetworkEndpoint',
    label,
    auth,
  );
  // Exercise the populated projection through the real service without consuming
  // the HTTP export quota reserved for the existing password/rate boundary suite.
  const exported = await app
    .get(PrivacyService)
    .export(alice.user.id, 'final-fixture-password-7890');
  validateApiPayload('PrivacyExport', JSON.parse(JSON.stringify(exported)));
  assert.ok(exported.networkCollectors.length >= 2);
  assert.ok(exported.networkAssignments.some((e) => e.id === endpoint.id));
  assert.ok(exported.networkRouters.some((r) => r.id === router.id));
  assert.ok(
    !/encryptedCredentials|snapshotHash|secret-router-fixture|fixture-router-user/.test(
      JSON.stringify(exported),
    ),
  );
  const event = view.events.find((e) => e.kind === 'new_endpoint');
  await request(
    'PATCH',
    `${path}/events/${event.id}`,
    200,
    'NetworkEvent',
    { severity: 'critical', acknowledged: true },
    auth,
  );
  await request(
    'POST',
    `${path}/compatibility`,
    201,
    'NetworkCompatibility',
    {
      manufacturer: 'Synthetic fixture',
      model: 'ubus protocol',
      firmware: 'fixture-only',
      adapter: 'openwrt-ubus-v1',
      features: ['wan_counters'],
      limitations: 'No physical router validated',
      feedback: 'Synthetic protocol tests',
      evidence: 'fixture_only',
      testedAt: new Date().toISOString(),
    },
    auth,
  );
  await source.query("UPDATE users SET status='ACTIVE' WHERE id=$1", [
    bob.user.id,
  ]);

  const outsider = await request('POST', '/auth/login', 201, 'AuthSession', {
    email: 'bob@example.invalid',
    password: 'fixture-password-1234',
  });
  await request('GET', path, 403, 'ApiError', null, outsider.accessToken);
  // Existing session may have been revoked by prior account checks; role checks also use the owner's live membership.
  await source.query(
    'UPDATE memberships SET role=\'VIEWER\' WHERE "workspaceId"=$1 AND "userId"=$2',
    [workspace.id, alice.user.id],
  );
  view = await request('GET', path, 200, 'NetworkView', null, auth);
  assert.ok(view.collectors.every((c) => c.connection === 'disabled'));
  assert.equal(view.routerHealth, 'unavailable');
  await request(
    'POST',
    `${ap}/configuration`,
    403,
    'ApiError',
    local,
    a.agentToken,
  );
  await request('POST', `${path}/router/test`, 403, 'ApiError', null, auth);
  await source.query(
    'UPDATE memberships SET role=\'OWNER\' WHERE "workspaceId"=$1 AND "userId"=$2',
    [workspace.id, alice.user.id],
  );

  await request('POST', `${ap}/pause`, 201, 'NetworkPaused', {}, a.agentToken);
  view = await request('GET', path, 200, 'NetworkView', null, auth);
  assert.equal(
    view.collectors.find((c) => c.agentId === a.agent.id).connection,
    'unavailable',
  );
  await request('GET', `${path}?from=not-a-date`, 400, 'ApiError', null, auth);
  const { checkNetworkAgentProcess } =
    await import('./network-agent-process-checks.mjs');
  await checkNetworkAgentProcess({
    apiURL,
    pair: b,
    workspaceId: workspace.id,
    networkId: site.networkId,
  });
  await source.query(
    'UPDATE network_collectors SET "observedAt"=$1 WHERE "agentId"=$2',
    [new Date(0), b.agent.id],
  );
  await maintainNetworks(source, workspace.id);
  view = await request('GET', path, 200, 'NetworkView', null, auth);
  assert.ok(view.events.some((e) => e.kind === 'collector_not_reporting'));
  await source.query(
    'UPDATE network_samples SET "observedAt"=$1 WHERE "routerId"=$2',
    [new Date(0), router.id],
  );
  await maintainNetworks(source, workspace.id);
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) FROM network_samples WHERE "routerId"=$1',
          [router.id],
        )
      )[0].count,
    ),
    0,
  );
  await request(
    'DELETE',
    `/workspaces/${workspace.id}/agents/${a.agent.id}/data`,
    200,
    null,
    null,
    auth,
  );
  view = await request('GET', path, 200, 'NetworkView', null, auth);
  assert.equal(view.router.credentialConfigured, false);
  assert.equal(view.endpoints.length, 2);
  assert.ok(
    view.endpoints.some((e) => e.id === endpoint.id),
    'Independently observed endpoint must survive one-source erasure',
  );
  await request(
    'DELETE',
    `/workspaces/${workspace.id}/agents/${b.agent.id}/data`,
    200,
    null,
    null,
    auth,
  );
  view = await request('GET', path, 200, 'NetworkView', null, auth);
  assert.equal(view.endpoints.length, 0);
  await request('DELETE', path, 200, 'NetworkRemoved', null, auth);
  console.log(
    'Passed named network gates, encrypted assigned-only credentials, replay consistency, exact WAN deltas/reset, source-scoped inventory, labels/events, current-role withdrawal, retention and multi-source erasure. All observations were synthetic.',
  );
}
