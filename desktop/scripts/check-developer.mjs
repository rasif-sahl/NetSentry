// Explicit fixture backend; native samples are the only processes this test stops.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile, lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { request, requestServices } from "../dist/main/agent-client.js";
import { validatePayload } from "../../contracts/scripts/validation.mjs";
const execute = promisify(execFile),
  binary = resolve(
    process.env.TEST_AGENT_BINARY || "../artifacts/netsentry-agent",
  );
const root = await mkdtemp("/tmp/nsdev-"),
  stateDir = join(root, "state");
const id = randomUUID(),
  workspaceId = randomUUID(),
  code = "c".repeat(43),
  token = "t".repeat(43);
let granted = true,
  revoked = false;
let child;
const samples = [];
const configuration = () => ({
  schemaVersion: 1,
  agentId: id,
  workspaceId,
  generation: 1,
  modules: { network: false, developer: granted },
  backgroundAllowed: false,
  remoteControlAllowed: false,
  heartbeatSeconds: 30,
  maxBufferedEvents: 1000,
  maxBufferBytes: 1048576,
  maxEventAgeSeconds: 86400,
  maxBatchEvents: 50,
  maxAttempts: 8,
  maxBackoffSeconds: 300,
});
const backend = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/agents/enrol") {
    assert.equal(body.token, code);
    res.end(
      JSON.stringify({
        agent: { id },
        agentToken: token,
        configuration: configuration(),
      }),
    );
    return;
  }
  if (revoked || req.headers.authorization !== `Bearer ${token}`) {
    res.writeHead(401);
    res.end("{}");
    return;
  }
  if (req.url.endsWith("/sync"))
    res.end(JSON.stringify({ accepted: body.events.length, duplicates: 0 }));
  else res.end(JSON.stringify(configuration()));
});
const options = { stateDir, binary };
const call = async (method, payload) => {
  const result = await requestServices(options, method, payload);
  validatePayload("local-ipc.v3.schema.json", {
    schemaVersion: 3,
    requestId: randomUUID(),
    method,
    payload,
  });
  validatePayload("local-ipc-response.v3.schema.json", {
    schemaVersion: 3,
    requestId: randomUUID(),
    ok: result.ok,
    code: result.ok ? "OK" : result.code,
    data: result.ok ? result.data : null,
  });
  return result;
};
async function sample(ignore = false) {
  const server = spawn(
    process.execPath,
    [
      "-e",
      `const net=require('node:net');${ignore ? "process.on('SIGTERM',()=>{});" : ""}const s=net.createServer();s.listen(0,'127.0.0.1',()=>console.log(s.address().port));`,
    ],
    { cwd: root, stdio: ["ignore", "pipe", "ignore"] },
  );
  samples.push(server);
  const port = await new Promise((resolve, reject) => {
    server.stdout.once("data", (data) => resolve(Number(String(data).trim())));
    server.once("error", reject);
  });
  return { server, port };
}
async function find(pid) {
  for (let offset = 0; ;) {
    const result = await call("list_services", { query: String(pid), offset });
    assert.equal(result.ok, true);
    const service = result.data.services.find((s) => s.pid === pid);
    if (service) return service;
    if (result.data.nextOffset < 0)
      throw new Error("Controlled native sample missing");
    offset = result.data.nextOffset;
  }
}
try {
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  await execute(binary, [
    "init",
    "--state-dir",
    stateDir,
    "--api",
    `http://127.0.0.1:${backend.address().port}`,
    "--development-store",
  ]);
  const file = join(root, "code");
  await writeFile(file, code, { mode: 0o600 });
  await execute(binary, ["pair", "--state-dir", stateDir, "--code-file", file]);
  await rm(file);
  await execute(binary, [
    "settings",
    "--state-dir",
    stateDir,
    "--developer=true",
  ]);
  child = spawn(binary, ["run", "--state-dir", stateDir], { stdio: "ignore" });
  for (let i = 0; i < 200; i++) {
    if (
      await lstat(join(stateDir, "agent.sock")).then(
        (s) => s.isSocket(),
        () => false,
      )
    )
      break;
    await delay(25);
  }
  let inventory = await call("list_services", { query: "", offset: 0 });
  assert.equal(inventory.ok, true);
  assert.equal(inventory.data.localControlAllowed, false);
  await call("set_local_control", { allowed: true });
  if (process.platform === "darwin") {
    await writeFile(join(root, "package.json"), "{}", { mode: 0o600 });
    const first = await sample(),
      unrelated = await sample();
    let service = await find(first.server.pid);
    assert.equal(service.canStop, true);
    assert.equal(service.project.source, "inferred");
    assert.ok(service.endpoints.some((e) => e.port === first.port));
    let result = await call("set_project", {
      serviceId: service.id,
      observationId: service.observationId,
      label: "Corrected fixture project",
    });
    assert.equal(result.ok, true);
    service = await find(first.server.pid);
    assert.equal(service.project.name, "Corrected fixture project");
    const input = {
      actionId: randomUUID(),
      serviceId: service.id,
      observationId: service.observationId,
      mode: "graceful",
      includeChildren: false,
    };
    await call("set_local_control", { allowed: false });
    result = await call("request_stop", input);
    assert.equal(result.code, "LOCAL_CONTROL_DISABLED");
    await call("set_local_control", { allowed: true });
    granted = false;
    result = await call("request_stop", input);
    assert.equal(result.code, "MODULE_DISABLED");
    granted = true;
    result = await call("request_stop", input);
    assert.equal(result.ok, true);
    assert.equal(result.data.outcome, "stopped");
    const duplicate = await call("request_stop", input);
    assert.deepEqual(duplicate, result);
    assert.equal(unrelated.server.exitCode, null);
    const stubborn = await sample(true);
    service = await find(stubborn.server.pid);
    const attempt = {
      actionId: randomUUID(),
      serviceId: service.id,
      observationId: service.observationId,
      mode: "graceful",
      includeChildren: false,
    };
    result = await call("request_stop", attempt);
    assert.equal(result.ok, true);
    assert.equal(result.data.outcome, "still_running");
    service = await find(stubborn.server.pid);
    result = await call("request_stop", {
      ...attempt,
      actionId: randomUUID(),
      observationId: service.observationId,
      serviceId: service.id,
      mode: "force",
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.outcome, "stopped");
    const history = await call("get_action_history", {});
    assert.equal(history.ok, true);
    assert.equal(history.data.length, 3);
    const serialized = await readFile(join(stateDir, "developer.json"), "utf8");
    assert.ok(!serialized.includes(root));
    assert.ok(!serialized.includes(token));
  } else {
    assert.equal(inventory.data.platformSupported, false);
    assert.equal(inventory.data.services.length, 0);
  }
  await request(options, "set_modules", { network: true, developer: false });
  assert.equal(
    (await call("list_services", { query: "", offset: 0 })).code,
    "MODULE_DISABLED",
  );
  await request(options, "set_modules", { network: false, developer: true });
  revoked = true;
  const denied = await call("list_services", { query: "", offset: 0 });
  assert.equal(denied.code, "AUTHORIZATION_UNAVAILABLE");
  const raw = await readFile(join(stateDir, "developer.json"), "utf8").catch(
    () => '{"history":[],"labels":{}}',
  );
  const erased = JSON.parse(raw);
  assert.equal(erased.history.length, 0);
  assert.deepEqual(erased.labels, {});
  assert.equal((await request(options, "get_status", {})).status.paired, false);
  console.log(
    "Passed authenticated developer IPC, wire schemas, independent local/workspace gates, native discovery/project corrections/graceful and force outcomes, deduplication, unrelated-process preservation and revocation erasure.",
  );
} finally {
  if (child && child.exitCode === null) {
    const closed = new Promise((r) => child.once("close", r));
    child.kill("SIGTERM");
    await closed;
  }
  for (const sample of samples) {
    if (sample.exitCode === null && sample.signalCode === null) {
      const closed = new Promise((r) => sample.once("close", r));
      sample.kill("SIGKILL");
      await closed;
    }
  }
  backend.closeAllConnections();
  await new Promise((resolve) => backend.close(resolve));
  await rm(root, { recursive: true, force: true });
}
