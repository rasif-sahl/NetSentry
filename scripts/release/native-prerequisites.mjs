// Inspect explicitly selected existing paths only. Never invokes a tool or installer.
import { access, stat, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
async function exists(path, executable = false) {
  if (!path) return false;
  try {
    const s = await stat(path);
    if (!s.isFile()) return false;
    if (executable) await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
export async function inspectPrerequisites(
  platform,
  env = process.env,
  host = process.platform,
) {
  const checks = [];
  const check = async (id, path, executable = false) =>
    checks.push({ id, present: await exists(path, executable) });
  if (platform === "android") {
    await check(
      "jdk-java",
      env.JAVA_HOME && join(env.JAVA_HOME, "bin/java"),
      true,
    );
    await check(
      "jdk-javac",
      env.JAVA_HOME && join(env.JAVA_HOME, "bin/javac"),
      true,
    );
    await check(
      "selected-gradle-8.11.1",
      env.NETSENTRY_GRADLE_EXECUTABLE,
      true,
    );
    const sdk = env.ANDROID_HOME;
    await check(
      "android-35-platform",
      sdk && join(sdk, "platforms/android-35/android.jar"),
    );
    for (const tool of ["aapt2", "apksigner"])
      await check(
        "build-tools-35.0.0-" + tool,
        sdk && join(sdk, "build-tools/35.0.0", tool),
        true,
      );
    await check(
      "physical-device-adb",
      sdk && join(sdk, "platform-tools/adb"),
      true,
    );
  } else if (platform === "ios") {
    checks.push({ id: "macos-host", present: host === "darwin" });
    const developer =
      env.DEVELOPER_DIR || "/Applications/Xcode.app/Contents/Developer";
    await check(
      "existing-xcodebuild",
      join(developer, "usr/bin/xcodebuild"),
      true,
    );
    let sdk = false;
    try {
      sdk = (
        await readdir(
          join(developer, "Platforms/iPhoneOS.platform/Developer/SDKs"),
        )
      ).some((x) => /^iPhoneOS.+\.sdk$/.test(x));
    } catch {}
    checks.push({ id: "existing-iphoneos-sdk", present: sdk });
  } else throw new Error("Select android or ios.");
  return {
    platform,
    status: checks.every((c) => c.present)
      ? "paths_present_unverified"
      : "prerequisites_missing",
    checks,
    nativeBuild: "pending",
    signing: "pending",
    physicalDevice: "pending",
    installedAnything: false,
    notice:
      "Path presence only; versions, cached dependencies, compatibility, signing and device access still require review. No tool was executed.",
  };
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  inspectPrerequisites(process.argv[2])
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      if (r.status === "prerequisites_missing") process.exitCode = 2;
    })
    .catch(() => {
      console.error("Select android or ios; no tools were installed.");
      process.exitCode = 1;
    });
}
