import test from "node:test";
import assert from "node:assert/strict";
import {
  readJSON,
  validatePayload,
  validateApiPayload,
} from "../scripts/validation.mjs";

const fixture = (name) => readJSON(`fixtures/${name}.v1.json`);

test("unsupported capabilities cannot advertise executable actions", () => {
  const report = fixture("device-capabilities");
  report.capabilities[0].availableActions = ["measure"];
  assert.throws(() =>
    validatePayload("device-capabilities.v1.schema.json", report),
  );
});
test("capabilities reject duplicates and future check times", () => {
  const report = fixture("device-capabilities");
  report.capabilities.push(structuredClone(report.capabilities[0]));
  assert.throws(
    () => validatePayload("device-capabilities.v1.schema.json", report),
    /unique/,
  );
  report.capabilities.pop();
  report.capabilities[0].checkedAt = "2026-11-16T00:00:00Z";
  assert.throws(
    () => validatePayload("device-capabilities.v1.schema.json", report),
    /report time/,
  );
});
test("view permission alone never becomes control permission", () => {
  validatePayload(
    "service-permissions.v1.schema.json",
    fixture("service-permissions"),
  );
  const permission = fixture("service-permissions");
  permission.canViewServices = false;
  permission.canControlServices = true;
  assert.throws(() =>
    validatePayload("service-permissions.v1.schema.json", permission),
  );
});
test("measurements reject invalid units, intervals and ambiguous timestamps", () => {
  const measurement = fixture("measurement");
  measurement.unit = "seconds";
  assert.throws(() =>
    validatePayload("measurement.v1.schema.json", measurement),
  );
  measurement.unit = "bytes";
  measurement.intervalEnd = measurement.intervalStart;
  assert.throws(
    () => validatePayload("measurement.v1.schema.json", measurement),
    /positive duration/,
  );
  measurement.intervalEnd = "2026-11-15T00:01:00";
  assert.throws(() =>
    validatePayload("measurement.v1.schema.json", measurement),
  );
});
test("per-app measurement requires application identity", () => {
  const measurement = fixture("measurement");
  measurement.metric = "application_foreground_seconds";
  measurement.unit = "seconds";
  assert.throws(() =>
    validatePayload("measurement.v1.schema.json", measurement),
  );
});
test("commands reject arbitrary actions, stale identity and excessive lifetime", () => {
  const command = fixture("service-command");
  command.action = "shell";
  assert.throws(() =>
    validatePayload("service-command.v1.schema.json", command),
  );
  command.action = "stop";
  command.expiresAt = "2026-11-15T00:04:00.000Z";
  assert.throws(
    () => validatePayload("service-command.v1.schema.json", command),
    /60 seconds/,
  );
  command.expiresAt = "2026-11-15T00:02:30.000Z";
  command.expectedProcess.startedAt = "2026-11-15T00:03:00.000Z";
  assert.throws(
    () => validatePayload("service-command.v1.schema.json", command),
    /target process/,
  );
});
test("local IPC validates typed stop payloads and rejects extra arguments", () => {
  const ipc = fixture("local-ipc");
  ipc.payload = { shell: "arbitrary command" };
  assert.throws(() => validatePayload("local-ipc.v1.schema.json", ipc));
  ipc.method = "request_stop";
  ipc.payload = fixture("service-command");
  validatePayload("local-ipc.v1.schema.json", ipc);
  ipc.payload.expiresAt = ipc.payload.requestedAt;
  assert.throws(
    () => validatePayload("local-ipc.v1.schema.json", ipc),
    /60 seconds/,
  );
});
test("public user payloads cannot contain password hashes", () => {
  assert.throws(() =>
    validateApiPayload("User", {
      id: "11111111-1111-4111-8111-111111111111",
      email: "fixture@example.invalid",
      displayName: "Fixture",
      status: "ACTIVE",
      preferences: {},
      createdAt: "2026-11-15T00:00:00Z",
      passwordHash: "must-not-leak",
    }),
  );
});

test("offline batches cap their contents and bind a configuration generation",()=>{
  const batch=fixture("measurement-batch");
  validatePayload("measurement-batch.v1.schema.json",batch);
  batch.events=Array(101).fill(batch.events[0]);
  assert.throws(()=>validatePayload("measurement-batch.v1.schema.json",batch));
  batch.events=[];batch.generation=0;
  assert.throws(()=>validatePayload("measurement-batch.v1.schema.json",batch));
});

test("desktop setup IPC accepts only typed preferences and pairing codes", () => {
  const request = readJSON("fixtures/local-ipc.v2.json");
  request.method = "set_modules";
  request.payload = { network: true, developer: false };
  validatePayload("local-ipc.v2.schema.json", request);
  request.payload.shell = "anything";
  assert.throws(() => validatePayload("local-ipc.v2.schema.json", request));
  request.method = "pair";
  request.payload = { token: "x".repeat(43) };
  validatePayload("local-ipc.v2.schema.json", request);
  request.payload.token = "short";
  assert.throws(() => validatePayload("local-ipc.v2.schema.json", request));
  request.method = "request_stop";
  request.payload = {};
  assert.throws(() => validatePayload("local-ipc.v2.schema.json", request));
});

test("local shutdown binds a fresh observation and explicit force/child choices", () => {
  const request = readJSON("fixtures/local-ipc.v3.json");
  validatePayload("local-ipc.v3.schema.json", request);
  request.payload.pid = 123;
  assert.throws(() => validatePayload("local-ipc.v3.schema.json", request));
  delete request.payload.pid;
  delete request.payload.observationId;
  assert.throws(() => validatePayload("local-ipc.v3.schema.json", request));
});

test("remote desktop consent cannot be inferred from local controls",()=>{
 const request=readJSON('fixtures/local-ipc.v4.json');
 validatePayload('local-ipc.v4.schema.json',request);
 request.payload.accepted=false;
 assert.throws(()=>validatePayload('local-ipc.v4.schema.json',request));
 request.payload.accepted=true;request.payload.sharing=false;
 assert.throws(()=>validatePayload('local-ipc.v4.schema.json',request));
});

test("mobile/web remote commands cannot substitute a PID or shell command",()=>{
 const request=readJSON('fixtures/remote-command.v1.json');
 validateApiPayload('RemoteCommandInput',request);
 request.pid=12345;
 assert.throws(()=>validateApiPayload('RemoteCommandInput',request));
 delete request.pid;request.command='arbitrary shell text';
 assert.throws(()=>validateApiPayload('RemoteCommandInput',request));
});
