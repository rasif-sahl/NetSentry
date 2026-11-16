import { readFile, lstat, realpath } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function packagingConfig(mode, env = process.env) {
  if (
    !["preview", "release"].includes(mode) ||
    !["arm64", "x64"].includes(env.DESKTOP_ARCH || process.arch)
  )
    throw new Error(
      "Select preview/release and a supported macOS architecture.",
    );
  const arch = env.DESKTOP_ARCH || process.arch;
  const binary = env.NETSENTRY_PACKAGE_AGENT;
  if (!binary || !env.NETSENTRY_ELECTRON_DIST)
    throw new Error(
      "Provide an existing matching agent and Electron distribution. Nothing is downloaded automatically.",
    );
  const agent = resolve(binary),
    s = await lstat(agent),
    bytes = await readFile(agent);
  if (
    !s.isFile() ||
    s.isSymbolicLink() ||
    s.mode & 0o022 ||
    !(s.mode & 0o100) ||
    (await realpath(agent)) !== agent ||
    bytes.length < 32 ||
    bytes.readUInt32LE(0) !== 0xfeedfacf ||
    bytes.readUInt32LE(4) !== (arch === "arm64" ? 0x100000c : 0x1000007)
  )
    throw new Error("A safe matching macOS Mach-O agent is required.");
  const { validatePolicy } = await import("../dist/main/update-policy.js");
  const policy = validatePolicy(
    JSON.parse(
      await readFile(
        env.NETSENTRY_RELEASE_POLICY ||
          join(root, "packaging/update-policy.json"),
        "utf8",
      ),
    ),
  );
  if (
    policy.appId !== "com.netsentry.desktop" ||
    policy.schemaVersion !== 1 ||
    !Number.isSafeInteger(policy.release) ||
    policy.release < 1
  )
    throw new Error("Invalid release policy.");
  const release = mode === "release";
  if (release) {
    if (
      !/^[A-Z0-9]{10}$/.test(policy.teamId) ||
      !env.CSC_NAME ||
      env.CSC_IDENTITY_AUTO_DISCOVERY === "false" ||
      !env.APPLE_KEYCHAIN_PROFILE
    )
      throw new Error(
        "Developer ID identity, team and explicit notarization profile required.",
      );
    if (policy.enabled) {
      const u = new URL(policy.feedUrl);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.search ||
        u.hash ||
        !u.pathname.endsWith("/") ||
        !/^[A-Za-z0-9+/]{43}=$/.test(policy.publicKey)
      )
        throw new Error("Pinned HTTPS update policy required.");
    }
  } else if (policy.enabled || policy.teamId)
    throw new Error("Preview requires the disabled unsigned policy.");
  const policyFile = resolve(
    env.NETSENTRY_RELEASE_POLICY || join(root, "packaging/update-policy.json"),
  );
  const config = {
    appId: policy.appId,
    productName: "NetSentry",
    electronVersion: "45.3.2",
    electronDist: resolve(env.NETSENTRY_ELECTRON_DIST),
    asar: true,
    electronFuses: release
      ? {
          runAsNode: false,
          enableNodeOptionsEnvironmentVariable: false,
          enableNodeCliInspectArguments: false,
          enableEmbeddedAsarIntegrityValidation: true,
          onlyLoadAppFromAsar: true,
        }
      : undefined,
    npmRebuild: false,
    buildDependenciesFromSource: false,
    files: ["dist/main/**/*", "dist/renderer/**/*", "package.json"],
    extraResources: [
      { from: agent, to: "agent/netsentry-agent" },
      { from: policyFile, to: "update-policy.json" },
      { from: join(root, "packaging/app-update.yml"), to: "app-update.yml" },
    ],
    directories: {
      output: resolve(root, "../artifacts/desktop", mode, arch),
      buildResources: join(root, "packaging"),
    },
    artifactName: "NetSentry-${version}-${arch}.${ext}",
    publish: null,
    forceCodeSigning: release,
    afterSign: release
      ? async (context) => {
          const { verifyDesktopTrust } =
            await import("../dist/main/desktop-trust.js");
          const app = join(context.appOutDir, "NetSentry.app");
          await verifyDesktopTrust(
            app,
            join(app, "Contents/Resources"),
            policy.teamId,
          );
        }
      : undefined,
    mac: {
      category: "public.app-category.developer-tools",
      target: release
        ? [
            { target: "dmg", arch: [arch] },
            { target: "zip", arch: [arch] },
          ]
        : [{ target: "dir", arch: [arch] }],
      hardenedRuntime: release,
      identity: release ? env.CSC_NAME : null,
      notarize: release,
      binaries: ["Contents/Resources/agent/netsentry-agent"],
    },
  };
  return { root, arch, config, policy, mode };
}
