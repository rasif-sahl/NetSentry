import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
for (const name of ["backend", "dashboard"]) {
  const text = read(name + ".Dockerfile");
  assert.ok(text.includes("ARG SERVER_NODE_IMAGE"));
  assert.ok(text.includes("USER 10001:10001"));
  assert.ok(text.includes("--ignore-scripts"));
  assert.ok(!text.includes("latest"));
}
const compose = read("compose.yaml");
assert.ok(compose.includes("127.0.0.1:3000:3000"));
assert.ok(compose.includes("127.0.0.1:3001:3001"));
assert.ok(!compose.includes("docker.sock"));
assert.ok(compose.includes("BILLING_MODE: disabled"));
assert.ok(compose.includes('DB_SYNCHRONIZE: "false"'));
console.log(
  "Deployment source keeps private listener ports, non-root images, explicit secrets, production billing disabled and schema mutation manual. Image builds/TLS ingress/signing are separate acceptance checks.",
);
