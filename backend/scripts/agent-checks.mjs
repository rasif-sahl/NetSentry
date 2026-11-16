import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function checkAgents({ request, source, alice, bob, workspace }) {
  const base = `/workspaces/${workspace.id}/agents`,
    auth = alice.accessToken;
  const disclosure = await request('GET', '/agents/disclosure', 200, null);
  assert.equal(disclosure.version, 'agent-enrolment-v1');
  const definition = {
    installationId: randomUUID(),
    platform: 'darwin',
    name: 'Synthetic desktop core',
    modules: { network: true, developer: true },
    backgroundAllowed: false,
    accepted: true,
    disclosureVersion: disclosure.version,
  };
  await request(
    'POST',
    `${base}/enrolments`,
    400,
    'ApiError',
    { ...definition, modules: undefined },
    auth,
  );
  const code = await request(
    'POST',
    `${base}/enrolments`,
    201,
    null,
    definition,
    auth,
  );
  await request('POST', '/agents/enrol', 400, 'ApiError', {
    token: code.token,
    installationId: randomUUID(),
    platform: 'darwin',
  });
  const pair = await request('POST', '/agents/enrol', 201, null, {
    token: code.token,
    installationId: definition.installationId,
    platform: 'darwin',
  });
  const id = pair.agent.id,
    token = pair.agentToken;
  await request('POST', '/agents/enrol', 400, 'ApiError', {
    token: code.token,
    installationId: definition.installationId,
    platform: 'darwin',
  });
  await request(
    'GET',
    `/agents/${id}/configuration`,
    401,
    'ApiError',
    null,
    auth,
  );
  await request('GET', '/auth/me', 401, 'ApiError', null, token);
  assert.equal(pair.configuration.remoteControlAllowed, false);
  const input = {
    schemaVersion: 1,
    generation: pair.agent.generation,
    version: '0.5.0',
    architecture: 'arm64',
    reportedAt: new Date().toISOString(),
    requested: { network: true, developer: false },
    backgroundAllowed: false,
    droppedEvents: 0,
  };
  await request(
    'POST',
    `/agents/${id}/heartbeat`,
    201,
    'AgentConfiguration',
    input,
    token,
  );
  await request(
    'POST',
    `/agents/${id}/heartbeat`,
    400,
    'ApiError',
    { ...input, remoteControlAllowed: true },
    token,
  );
  const event = {
    eventId: randomUUID(),
    kind: 'diagnostic',
    code: 'CONNECTION_LOST',
    occurredAt: new Date().toISOString(),
  };
  const batch = {
    schemaVersion: 1,
    generation: pair.agent.generation,
    events: [event],
  };
  const responses = await Promise.all([
    request('POST', `/agents/${id}/sync`, 201, null, batch, token),
    request('POST', `/agents/${id}/sync`, 201, null, batch, token),
  ]);
  assert.equal(
    responses.reduce((n, r) => n + r.accepted, 0),
    1,
  );
  assert.equal(
    responses.reduce((n, r) => n + r.duplicates, 0),
    1,
  );
  await request(
    'POST',
    `/agents/${id}/sync`,
    409,
    'ApiError',
    { ...batch, events: [{ ...event, code: 'CONFIG_CHANGED' }] },
    token,
  );
  await request(
    'POST',
    `/agents/${id}/sync`,
    400,
    'ApiError',
    {
      ...batch,
      events: [
        {
          ...event,
          eventId: randomUUID(),
          code: 'ARBITRARY_PROCESS_ARGUMENTS',
        },
      ],
    },
    token,
  );
  const listed = await request('GET', base, 200, null, null, auth);
  assert.ok(
    listed.some(
      (a) => a.id === id && a.capabilities.developer.enabled === false,
    ),
  );
  assert.ok(!JSON.stringify(listed).includes('credentialHash'));
  await request('GET', base, 403, 'ApiError', null, bob.accessToken);
  await source.query(
    'INSERT INTO memberships ("workspaceId","userId",role) VALUES ($1,$2,\'MEMBER\')',
    [workspace.id, bob.user.id],
  );
  await request(
    'POST',
    `${base}/enrolments`,
    403,
    'ApiError',
    { ...definition, installationId: randomUUID() },
    bob.accessToken,
  );
  const bobDefinition = {
    ...definition,
    installationId: randomUUID(),
    modules: { network: false, developer: true },
  };
  const bobCode = await request(
    'POST',
    `${base}/enrolments`,
    201,
    null,
    bobDefinition,
    bob.accessToken,
  );
  const bobPair = await request('POST', '/agents/enrol', 201, null, {
    token: bobCode.token,
    installationId: bobDefinition.installationId,
    platform: 'darwin',
  });
  await request(
    'PATCH',
    `${base}/${id}`,
    403,
    'ApiError',
    {
      modules: { network: false, developer: false },
      backgroundAllowed: false,
      accepted: true,
      disclosureVersion: disclosure.version,
    },
    bob.accessToken,
  );
  await request(
    'DELETE',
    `/workspaces/${workspace.id}/members/${bob.user.id}`,
    200,
    null,
    null,
    auth,
  );
  await request(
    'GET',
    `/agents/${bobPair.agent.id}/configuration`,
    403,
    'ApiError',
    null,
    bobPair.agentToken,
  );
  await request(
    'DELETE',
    `${base}/${bobPair.agent.id}/data`,
    200,
    'Agent',
    null,
    bob.accessToken,
  );
  await source.query('DELETE FROM agents WHERE id=$1', [bobPair.agent.id]);
  const changed = await request(
    'PATCH',
    `${base}/${id}`,
    200,
    'Agent',
    {
      modules: { network: false, developer: false },
      backgroundAllowed: false,
      accepted: true,
      disclosureVersion: disclosure.version,
    },
    auth,
  );
  assert.ok(changed.generation > pair.agent.generation);
  await request('POST', `/agents/${id}/sync`, 409, 'ApiError', batch, token);
  await source.query(
    `UPDATE agent_events SET "receivedAt"=now()-interval '8 days' WHERE "agentId"=$1`,
    [id],
  );
  await source.query(
    `UPDATE agent_enrolments SET "expiresAt"=now()-interval '1 day' WHERE "workspaceId"=$1`,
    [workspace.id],
  );
  const { cleanupAgents } = await import('../dist/agents/cleanup.js');
  const cleaned = await cleanupAgents(source, workspace.id);
  assert.equal(cleaned.eventsRemoved, 1);
  assert.ok(Number.isInteger(cleaned.codesRemoved) && cleaned.codesRemoved > 0);
  assert.deepEqual(await cleanupAgents(source, workspace.id), {
    eventsRemoved: 0,
    codesRemoved: 0,
  });
  await request('DELETE', `${base}/${id}`, 200, 'Agent', null, auth);
  await request(
    'GET',
    `/agents/${id}/configuration`,
    401,
    'ApiError',
    null,
    token,
  );
  const renewedCode = await request(
    'POST',
    `${base}/enrolments`,
    201,
    null,
    definition,
    auth,
  );
  const renewed = await request('POST', '/agents/enrol', 201, null, {
    token: renewedCode.token,
    installationId: definition.installationId,
    platform: 'darwin',
  });
  assert.equal(renewed.agent.id, id);
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM agent_events WHERE "agentId"=$1',
        [id],
      )
    )[0].n,
    0,
  );
  await request('POST', `${base}/enrolments`, 201, null, definition, auth);
  await request('DELETE', `${base}/${id}/data`, 200, 'Agent', null, auth);
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM agent_events WHERE "agentId"=$1',
        [id],
      )
    )[0].n,
    0,
  );
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM agent_enrolments WHERE "installationId"=$1 AND "userId"=$2',
        [definition.installationId, alice.user.id],
      )
    )[0].n,
    0,
  );
  console.log(
    'Passed agent pairing/binding/replay, distinct credentials, module scope, diagnostic deduplication, generation changes, membership revocation and erasure.',
  );
}
