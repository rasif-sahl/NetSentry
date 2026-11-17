import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp,
  rm,
  lstat,
  chmod,
  readFile,
  writeFile,
  symlink,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { request, digest } from "../dist/main/agent-client.js";
const execute = promisify(execFile);
const binary = resolve(
  process.env.TEST_AGENT_BINARY || "../artifacts/netsentry-agent",
);
const root = await mkdtemp("/tmp/nsipc-");
const stateDir = join(root, "state");
let child;
try {
  const vector = JSON.parse(
    await readFile(
      new URL("../../contracts/fixtures/local-auth.v1.json", import.meta.url),
    ),
  );
  assert.equal(
    digest(
      vector.secret,
      "netsentry-local/v1",
      vector.challenge.nonce,
      vector.challenge.instanceId,
      vector.clientNonce,
    ),
    vector.proof,
  );
  assert.equal(
    digest(
      vector.secret,
      "netsentry-local/v1/accepted",
      vector.challenge.nonce,
      vector.challenge.instanceId,
      vector.clientNonce,
    ),
    vector.acknowledgement,
  );
  await execute(binary, [
    "init",
    "--state-dir",
    stateDir,
    "--api",
    "http://127.0.0.1:1/api/v1",
    "--development-store",
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
  const options = { stateDir, binary };
  let result = await request(options, "get_status", {});
  assert.equal(result.ok, true);
  assert.equal(result.status.connection, "unpaired");
  assert.equal(result.status.serviceControlAvailable, false);
  assert.deepEqual(result.status.effective, {
    network: false,
    developer: false,
  });
  result = await request(options, "set_modules", {
    network: true,
    developer: false,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.status.requested, {
    network: true,
    developer: false,
  });
  assert.deepEqual(result.status.effective, {
    network: false,
    developer: false,
  });
  result = await request(options, "set_background", { allowed: true });
  assert.equal(result.ok, true);
  assert.equal(result.status.backgroundRequested, true);
  assert.equal(result.status.backgroundAllowed, false);
  assert.equal(
    (await request(options, "request_stop", {})).code,
    "INVALID_REQUEST",
  );
  assert.equal(
    (
      await request(options, "set_modules", {
        network: true,
        developer: true,
        shell: "anything",
      })
    ).code,
    "INVALID_REQUEST",
  );
  assert.equal(
    (await request(options, "pair", { token: "short" })).code,
    "INVALID_REQUEST",
  );
  const secretFile = join(stateDir, "development-ipc.json");
  const original = await readFile(secretFile);
  await writeFile(secretFile, JSON.stringify({ value: "ff".repeat(32) }), {
    mode: 0o600,
  });
  assert.equal(
    (await request(options, "get_status", {})).code,
    "AGENT_UNAVAILABLE",
  );
  await writeFile(secretFile, original);
  await chmod(join(stateDir, "agent.sock"), 0o666);
  assert.equal(
    (await request(options, "get_status", {})).code,
    "AGENT_UNAVAILABLE",
  );
  await chmod(join(stateDir, "agent.sock"), 0o600);
  await symlink(stateDir, join(root, "link"));
  assert.equal(
    (
      await request(
        { ...options, stateDir: join(root, "link") },
        "get_status",
        {},
      )
    ).code,
    "AGENT_UNAVAILABLE",
  );
  await assert.rejects(
    execute(binary, ["run", "--state-dir", stateDir], { timeout: 5000 }),
  );
  assert.equal((await request(options, "get_status", {})).ok, true);
  const disk = JSON.parse(await readFile(join(stateDir, "config.json")));
  assert.equal(disk.backgroundAllowed, true);
  assert.deepEqual(disk.requested, { network: true, developer: false });
  console.log(
    "Passed Node–Go socket authentication, shared HMAC vectors, module isolation, settings persistence, bad-secret/path/permission rejection and duplicate-start protection.",
  );
} finally {
  if (child && child.exitCode === null) {
    const closed = new Promise((r) => child.once("close", r));
    child.kill("SIGTERM");
    await closed;
  }
  await rm(root, { recursive: true, force: true });
}
