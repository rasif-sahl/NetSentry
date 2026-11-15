import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// No shell commands, installations, native builds or runtime provisioning.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJSON = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const required = [
  "backend/package.json", "dashboard/package.json", "mobile/pubspec.yaml",
  "android/settings.gradle.kts", "android/app/build.gradle.kts",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/src/main/java/com/netsentry/app/MainActivity.kt",
  "ios/NetSentry.xcodeproj/project.pbxproj",
  "ios/NetSentry.xcodeproj/xcshareddata/xcschemes/NetSentry.xcscheme",
  "ios/NetSentry/NetSentryApp.swift", "ios/NetSentry/SetupView.swift", "ios/NetSentry/Info.plist",
  "desktop/package.json", "desktop/src/main/main.ts", "desktop/src/main/preload.cts",
  "desktop/src/renderer/main.tsx", "desktop/src/renderer/App.tsx",
  "agent/go.mod", "agent/cmd/netsentry-agent/main.go",
  "agent/internal/capability/report.go", "agent/internal/modules/network/module.go",
  "agent/internal/modules/developer/module.go", "infra/README.md",
  "docs/architecture/phase-0-decisions.md", "docs/backlog.md", "docs/validation/phase-0.md",
];
for (const path of required) assert.ok((await stat(resolve(root, path))).isFile(), path);

const schema = await readJSON("contracts/schemas/capability-report.schema.json");
const fixture = await readJSON("contracts/fixtures/agent-disabled.json");
const allowedKeys = Object.keys(schema.properties);
assert.deepEqual(Object.keys(fixture).sort(), allowedKeys.sort());
assert.equal(fixture.schemaVersion, schema.properties.schemaVersion.const);
assert.ok(Array.isArray(fixture.modules));
const moduleSchema = schema.$defs.module;
const expectedIDs = moduleSchema.properties.id.enum;
assert.deepEqual(fixture.modules.map((module) => module.id).sort(), [...expectedIDs].sort());
for (const module of fixture.modules) {
  assert.deepEqual(Object.keys(module).sort(), Object.keys(moduleSchema.properties).sort());
  assert.equal(typeof module.enabled, "boolean");
  assert.equal(module.enabled, false, "Scaffold modules must not imply active monitoring");
  assert.ok(moduleSchema.properties.status.enum.includes(module.status));
  assert.equal(module.status, "temporarily_unavailable");
  assert.equal(typeof module.reason, "string");
  assert.ok(module.reason.trim().length >= moduleSchema.properties.reason.minLength);
}

const desktop = await readJSON("desktop/package.json");
assert.equal(desktop.private, true);
assert.equal(desktop.type, "module");
for (const path of ["desktop/tsconfig.main.json", "desktop/tsconfig.renderer.json", "package.json"]) await readJSON(path);
console.log("Scaffold paths and JSON configuration are consistent; disabled-agent fixture matches the draft contract.");
console.log("Native compilation, Electron runtime, Go build and hardware verification are separate checks.");
