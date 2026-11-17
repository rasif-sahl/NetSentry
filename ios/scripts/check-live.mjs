// Dedicated empty *_test database only. Wraps the existing isolated fixture API in ephemeral trusted TLS.
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";
const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
assert.ok(
  process.env.TEST_DATABASE_URL &&
    new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test"),
);
assert.equal(
  process.platform,
  "darwin",
  "Use an existing macOS Swift host compiler; do not install mobile tools.",
);
const temp = await mkdtemp(resolve(tmpdir(), "netsentry-ios-live-"));
let fixture, server;
let redirectHits = 0,
  retryHits = 0;
try {
  const key = resolve(temp, "key.pem"),
    cert = resolve(temp, "cert.pem"),
    trust = resolve(temp, "cert.der");
  await execute("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    cert,
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
    "-addext",
    "extendedKeyUsage=serverAuth",
    "-addext",
    "keyUsage=digitalSignature,keyEncipherment",
  ]);
  await execute("openssl", [
    "x509",
    "-in",
    cert,
    "-outform",
    "der",
    "-out",
    trust,
  ]);
  fixture = spawn(
    process.execPath,
    ["backend/scripts/serve-dashboard-fixtures.mjs"],
    { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let failure = "";
  fixture.stderr.on("data", (chunk) => {
    failure = (failure + chunk).slice(-4000);
  });
  const ready = await Promise.race([
    new Promise((resolveReady) => {
      fixture.stdout.on("data", (chunk) => {
        if (String(chunk).includes("Synthetic dashboard fixtures ready"))
          resolveReady(true);
      });
      fixture.on("exit", () => resolveReady(false));
    }),
    new Promise((resolveReady) =>
      setTimeout(() => resolveReady(false), 30_000).unref(),
    ),
  ]);
  assert.ok(ready, `Fixture API did not start: ${failure}`);
  server = https.createServer(
    { key: await readFile(key), cert: await readFile(cert) },
    (request, response) => {
      if (request.url === "/api/v1/__redirect") {
        response.writeHead(302, {
          location: "/api/v1/__redirect-target",
          "content-type": "application/json",
        });
        response.end("{}");
        return;
      }
      if (request.url === "/api/v1/__redirect-target") {
        redirectHits++;
        response.writeHead(200);
        response.end("{}");
        return;
      }
      if (request.url === "/api/v1/__retry") {
        retryHits++;
        request.resume();
        response.writeHead(503, {
          "retry-after": "0",
          "content-type": "application/json",
        });
        response.end('{"code":"SYNTHETIC_RETRY","message":"Synthetic retry"}');
        return;
      }
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: 54110,
          path: request.url,
          method: request.method,
          headers: { ...request.headers, host: "127.0.0.1:54110" },
        },
        (result) => {
          response.writeHead(result.statusCode, result.headers);
          result.pipe(response);
        },
      );
      upstream.on("error", () => {
        response.writeHead(502);
        response.end("{}");
      });
      request.pipe(upstream);
    },
  );
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  const binary = resolve(temp, "live-checks");
  await execute("bash", ["ios/scripts/check-core.sh"], {
    cwd: root,
    env: { ...process.env, IOS_LIVE_OUTPUT: binary },
    timeout: 180000,
    maxBuffer: 1000000,
  });
  const result = await execute(
    binary,
    [
      `https://127.0.0.1:${server.address().port}/api/v1`,
      resolve(root, "dashboard/.test/fixtures.json"),
      trust,
    ],
    { env: process.env, timeout: 120000 },
  );
  assert.equal(redirectHits, 0, "Redirect target must never be followed.");
  assert.equal(
    retryHits,
    1,
    "One-shot mutations must not be automatically retried after 503.",
  );
  console.log(result.stdout.trim());
} finally {
  if (server) await new Promise((done) => server.close(done));
  if (fixture && fixture.exitCode === null) {
    const exited = new Promise((done) => fixture.once("exit", done));
    fixture.kill("SIGTERM");
    await exited;
  }
  await rm(temp, { recursive: true, force: true });
}
