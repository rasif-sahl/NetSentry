#!/usr/bin/env node
// Uses existing formatters only. It never installs a compiler, SDK or runtime.
import { execFileSync, spawnSync } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const mode = process.argv[2] ?? "check";
if (!["check", "write"].includes(mode)) throw new Error("Use check or write.");
const write = mode === "write";
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const unique = [...new Set(files)];
const results = [];
async function executable(value) {
  if (!value) return undefined;
  try {
    const candidate = value.includes("/")
      ? resolve(value)
      : spawnSync("which", [value], { encoding: "utf8" }).stdout?.trim();
    if (!candidate) return undefined;
    await access(candidate, constants.X_OK);
    return candidate;
  } catch {
    return undefined;
  }
}
function run(label, command, args, count) {
  if (!command) {
    results.push({ label, status: "missing formatter", count });
    return;
  }
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      CI: "true",
      DART_SUPPRESS_ANALYTICS: "true",
      GOTOOLCHAIN: "local",
    },
  });
  const output = (result.stdout || "") + (result.stderr || "");
  const failed =
    result.status !== 0 || (label === "Go" && !write && output.trim());
  results.push({ label, status: failed ? "failed" : "passed", count });
  if (failed)
    process.stderr.write(
      output || result.error?.message || "Formatter failed.\n",
    );
}
try {
  const prettier = await import("../backend/node_modules/prettier/index.mjs");
  const selected = unique.filter(
    (file) =>
      /\.(?:[cm]?[jt]sx?|css|html|json|ya?ml)$/.test(file) &&
      !file.startsWith("mobile/") &&
      !/package-lock\.json$|\/fixtures\/|\/fixtures\.json$|^docs\/design\/mobile\/index\.html$/.test(
        file,
      ),
  );
  const bad = [];
  for (const file of selected) {
    const source = await readFile(file, "utf8");
    const options = {
      ...(await prettier.resolveConfig(file, { editorconfig: true })),
      filepath: file,
    };
    const formatted = await prettier.format(source, options);
    if (formatted !== source) {
      if (write) await writeFile(file, formatted);
      else bad.push(file);
    }
  }
  results.push({
    label: "Web/backend/config (Prettier)",
    status: bad.length ? "failed" : "passed",
    count: selected.length,
  });
  if (bad.length) process.stderr.write(bad.join("\n") + "\n");
} catch (error) {
  results.push({ label: "Prettier", status: "failed", detail: error.message });
}

const kotlin = unique.filter(
  (file) => file.startsWith("android/") && /\.kts?$/.test(file),
);
const java = await executable(
  process.env.JAVA ||
    (process.env.JAVA_HOME && resolve(process.env.JAVA_HOME, "bin/java")),
);
const jar = process.env.KTFMT_JAR;
const ktfmt = await executable(process.env.KTFMT);
const kotlinArgs = [
  "--kotlinlang-style",
  "--do-not-remove-unused-imports",
  ...(!write ? ["--dry-run", "--set-exit-if-changed"] : []),
  ...kotlin,
];
run(
  "Kotlin/Gradle",
  jar && java ? java : ktfmt,
  jar && java ? ["-jar", resolve(jar), ...kotlinArgs] : kotlinArgs,
  kotlin.length,
);
const swift = unique.filter(
  (file) => file.startsWith("ios/") && file.endsWith(".swift"),
);
const swiftFormat =
  (await executable(process.env.SWIFT_FORMAT || "swift-format")) ||
  (await executable(
    "/Library/Developer/CommandLineTools/usr/bin/swift-format",
  ));
run(
  "Swift",
  swiftFormat,
  [
    write ? "format" : "lint",
    ...(write ? ["--in-place"] : ["--strict"]),
    "--configuration",
    ".swift-format",
    ...swift,
  ],
  swift.length,
);
const go = unique.filter(
  (file) => file.startsWith("agent/") && file.endsWith(".go"),
);
run(
  "Go",
  await executable(process.env.GOFMT || "gofmt"),
  [write ? "-w" : "-l", ...go],
  go.length,
);
const python = unique.filter((file) => file.endsWith(".py"));
run(
  "Python (Black)",
  await executable(process.env.PYTHON || "python3"),
  ["-m", "black", ...(write ? [] : ["--check"]), ...python],
  python.length,
);
// The Flutter tree is a preserved reference: audit only, even in write mode.
const dart = unique.filter(
  (file) => file.startsWith("mobile/") && file.endsWith(".dart"),
);
run(
  "Flutter reference (read-only Dart audit)",
  await executable(process.env.DART),
  ["format", "--output=none", "--set-exit-if-changed", ...dart],
  dart.length,
);
const shell = unique.filter((file) => file.endsWith(".sh"));
run(
  "Shell syntax",
  await executable("bash"),
  [
    "-c",
    'for source in "$@"; do bash -n "$source" || exit; done',
    "format-check",
    ...shell,
  ],
  shell.length,
);
const whitespace = [];
for (const file of shell) {
  const source = await readFile(file, "utf8");
  if (!source.endsWith("\n") || /[\t ]+$/m.test(source)) whitespace.push(file);
}
results.push({
  label: "Shell whitespace",
  status: whitespace.length ? "failed" : "passed",
  count: shell.length,
});
if (whitespace.length) process.stderr.write(whitespace.join("\n") + "\n");
console.log(JSON.stringify({ mode, results }, null, 2));
process.exitCode = results.some((item) => item.status === "failed")
  ? 1
  : results.some((item) => item.status === "missing formatter")
    ? 2
    : 0;
