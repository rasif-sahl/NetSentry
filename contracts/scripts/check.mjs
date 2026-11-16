import assert from "node:assert/strict";
import { api, readJSON, validatePayload } from "./validation.mjs";

const fixtures = [
 ["local-ipc.v4.schema.json","local-ipc.v4.json"],
 ["local-ipc.v3.schema.json","local-ipc.v3.json"],
  ["local-auth.v1.schema.json", "local-auth.v1.json"],
  ["local-ipc.v2.schema.json", "local-ipc.v2.json"],
  ["capability-report.schema.json", "agent-disabled.json"],
  ...[
    "device-capabilities",
    "measurement",
    "measurement-batch",
    "service-permissions",
    "service-command",
    "local-ipc",
  ].map((name) => [`${name}.v1.schema.json`, `${name}.v1.json`]),
];
for (const [schema, fixture] of fixtures)
  validatePayload(schema, readJSON(`fixtures/${fixture}`));
assert.equal(api.openapi, "3.1.0");
function checkReferences(value) {
  if (!value || typeof value !== "object") return;
  if (typeof value.$ref === "string") {
    assert.ok(value.$ref.startsWith("#/components/schemas/"));
    assert.ok(
      api.components.schemas[value.$ref.split("/").at(-1)],
      "API reference must resolve",
    );
  }
  for (const child of Object.values(value)) checkReferences(child);
}
checkReferences(api);

const operationIDs = new Set();
for (const [path, methods] of Object.entries(api.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    assert.ok(["get", "post", "delete", "patch"].includes(method));
    assert.ok(
      !operationIDs.has(operation.operationId),
      "Operation IDs must be unique",
    );
    operationIDs.add(operation.operationId);
    assert.ok(
      Object.keys(operation.responses).some((code) => /^2\d\d$/.test(code)) ||
        (operation.deprecated === true && Boolean(operation.responses["403"])),
    );
    for (const match of path.matchAll(/\{([^}]+)\}/g))
      assert.ok(
        operation.parameters?.some(
          (parameter) =>
            parameter.name === match[1] &&
            parameter.in === "path" &&
            parameter.required,
        ),
      );
  }
}
console.log(
  `Validated ${fixtures.length} synthetic fixtures and compiled all API component schemas (${operationIDs.size} operations).`,
);
console.log(
  "Future monitoring/IPC/command schemas do not imply implemented endpoints or platform support.",
);
