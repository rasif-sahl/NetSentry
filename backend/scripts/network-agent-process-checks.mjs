import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
export async function checkNetworkAgentProcess({
  apiURL,
  pair,
  workspaceId,
  networkId,
}) {
  const binary = process.env.TEST_NETWORK_RUNNER_BINARY;
  if (!binary) {
    console.log(
      'Go network runner/live API bridge pending: set TEST_NETWORK_RUNNER_BINARY (test-only harness).',
    );
    return;
  }
  const dir = await mkdtemp('/tmp/ns-network-api-');
  let seen = 0,
    previous;
  const failures = [];
  const proxy = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const upstream = await fetch(apiURL + req.url, {
        method: req.method,
        headers: {
          'content-type': 'application/json',
          authorization: req.headers.authorization ?? '',
        },
        body: body.length ? body : undefined,
      });
      const result = await upstream.text();
      assert.equal(upstream.status, 201);
      if (req.url.endsWith('/snapshot')) {
        seen++;
        if (seen === 1) {
          previous = body.toString();
          res.writeHead(502);
          res.end('{}');
          return;
        }
        assert.equal(body.toString(), previous);
        assert.equal(JSON.parse(result).replayed, true);
      }
      res.writeHead(upstream.status, { 'content-type': 'application/json' });
      res.end(result);
    } catch (e) {
      failures.push(e);
      res.writeHead(500);
      res.end('{}');
    }
  });
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  try {
    const input = join(dir, 'input.json');
    await writeFile(
      input,
      JSON.stringify({
        apiUrl: `http://127.0.0.1:${proxy.address().port}`,
        agentId: pair.agent.id,
        workspaceId,
        networkId,
        token: pair.agentToken,
      }),
      { mode: 0o600 },
    );
    await promisify(execFile)(
      binary,
      ['-test.run=^TestNetworkAPIBridge$', '-test.v'],
      {
        env: { ...process.env, NETSENTRY_NETWORK_TEST_INPUT: input },
        timeout: 30000,
      },
    );
    assert.deepEqual(failures, []);
    assert.equal(seen, 2);
    console.log(
      'Actual Go runner → API → PostgreSQL bridge passed consent/configuration/snapshot wire shapes and exact lost-acknowledgement replay using test-only discovery fixtures.',
    );
  } finally {
    await new Promise((r) => proxy.close(r));
    await rm(dir, { recursive: true, force: true });
  }
}
