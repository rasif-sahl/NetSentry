import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function checkRemoteCommands({
  request,
  source,
  alice,
  bob,
  workspace,
}) {
  const base = `/workspaces/${workspace.id}/agents`,
    auth = alice.accessToken;
  const definition = {
    installationId: randomUUID(),
    platform: 'darwin',
    name: 'Synthetic remote protocol fixture',
    modules: { network: false, developer: true },
    backgroundAllowed: false,
    accepted: true,
    disclosureVersion: 'agent-enrolment-v1',
  };
  const code = await request(
    'POST',
    `${base}/enrolments`,
    201,
    null,
    definition,
    auth,
  );
  const paired = await request('POST', '/agents/enrol', 201, null, {
    token: code.token,
    installationId: definition.installationId,
    platform: definition.platform,
  });
  const id = paired.agent.id,
    token = paired.agentToken,
    remote = `/agents/${id}/developer`,
    commands = `${base}/${id}/commands`;
  await request(
    'POST',
    `/agents/${id}/heartbeat`,
    201,
    'AgentConfiguration',
    {
      schemaVersion: 1,
      generation: paired.agent.generation,
      version: '0.7.0',
      architecture: 'arm64',
      reportedAt: new Date().toISOString(),
      requested: { network: false, developer: true },
      backgroundAllowed: false,
      droppedEvents: 0,
    },
    token,
  );
  const policy = {
    sharingAllowed: true,
    controllers: [alice.user.id],
    accepted: true,
    disclosureVersion: 'developer-sharing-v1',
  };
  const service = {
    serviceId: 'a'.repeat(64),
    observationId: randomUUID(),
    pid: 12345,
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    observedAt: new Date().toISOString(),
    runtime: 'Node.js',
    project: 'Synthetic shared project',
    ports: [3000],
    canStop: true,
    childCount: 0,
  };
  const input = () => ({
    requestId: randomUUID(),
    serviceId: service.serviceId,
    observationId: service.observationId,
    mode: 'graceful',
    includeChildren: false,
  });
  await request('POST', commands, 403, 'ApiError', input(), auth);
  let p = await request(
    'PATCH',
    `${base}/${id}/developer-policy`,
    200,
    'DeveloperPolicy',
    policy,
    auth,
  );
  const publish = async () => {
    service.observationId = randomUUID();
    service.observedAt = new Date().toISOString();
    return request(
      'POST',
      `${remote}/snapshot`,
      201,
      null,
      {
        schemaVersion: 1,
        generation: paired.agent.generation,
        revision: p.revision,
        localControlReady: true,
        platformSupported: true,
        total: 1,
        services: [service],
      },
      token,
    );
  };
  await publish();
  await request(
    'GET',
    `/workspaces/${workspace.id}/developer`,
    403,
    'ApiError',
    null,
    bob.accessToken,
  );
  await source.query(
    'INSERT INTO memberships ("workspaceId","userId",role) VALUES ($1,$2,\'MEMBER\')',
    [workspace.id, bob.user.id],
  );
  await request(
    'PATCH',
    `${base}/${id}/developer-policy`,
    403,
    'ApiError',
    { ...policy, controllers: [bob.user.id] },
    auth,
  );
  await request('POST', commands, 403, 'ApiError', input(), bob.accessToken);
  const listed = await request(
    'GET',
    `/workspaces/${workspace.id}/developer`,
    200,
    null,
    null,
    bob.accessToken,
  );
  assert.ok(
    listed.some(
      (c) => c.id === id && c.services.length === 1 && c.canControl === false,
    ),
  );
  const firstInput = input(),
    first = await request(
      'POST',
      commands,
      201,
      'RemoteCommand',
      firstInput,
      auth,
    );
  const duplicate = await request(
    'POST',
    commands,
    201,
    'RemoteCommand',
    firstInput,
    auth,
  );
  assert.equal(first.id, duplicate.id);
  await request(
    'POST',
    commands,
    409,
    'ApiError',
    { ...firstInput, mode: 'force' },
    auth,
  );
  let poll = await request('POST', `${remote}/poll`, 201, null, {}, token);
  assert.equal(poll.command.id, first.id);
  assert.equal(poll.command.state, 'accepted');
  assert.ok(!JSON.stringify(poll).includes('leaseHash'));
  await request(
    'POST',
    `${commands}/${first.id}/cancel`,
    201,
    'RemoteCommand',
    {},
    auth,
  );
  await request(
    'POST',
    `${remote}/commands/${first.id}/start`,
    409,
    'ApiError',
    { leaseToken: poll.command.leaseToken },
    token,
  );
  await publish();
  const expiry = await request(
    'POST',
    commands,
    201,
    'RemoteCommand',
    input(),
    auth,
  );
  await source.query(
    'UPDATE developer_commands SET "expiresAt"=now()-interval \'1 second\' WHERE id=$1',
    [expiry.id],
  );
  assert.equal(
    (await request('POST', `${remote}/poll`, 201, null, {}, token)).command,
    null,
  );
  assert.equal(
    (await request('GET', commands, 200, null, null, auth)).find(
      (c) => c.id === expiry.id,
    ).state,
    'expired',
  );
  await publish();
  const executing = await request(
    'POST',
    commands,
    201,
    'RemoteCommand',
    input(),
    auth,
  );
  poll = await request('POST', `${remote}/poll`, 201, null, {}, token);
  await request(
    'POST',
    `${remote}/commands/${executing.id}/start`,
    401,
    'ApiError',
    { leaseToken: 'x'.repeat(43) },
    token,
  );
  await request(
    'POST',
    `${remote}/commands/${executing.id}/start`,
    201,
    null,
    { leaseToken: poll.command.leaseToken },
    token,
  );
  await request(
    'POST',
    `${commands}/${executing.id}/cancel`,
    409,
    'ApiError',
    {},
    auth,
  );
  await request(
    'POST',
    `${remote}/commands/${executing.id}/start`,
    409,
    'ApiError',
    { leaseToken: poll.command.leaseToken },
    token,
  );
  const result = { leaseToken: poll.command.leaseToken, outcome: 'stopped' };
  await request(
    'POST',
    `${remote}/commands/${executing.id}/result`,
    201,
    null,
    result,
    token,
  );
  await request(
    'POST',
    `${remote}/commands/${executing.id}/result`,
    201,
    null,
    result,
    token,
  );
  await request(
    'POST',
    `${remote}/commands/${executing.id}/result`,
    409,
    'ApiError',
    { ...result, outcome: 'still_running' },
    token,
  );
  const history = await request('GET', commands, 200, null, null, auth),
    done = history.find((c) => c.id === executing.id);
  assert.equal(done.state, 'succeeded');
  assert.deepEqual(
    new Set(done.audit.map((a) => a.event)),
    new Set(['requested', 'accepted', 'execution_started', 'succeeded']),
  );
  assert.ok(!JSON.stringify(history).includes('leaseHash'));
  assert.ok(!JSON.stringify(history).includes('fingerprint'));
  await publish();
  const revoked = await request(
    'POST',
    commands,
    201,
    'RemoteCommand',
    input(),
    auth,
  );
  poll = await request('POST', `${remote}/poll`, 201, null, {}, token);
  p = await request(
    'PATCH',
    `${base}/${id}/developer-policy`,
    200,
    'DeveloperPolicy',
    { ...policy, controllers: [] },
    auth,
  );
  await request(
    'POST',
    `${remote}/commands/${revoked.id}/start`,
    403,
    'ApiError',
    { leaseToken: poll.command.leaseToken },
    token,
  );
  assert.equal(
    (await request('GET', commands, 200, null, null, auth)).find(
      (c) => c.id === revoked.id,
    ).state,
    'cancelled',
  );
  await request('DELETE', `${base}/${id}/data`, 200, 'Agent', null, auth);
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM developer_commands WHERE "agentId"=$1',
        [id],
      )
    )[0].n,
    0,
  );
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM agent_developer WHERE "agentId"=$1',
        [id],
      )
    )[0].n,
    0,
  );
  await source.query(
    'DELETE FROM memberships WHERE "workspaceId"=$1 AND "userId"=$2',
    [workspace.id, bob.user.id],
  );
  console.log(
    'Passed remote grant/role separation, service snapshots, immutable requests, lease acceptance/start, cancellation, expiry, revocation, idempotent results, audit and erasure against PostgreSQL.',
  );
}
