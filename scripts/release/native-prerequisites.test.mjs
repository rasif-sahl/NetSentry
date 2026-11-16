import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { inspectPrerequisites } from "./native-prerequisites.mjs";
test("missing Android paths stay blocked and never establish a native build", async () => {
  const result = await inspectPrerequisites("android", {});
  assert.equal(result.status, "prerequisites_missing");
  assert.equal(result.installedAnything, false);
  assert.equal(result.nativeBuild, "pending");
  assert.ok(result.checks.every((x) => !x.present));
});
test("even present paths are not compilation, signing or device proof", async () => {
  const root = await mkdtemp(join(tmpdir(), "netsentry-prerequisites-"));
  try {
    const files = [
      "jdk/bin/java",
      "jdk/bin/javac",
      "gradle",
      "sdk/platforms/android-35/android.jar",
      "sdk/build-tools/35.0.0/aapt2",
      "sdk/build-tools/35.0.0/apksigner",
      "sdk/platform-tools/adb",
    ];
    // Files deliberately are not runnable tools. The inspector must never execute them.
    for (const path of files) {
      const full = join(root, path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, "not an executable program", { mode: 0o700 });
    }
    const result = await inspectPrerequisites("android", {
      JAVA_HOME: join(root, "jdk"),
      ANDROID_HOME: join(root, "sdk"),
      NETSENTRY_GRADLE_EXECUTABLE: join(root, "gradle"),
    });
    assert.equal(result.status, "paths_present_unverified");
    assert.equal(result.nativeBuild, "pending");
    assert.equal(result.physicalDevice, "pending");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("non-macOS host cannot satisfy iOS prerequisites", async () => {
  const result = await inspectPrerequisites(
    "ios",
    { DEVELOPER_DIR: "/does-not-exist" },
    "linux",
  );
  assert.equal(result.status, "prerequisites_missing");
  assert.ok(result.checks.every((x) => !x.present));
  await assert.rejects(inspectPrerequisites("flutter"));
});
