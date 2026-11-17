import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");
const walk = (p) =>
  readdirSync(p, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(resolve(p, e.name)) : [resolve(p, e.name)],
  );
const swift = walk(root).filter((p) => p.endsWith(".swift"));
const project = read("NetSentry.xcodeproj/project.pbxproj");
for (const path of swift.filter((p) => !p.includes("/Tests/")))
  assert.ok(
    project.includes(relative(root, path)),
    `Missing source reference ${path}`,
  );
assert.equal((project.match(/isa = PBXNativeTarget;/g) || []).length, 6);
assert.equal((project.match(/isa = PBXTargetDependency;/g) || []).length, 4);
assert.equal((project.match(/isa = PBXCopyFilesBuildPhase;/g) || []).length, 1);
assert.ok(project.includes("NETSENTRY_SCREEN_TIME"));
assert.ok(!project.includes("CODE_SIGN_ENTITLEMENTS"));
assert.ok(!project.includes("iphonesimulator"));
for (const target of ["NetSentry", "NetSentryScreenTime"])
  assert.ok(
    read(
      `NetSentry.xcodeproj/xcshareddata/xcschemes/${target}.xcscheme`,
    ).includes(`BlueprintName="${target}"`),
  );
// Report source is deliberately excluded from all shared storage/API sources.
for (const path of [
  "Extensions/ActivityReport/ActivityReport.swift",
  "Shared/ReportContext.swift",
  "Extensions/ShieldConfiguration/ShieldConfiguration.swift",
  "Extensions/ShieldAction/ShieldAction.swift",
])
  assert.ok(
    !/URLSession|ScreenTimeStore|Keychain|AppGroup|UserDefaults|FileManager|ClientRepository/.test(
      read(path),
    ),
    `Extension privacy boundary ${path}`,
  );
assert.ok(!read("NetSentry/Info.plist").includes("NSAllowsArbitraryLoads"));
const compiler =
  process.env.SWIFTC ||
  (existsSync("/Library/Developer/CommandLineTools/usr/bin/swiftc")
    ? "/Library/Developer/CommandLineTools/usr/bin/swiftc"
    : "/usr/bin/swiftc");
if (process.platform === "darwin") {
  // Parse each extension independently because multiple @main types are targets.
  for (const path of swift)
    for (const flags of [[], ["-D", "NETSENTRY_SCREEN_TIME"]])
      execFileSync(compiler, ["-frontend", "-parse", ...flags, path], {
        stdio: "pipe",
      });
  for (const path of walk(root).filter((p) => p.endsWith(".plist")))
    execFileSync("/usr/bin/plutil", ["-lint", path], { stdio: "pipe" });
  const parsed = JSON.parse(
    execFileSync(
      "/usr/bin/plutil",
      [
        "-convert",
        "json",
        "-o",
        "-",
        resolve(root, "NetSentry.xcodeproj/project.pbxproj"),
      ],
      { encoding: "utf8" },
    ),
  );
  const objects = parsed.objects;
  const targets = Object.values(objects).filter(
    (o) => o.isa === "PBXNativeTarget",
  );
  for (const target of targets) {
    const configurations = objects[
      target.buildConfigurationList
    ].buildConfigurations.map((id) => objects[id]);
    for (const configuration of configurations) {
      const s = configuration.buildSettings;
      assert.equal(
        s.NETSENTRY_BUNDLE_PREFIX,
        configuration.name === "Debug"
          ? "com.netsentry.app.native.dev"
          : "com.netsentry.app",
      );
      assert.equal(
        s.PRODUCT_BUNDLE_IDENTIFIER,
        "$(NETSENTRY_BUNDLE_PREFIX)" +
          (target.productType === "com.apple.product-type.app-extension"
            ? "." + target.name
            : ""),
      );
      assert.ok(
        !s.DEVELOPMENT_TEAM && !s.CODE_SIGN_ENTITLEMENTS,
        "No signing authority is provisioned by project generation.",
      );
    }

    const sources = target.buildPhases
      .map((id) => objects[id])
      .filter((p) => p.isa === "PBXSourcesBuildPhase")
      .flatMap((p) => p.files.map((id) => objects[objects[id].fileRef].path));
    if (target.name === "ActivityReport")
      assert.deepEqual(sources.sort(), [
        "Extensions/ActivityReport/ActivityReport.swift",
        "Shared/ReportContext.swift",
      ]);
    if (target.name === "NetSentry")
      assert.equal(target.dependencies.length, 0);
    if (target.name === "NetSentryScreenTime")
      assert.equal(target.dependencies.length, 4);
    if (target.name.startsWith("Shield")) assert.equal(sources.length, 1);
  }
  console.log(
    `${swift.length} Swift files parsed in both feature modes; plists and Xcode project parse. This is grammar verification, not iOS type checking/building.`,
  );
} else
  console.log(
    "Swift grammar and plist checks pending on a host with existing Apple Command Line Tools.",
  );
console.log(
  "iOS source references, optional extension targets and report privacy boundaries checked.",
);
