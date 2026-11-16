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

test("offline batches cap their contents and bind a configuration generation", () => {
  const batch = fixture("measurement-batch");
  validatePayload("measurement-batch.v1.schema.json", batch);
  batch.events = Array(101).fill(batch.events[0]);
  assert.throws(() =>
    validatePayload("measurement-batch.v1.schema.json", batch),
  );
  batch.events = [];
  batch.generation = 0;
  assert.throws(() =>
    validatePayload("measurement-batch.v1.schema.json", batch),
  );
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

test("remote desktop consent cannot be inferred from local controls", () => {
  const request = readJSON("fixtures/local-ipc.v4.json");
  validatePayload("local-ipc.v4.schema.json", request);
  request.payload.accepted = false;
  assert.throws(() => validatePayload("local-ipc.v4.schema.json", request));
  request.payload.accepted = true;
  request.payload.sharing = false;
  assert.throws(() => validatePayload("local-ipc.v4.schema.json", request));
});

test("mobile/web remote commands cannot substitute a PID or shell command", () => {
  const request = readJSON("fixtures/remote-command.v1.json");
  validateApiPayload("RemoteCommandInput", request);
  request.pid = 12345;
  assert.throws(() => validateApiPayload("RemoteCommandInput", request));
  delete request.pid;
  request.command = "arbitrary shell text";
  assert.throws(() => validateApiPayload("RemoteCommandInput", request));
});

test("detailed Android usage excludes activity classes and bounds metadata", () => {
  const batch = readJSON("../android/test/fixtures/application-usage.v1.json");
  validatePayload("app-usage-batch.v1.schema.json", batch);
  validateApiPayload("ApplicationUsageBatch", batch);
  assert.throws(() =>
    validatePayload("app-usage-batch.v1.schema.json", {
      ...batch,
      activityClass: "private.Class",
    }),
  );
  const oversized = structuredClone(batch);
  oversized.applications = Array(33).fill(batch.applications[0]);
  assert.throws(() =>
    validatePayload("app-usage-batch.v1.schema.json", oversized),
  );
  batch.intervalStart = batch.intervalStart.replace(".000Z", "Z");
  assert.throws(() => validatePayload("app-usage-batch.v1.schema.json", batch));
});

test("detailed application consent is an explicit versioned addition", () => {
  const input = {
    accepted: true,
    disclosureVersion: "monitoring-v3",
    scopes: ["app_usage"],
    appUsageDisclosureVersion: "app-usage-v1",
  };
  validateApiPayload("DeviceConsentRequest", input);
  assert.throws(() =>
    validateApiPayload("DeviceConsentRequest", {
      ...input,
      appUsageDisclosureVersion: "future-or-invented",
    }),
  );
});

test("network sharing needs a named network and separate disclosure", () => {
  const base = readJSON("fixtures/local-ipc.v5.json");
  validatePayload("local-ipc.v5.schema.json", base);
  assert.throws(() =>
    validatePayload("local-ipc.v5.schema.json", {
      ...base,
      payload: { ...base.payload, accepted: false },
    }),
  );
  assert.throws(() =>
    validatePayload("local-ipc.v5.schema.json", {
      ...base,
      payload: { ...base.payload, networkId: "" },
    }),
  );
  assert.throws(() =>
    validatePayload("local-ipc.v5.schema.json", {
      ...base,
      payload: { ...base.payload, command: "scan" },
    }),
  );
});
test("network snapshots bound passive metadata and keep unknown router traffic unavailable", () => {
  const base = readJSON("fixtures/network-snapshot.v1.json");
  validatePayload("network-snapshot.v1.schema.json", base);
  assert.throws(() =>
    validatePayload("network-snapshot.v1.schema.json", {
      ...base,
      neighbors: [
        ...base.neighbors.map((n) => ({ ...n, hostname: "inferred-owner" })),
      ],
    }),
  );
  assert.throws(() =>
    validatePayload("network-snapshot.v1.schema.json", {
      ...base,
      neighbors: Array(129).fill(base.neighbors[0]),
    }),
  );
  assert.throws(() =>
    validatePayload("network-snapshot.v1.schema.json", {
      ...base,
      router: { rxBytes: 123 },
    }),
  );
});

test("family policies contain bounded intent and cannot authorize arbitrary actions", () => {
  const rules = readJSON("fixtures/family-rules.v1.json");
  validatePayload("family-rules.v1.schema.json", rules);
  assert.throws(() =>
    validatePayload("family-rules.v1.schema.json", {
      ...rules,
      execute: "shell",
    }),
  );
  assert.throws(() =>
    validatePayload("family-rules.v1.schema.json", {
      ...rules,
      dailyMinutes: 0,
    }),
  );
  assert.throws(() =>
    validateApiPayload("FamilyReceiptInput", {
      generation: 1,
      policyRevision: 1,
      profileRevision: 1,
      status: "applied",
    }),
  );
  validateApiPayload("FamilyReceiptInput", {
    generation: 1,
    policyRevision: 1,
    profileRevision: 1,
    status: "unsupported",
  });
});

test("Business sharing needs a displayed generation and cannot claim another employee or custody", () => {
  const sharing = {generation:2,expectedRevision:1,accepted:true,disclosureVersion:"business-sharing-v1"};
  validateApiPayload("BusinessSharingInput",sharing);
  for(const changed of [{...sharing,generation:0},{...sharing,accepted:false},{...sharing,userId:"11111111-1111-4111-8111-111111111111"}]) assert.throws(()=>validateApiPayload("BusinessSharingInput",changed));
  assert.throws(()=>validateApiPayload("BusinessAssignmentInput",{employeeId:"11111111-1111-4111-8111-111111111111",expectedRevision:0,ownership:"organization"}));
  assert.throws(()=>validateApiPayload("BusinessCustodyInput",{accepted:false,disclosureVersion:"business-custody-v1"}));
});
