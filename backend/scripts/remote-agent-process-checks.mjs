import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const execute = promisify(execFile);
export async function checkRemoteAgentProcess({
  request,
  source,
  alice,
  workspace,
  apiURL,
}) {
  if (process.platform !== 'darwin' || !process.env.TEST_AGENT_BINARY) {
    console.log(
      'Actual native remote-stop integration pending on this runner: requires macOS and TEST_AGENT_BINARY.',
    );
    return;
  }
  const root = await mkdtemp('/tmp/nsremote-'),
    stateDir = join(root, 'agent'),
    binary = resolve(process.env.TEST_AGENT_BINARY),
    samples = [];
  let child,
    offline = false;
  const proxy = createServer(async (req, res) => {
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
  async function sample() {
    const s = spawn(
      process.execPath,
      [
        '-e',
        `const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>console.log(s.address().port));`,
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    samples.push(s);
    await new Promise((resolve, reject) => {
      s.stdout.once('data', resolve);
      s.once('error', reject);
    });
    return s;
  }
  async function until(read, check, message) {
    for (let i = 0; i < 50; i++) {
      const result = await read();
      if (check(result)) return result;
      await delay(300);
    }
    throw new Error(message);
  }
  const base = `/workspaces/${workspace.id}/agents`,
    auth = alice.accessToken;
  try {
    await writeFile(join(root, 'package.json'), '{}', { mode: 0o600 });
    const first = await sample(),
      other = await sample();
    await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
    const initialized = JSON.parse(
      (
        await execute(binary, [
          'init',
          '--state-dir',
          stateDir,
          '--api',
          `http://127.0.0.1:${proxy.address().port}`,
          '--development-store',
        ])
      ).stdout,
    );
    const code = await request(
      'POST',
      `${base}/enrolments`,
      201,
      null,
      {
        installationId: initialized.installationId,
        platform: 'darwin',
        name: 'Controlled native remote integration',
        modules: { network: false, developer: true },
        backgroundAllowed: false,
        accepted: true,
        disclosureVersion: 'agent-enrolment-v1',
      },
      auth,
    );
    const codeFile = join(root, 'code');
    await writeFile(codeFile, code.token, { mode: 0o600 });
    await execute(binary, [
      'pair',
      '--state-dir',
      stateDir,
      '--code-file',
      codeFile,
    ]);
    await rm(codeFile);
    const agent = (await request('GET', base, 200, null, null, auth)).find(
        (a) => a.installationId === initialized.installationId,
      ),
      id = agent.id,
      commands = `${base}/${id}/commands`;
    const policy = {
      sharingAllowed: true,
      controllers: [alice.user.id],
      accepted: true,
      disclosureVersion: 'developer-sharing-v1',
    };
    await request(
      'PATCH',
      `${base}/${id}/developer-policy`,
      200,
      'DeveloperPolicy',
      policy,
      auth,
    );
    await execute(binary, [
      'settings',
      '--state-dir',
      stateDir,
      '--developer=true',
      '--share-services=true',
      '--allow-remote-control=true',
      '--accept-remote-disclosure',
    ]);
    child = spawn(binary, ['run', '--state-dir', stateDir], {
      stdio: 'ignore',
    });
    const find = async (pid) => {
      const list = await request(
        'GET',
        `/workspaces/${workspace.id}/developer`,
        200,
        null,
        null,
        auth,
      );
      return list.find((c) => c.id === id)?.services.find((s) => s.pid === pid);
    };
    const target = await until(
      () => find(first.pid),
      (s) => !!s,
      'Native shared sample was not reported',
    );
    const input = (s) => ({
      requestId: randomUUID(),
      serviceId: s.serviceId,
      observationId: s.observationId,
      mode: 'graceful',
      includeChildren: false,
    });
    const command = await request(
      'POST',
      commands,
      201,
      'RemoteCommand',
      input(target),
      auth,
    );
    const history = await until(
      () => request('GET', commands, 200, null, null, auth),
      (items) =>
        items.some(
          (c) =>
            c.id === command.id && ['succeeded', 'failed'].includes(c.state),
        ),
      'Native remote outcome was not returned',
    );
    const result = history.find((c) => c.id === command.id);
    assert.equal(
      result.state,
      'succeeded',
      `Native remote command outcome was ${result.outcome}`,
    );
    assert.equal(result.outcome, 'stopped');
    assert.equal(other.exitCode, null);
    assert.equal(other.signalCode, null);
    const cancelTarget = await until(
      () => find(other.pid),
      (s) => !!s,
      'Unrelated sample missing after first stop',
    );
    offline = true;
    const cancelled = await request(
      'POST',
      commands,
      201,
      'RemoteCommand',
      input(cancelTarget),
      auth,
    );
    await request(
      'POST',
      `${commands}/${cancelled.id}/cancel`,
      201,
      'RemoteCommand',
      {},
      auth,
    );
    offline = false;
    await delay(3500);
    assert.equal(other.exitCode, null);
    assert.equal(other.signalCode, null);
    const fresh = await until(
      () => find(other.pid),
      (s) => !!s && Date.now() - Date.parse(s.observedAt) < 5000,
      'Fresh report missing after reconnect',
    );
    offline = true;
    const expired = await request(
      'POST',
      commands,
      201,
      'RemoteCommand',
      input(fresh),
      auth,
    );
    await source.query(
      'UPDATE developer_commands SET "expiresAt"=now()-interval \'1 second\' WHERE id=$1',
      [expired.id],
    );
    offline = false;
    await until(
      () => request('GET', commands, 200, null, null, auth),
      (items) =>
        items.some((c) => c.id === expired.id && c.state === 'expired'),
      'Expired command not finalized',
    );
    await delay(3500);
    assert.equal(other.exitCode, null);
    assert.equal(other.signalCode, null);
    await request('DELETE', `${base}/${id}/data`, 200, 'Agent', null, auth);
    console.log(
      'Passed actual API → PostgreSQL → outbound Go agent → native Node shutdown → confirmed outcome; unrelated server preserved, cancelled and expired commands did not execute after reconnection.',
    );
  } finally {
    if (child && child.exitCode === null) {
      const closed = new Promise((r) => child.once('close', r));
      child.kill('SIGTERM');
      await closed;
    }
    for (const s of samples) {
      if (s.exitCode === null && s.signalCode === null) {
        const closed = new Promise((r) => s.once('close', r));
        s.kill('SIGKILL');
        await closed;
      }
    }
    proxy.closeAllConnections();
    await new Promise((resolve) => proxy.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
}
