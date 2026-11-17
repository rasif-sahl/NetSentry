import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile, readFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const execute = promisify(execFile);
export async function checkAgentProcess({
  request,
  source,
  alice,
  workspace,
  apiURL,
}) {
  if (!process.env.TEST_AGENT_BINARY) {
    console.log(
      'Go process/backend integration pending: set TEST_AGENT_BINARY to enable.',
    );
    return;
  }
  const binary = resolve(process.env.TEST_AGENT_BINARY);
  const root = await mkdtemp('/tmp/nslive-');
  const dir = join(root, 'state');
  let offline = false;
  const server = createServer(async (req, res) => {
    if (offline) {
      res.writeHead(503);
      res.end();
      return;
    }
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const upstream = await fetch(`${apiURL}${req.url}`, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.authorization
            ? { Authorization: req.headers.authorization }
            : {}),
        },
        body: req.method === 'GET' ? undefined : Buffer.concat(chunks),
        redirect: 'manual',
      });
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(await upstream.text());
    } catch {
      res.writeHead(502);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const cli = async (args, success = true) => {
    let output;
    try {
      output = await execute(binary, [...args, '--state-dir', dir], {
        timeout: 15000,
        maxBuffer: 65536,
      });
      assert.equal(success, true);
    } catch (error) {
      if (success)
        throw new Error('Go process failed during live backend check');
      output = error;
    }
    return JSON.parse(output.stdout);
  };
  try {
    const initialized = await cli([
      'init',
      '--api',
      `http://127.0.0.1:${server.address().port}`,
      '--development-store',
    ]);
    const base = `/workspaces/${workspace.id}/agents`;
    const disclosure = await request('GET', '/agents/disclosure', 200, null);
    const definition = {
      installationId: initialized.installationId,
      platform: process.platform,
      name: 'Go process integration fixture',
      modules: { network: true, developer: false },
      backgroundAllowed: false,
      accepted: true,
      disclosureVersion: disclosure.version,
    };
    const code = await request(
      'POST',
      `${base}/enrolments`,
      201,
      null,
      definition,
      alice.accessToken,
    );
    const codeFile = join(root, 'code');
    await writeFile(codeFile, code.token, { mode: 0o600 });
    assert.equal((await cli(['pair', '--code-file', codeFile])).paired, true);
    await rm(codeFile);
    await cli([
      'settings',
      '--network=true',
      '--developer=true',
      '--allow-background=true',
    ]);
    const connected = await cli(['run', '--once']);
    assert.equal(connected.connection, 'online');
    assert.deepEqual(connected.requested, { network: true, developer: true });
    assert.deepEqual(connected.effective, { network: true, developer: false });
    assert.equal(connected.backgroundRequested, true);
    assert.equal(connected.backgroundAllowed, false);
    const agents = await request(
      'GET',
      base,
      200,
      null,
      null,
      alice.accessToken,
    );
    const agent = agents.find(
      (a) => a.installationId === initialized.installationId,
    );
    assert.ok(agent.lastSeenAt);
    assert.equal(agent.capabilities.network.enabled, true);
    assert.equal(agent.capabilities.developer.enabled, false);
    offline = true;
    const failed = await cli(['run', '--once'], false);
    assert.equal(failed.connection, 'offline');
    assert.equal(failed.bufferedEvents, 1);
    const queued = JSON.parse(await readFile(join(dir, 'outbox.json')));
    offline = false;
    assert.equal((await cli(['run', '--once'])).bufferedEvents, 0);
    const stored = await source.query(
      'SELECT "eventId" FROM agent_events WHERE "agentId"=$1',
      [agent.id],
    );
    assert.ok(stored.some((e) => e.eventId === queued.events[0].eventId));
    await request(
      'PATCH',
      `${base}/${agent.id}`,
      200,
      'Agent',
      {
        modules: { network: false, developer: false },
        backgroundAllowed: false,
        accepted: true,
        disclosureVersion: disclosure.version,
      },
      alice.accessToken,
    );
    assert.equal((await cli(['run', '--once'])).connection, 'online');
    assert.deepEqual((await cli(['run', '--once'])).effective, {
      network: false,
      developer: false,
    });
    await request(
      'DELETE',
      `${base}/${agent.id}`,
      200,
      'Agent',
      null,
      alice.accessToken,
    );
    const revoked = await cli(['run', '--once'], false);
    assert.equal(revoked.connection, 'revoked');
    assert.equal(revoked.paired, false);
    assert.equal(revoked.bufferedEvents, 0);
    assert.equal(
      await lstat(join(dir, 'development-backend.json')).then(
        () => true,
        () => false,
      ),
      false,
    );
    console.log(
      'Passed actual Go process → NestJS/PostgreSQL pairing, heartbeat, restart-persistent outage replay, configuration generation and credential revocation.',
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
}
