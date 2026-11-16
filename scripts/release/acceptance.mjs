import { constants } from "node:fs";
import { open, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const planPath = resolve(root, "docs/release/acceptance-plan.json");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digestPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;
const text = (value) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 2000;
function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}
function keys(value, allowed) {
  requireThat(
    value && typeof value === "object" && !Array.isArray(value),
    "Object required.",
  );
  requireThat(
    Object.keys(value).every((key) => allowed.includes(key)),
    "Unknown evidence field.",
  );
}
export async function loadPlan() {
  const bytes = await readFile(planPath);
  const plan = JSON.parse(bytes);
  requireThat(
    plan.schemaVersion === 1 && Array.isArray(plan.gates),
    "Unknown acceptance plan.",
  );
  const ids = new Set();
  for (const gate of plan.gates) {
    requireThat(
      /^[a-z][a-z0-9.-]+$/.test(gate.id) && !ids.has(gate.id),
      "Duplicate or invalid gate.",
    );
    ids.add(gate.id);
    requireThat(
      [
        "build",
        "integration",
        "physical",
        "deployment",
        "distribution",
      ].includes(gate.stage),
      "Invalid evidence stage.",
    );
    requireThat(
      text(gate.title) &&
        Array.isArray(gate.artifacts) &&
        gate.artifacts.length > 0,
      "Incomplete gate.",
    );
  }
  for (const gates of Object.values(plan.profiles)) {
    requireThat(
      Array.isArray(gates) &&
        gates.length > 0 &&
        gates.length === new Set(gates).size &&
        gates.every((id) => ids.has(id)),
      "Invalid release profile.",
    );
  }
  return { plan, sha256: hash(bytes) };
}
export function initializeRecord(plan, planSha256, profile, sourceCommit) {
  requireThat(
    Object.hasOwn(plan.profiles, profile) && commitPattern.test(sourceCommit),
    "Choose a known profile and exact source commit.",
  );
  const selected = plan.gates.filter((g) =>
    plan.profiles[profile].includes(g.id),
  );
  return {
    schemaVersion: 1,
    profile,
    sourceCommit,
    planSha256,
    artifacts: Object.fromEntries(
      [...new Set(selected.flatMap((g) => g.artifacts))].map((id) => [
        id,
        null,
      ]),
    ),
    results: selected.map((g) => ({
      id: g.id,
      status: "pending",
      evidence: null,
    })),
  };
}
// No subprocesses, network access, tool installation or artifact execution here.
export async function fingerprint(path, maximum = 2 * 1024 ** 3) {
  const handle = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = await handle.stat();
    requireThat(
      stat.isFile() && stat.size > 0 && stat.size <= maximum,
      "Evidence must be a bounded regular nonempty file.",
    );
    const digest = createHash("sha256");
    for await (const chunk of handle.createReadStream({ autoClose: false }))
      digest.update(chunk);
    const after = await handle.stat();
    requireThat(
      stat.size === after.size &&
        stat.mtimeMs === after.mtimeMs &&
        stat.ctimeMs === after.ctimeMs,
      "Evidence changed during inspection.",
    );
    return { sha256: digest.digest("hex"), bytes: stat.size };
  } finally {
    await handle.close();
  }
}
async function verifyFile(entry, base, max) {
  keys(entry, ["path", "sha256"]);
  requireThat(
    text(entry.path) && digestPattern.test(entry.sha256),
    "File path and SHA-256 are required.",
  );
  const actual = await fingerprint(resolve(base, entry.path), max);
  requireThat(
    actual.sha256 === entry.sha256,
    "Evidence or artifact digest mismatch.",
  );
}
export async function reviewRecord(
  record,
  plan,
  planSha256,
  base,
  now = new Date(),
) {
  keys(record, [
    "schemaVersion",
    "profile",
    "sourceCommit",
    "planSha256",
    "artifacts",
    "results",
  ]);
  requireThat(
    record.schemaVersion === 1 && commitPattern.test(record.sourceCommit),
    "Exact candidate commit required.",
  );
  requireThat(
    record.planSha256 === planSha256,
    "Acceptance plan changed; create a fresh record and review the candidate again.",
  );
  requireThat(
    Object.hasOwn(plan.profiles, record.profile),
    "Unknown release profile.",
  );
  const selected = plan.gates.filter((g) =>
    plan.profiles[record.profile].includes(g.id),
  );
  const artifactIDs = [...new Set(selected.flatMap((g) => g.artifacts))];
  keys(record.artifacts, artifactIDs);
  requireThat(
    Object.keys(record.artifacts).length === artifactIDs.length,
    "Candidate artifacts are missing.",
  );
  const artifactHashes = {};
  for (const id of artifactIDs) {
    if (record.artifacts[id] === null) {
      artifactHashes[id] = null;
      continue;
    }
    await verifyFile(record.artifacts[id], base, 2 * 1024 ** 3);
    artifactHashes[id] = record.artifacts[id].sha256;
  }
  requireThat(
    Array.isArray(record.results) && record.results.length === selected.length,
    "Every selected gate must have exactly one result.",
  );
  const seen = new Set(),
    results = [];
  for (const row of record.results) {
    keys(row, ["id", "status", "evidence"]);
    const gate = selected.find((g) => g.id === row.id);
    requireThat(gate && !seen.has(row.id), "Unknown or duplicate gate result.");
    seen.add(row.id);
    requireThat(
      ["pending", "blocked", "failed", "passed"].includes(row.status),
      "Invalid result status.",
    );
    if (row.status === "passed") {
      const e = row.evidence;
      keys(e, [
        "stage",
        "sourceCommit",
        "artifactHashes",
        "environment",
        "tester",
        "observedAt",
        "synthetic",
        "result",
        "attachments",
      ]);
      requireThat(
        e.stage === gate.stage && e.sourceCommit === record.sourceCommit,
        "Evidence stage or candidate commit mismatch.",
      );
      requireThat(
        text(e.environment) && text(e.tester) && text(e.result),
        "Record the environment, tester and actual observed result.",
      );
      requireThat(
        typeof e.synthetic === "boolean" &&
          (!["physical", "deployment", "distribution"].includes(gate.stage) ||
            !e.synthetic),
        "Synthetic evidence cannot pass a physical, deployment or distribution gate.",
      );
      const date = Date.parse(e.observedAt);
      requireThat(
        typeof e.observedAt === "string" &&
          /^\d{4}-\d{2}-\d{2}T/.test(e.observedAt) &&
          e.observedAt.endsWith("Z") &&
          Number.isFinite(date) &&
          date <= now.getTime(),
        "Valid past UTC observation time required.",
      );
      keys(e.artifactHashes, gate.artifacts);
      requireThat(
        Object.keys(e.artifactHashes).length === gate.artifacts.length,
        "Bind every gate artifact.",
      );
      for (const id of gate.artifacts)
        requireThat(
          artifactHashes[id] && e.artifactHashes[id] === artifactHashes[id],
          "Evidence must bind the exact inspected artifact.",
        );
      requireThat(
        Array.isArray(e.attachments) &&
          e.attachments.length > 0 &&
          e.attachments.length <= 10,
        "Attach actual test notes or logs.",
      );
      for (const attachment of e.attachments)
        await verifyFile(attachment, base, 10 * 1024 ** 2);
    } else
      requireThat(
        row.evidence === null,
        "Pending, failed and blocked rows keep evidence null; retain defect notes separately.",
      );
    results.push({ id: gate.id, stage: gate.stage, status: row.status });
  }
  return {
    profile: record.profile,
    sourceCommit: record.sourceCommit,
    evidenceComplete: results.every((r) => r.status === "passed"),
    releaseAuthorized: false,
    notice:
      "Completeness check of human-supplied evidence only; signatures, truthful observations and release approval require independent review. No artifact was executed or published.",
    results,
  };
}
async function cli() {
  const [mode, value, output] = process.argv.slice(2);
  const { plan, sha256 } = await loadPlan();
  if (mode === "plan") {
    console.log(
      JSON.stringify(
        {
          profiles: Object.keys(plan.profiles),
          gates: plan.gates.length,
          planSha256: sha256,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (mode === "fingerprint") {
    console.log(JSON.stringify(await fingerprint(value)));
    return;
  }
  if (mode === "init") {
    requireThat(output, "Provide profile and new private output file.");
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const dirty = execFileSync(
      "git",
      ["status", "--porcelain", "--untracked-files=normal"],
      { cwd: root, encoding: "utf8" },
    ).trim();
    requireThat(
      !dirty,
      "Commit the candidate source before creating its evidence record.",
    );
    const record = initializeRecord(plan, sha256, value, commit);
    await writeFile(output, JSON.stringify(record, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    console.log("Created a private pending record. No gate was passed.");
    return;
  }
  if (mode === "report") {
    const handle = await open(
      value,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    let record;
    try {
      const stat = await handle.stat();
      requireThat(
        stat.isFile() && stat.size <= 1024 ** 2,
        "Invalid evidence record.",
      );
      record = JSON.parse(await handle.readFile("utf8"));
    } finally {
      await handle.close();
    }
    const report = await reviewRecord(
      record,
      plan,
      sha256,
      dirname(resolve(value)),
    );
    console.log(JSON.stringify(report, null, 2));
    if (!report.evidenceComplete) process.exitCode = 2;
    return;
  }
  throw new Error(
    "Use plan, init PROFILE PRIVATE_FILE, fingerprint FILE, or report PRIVATE_FILE.",
  );
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href)
  cli().catch(() => {
    console.error(
      "Release evidence rejected. Check the plan, candidate binding, private files and required fields. Nothing was executed or published.",
    );
    process.exitCode = 1;
  });
