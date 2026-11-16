// Dedicated empty *_test database only. Wraps the existing isolated fixture API in ephemeral trusted TLS.
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';
const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
assert.ok(process.env.TEST_DATABASE_URL && new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test'));
const { JAVA_HOME, KOTLINC, JSON_JAR } = process.env;
assert.ok(JAVA_HOME && KOTLINC && JSON_JAR, 'Supply existing standalone JVM tools.');
const temp = await mkdtemp(resolve(tmpdir(), 'netsentry-android-live-'));
let fixture, server;
try {
  const key = resolve(temp, 'key.pem'), cert = resolve(temp, 'cert.pem'), trust = resolve(temp, 'trust.p12');
  await execute('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1']);
  await execute(resolve(JAVA_HOME, 'bin/keytool'), ['-importcert', '-noprompt', '-alias', 'fixture', '-file', cert, '-keystore', trust, '-storepass', 'fixture-only-password']);
  fixture = spawn(process.execPath, ['backend/scripts/serve-dashboard-fixtures.mjs'], { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let failure = '';
  fixture.stderr.on('data', (chunk) => { failure = (failure + chunk).slice(-4000); });
  const ready = await Promise.race([
    new Promise((resolveReady) => { fixture.stdout.on('data', (chunk) => { if (String(chunk).includes('Synthetic dashboard fixtures ready')) resolveReady(true); }); fixture.on('exit', () => resolveReady(false)); }),
    new Promise((resolveReady) => setTimeout(() => resolveReady(false), 30_000).unref()),
  ]);
  assert.ok(ready, `Fixture API did not start: ${failure}`);
  server = https.createServer({ key: await readFile(key), cert: await readFile(cert) }, (request, response) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: 54110, path: request.url, method: request.method, headers: { ...request.headers, host: '127.0.0.1:54110' } }, (result) => {
      response.writeHead(result.statusCode, result.headers); result.pipe(response);
    });
    upstream.on('error', () => { response.writeHead(502); response.end('{}'); }); request.pipe(upstream);
  });
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
  const jar = resolve(temp, 'live.jar');
  const source = resolve(root, 'android/app/src/main/java/com/netsentry/app');
  await execute(KOTLINC, [resolve(source, 'core/Policy.kt'), ...['Api', 'Wire', 'Repository'].map((name) => resolve(source, `data/${name}.kt`)), resolve(root, 'android/test/LiveChecks.kt'), '-cp', JSON_JAR, '-include-runtime', '-d', jar], { env: process.env });
  const result = await execute(resolve(JAVA_HOME, 'bin/java'), [`-Djavax.net.ssl.trustStore=${trust}`, '-Djavax.net.ssl.trustStorePassword=fixture-only-password', '-cp', `${jar}:${JSON_JAR}`, 'LiveChecksKt', `https://127.0.0.1:${server.address().port}/api/v1`, resolve(root, 'dashboard/.test/fixtures.json')], { env: process.env });
  console.log(result.stdout.trim());
} finally {
  if (server) await new Promise((done) => server.close(done));
  if (fixture && fixture.exitCode === null) { const exited = new Promise((done) => fixture.once('exit', done)); fixture.kill('SIGTERM'); await exited; }
  await rm(temp, { recursive: true, force: true });
}
