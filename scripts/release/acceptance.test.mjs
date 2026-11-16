import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadPlan,
  initializeRecord,
  reviewRecord,
  fingerprint,
} from "./acceptance.mjs";
const sourceCommit = "a".repeat(40);
const now = new Date("2026-11-16T00:00:00Z");
const { plan, sha256 } = await loadPlan();
const copy = (x) => structuredClone(x);
async function fixture(run) {
  const dir = await mkdtemp(join(tmpdir(), "netsentry-acceptance-"));
  try {
    const artifact = join(dir, "candidate.bin"),
      notes = join(dir, "redacted-test-notes.txt");
    await writeFile(
      artifact,
      "Synthetic bytes for evidence-validator tests only.",
    );
    await writeFile(notes, "Synthetic test notes; no phone was tested.");
    await run({
      dir,
      artifact,
      notes,
      digest: (await fingerprint(artifact)).sha256,
      noteHash: (await fingerprint(notes)).sha256,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("every profile starts pending, contains server gates and cannot authorize release", async () => {
  for (const profile of Object.keys(plan.profiles)) {
    const r = initializeRecord(plan, sha256, profile, sourceCommit);
    assert.ok(r.results.some((x) => x.id === "server.recovery"));
    const result = await reviewRecord(r, plan, sha256, "/not-used", now);
    assert.equal(result.evidenceComplete, false);
    assert.equal(result.releaseAuthorized, false);
    assert.ok(result.results.every((x) => x.status === "pending"));
  }
});
test("missing, duplicate, foreign, unknown-status and changed-plan gates fail closed", async () => {
  const original = initializeRecord(plan, sha256, "android", sourceCommit);
  const variants = [];
  let r = copy(original);
  r.results.pop();
  variants.push(r);
  r = copy(original);
  r.results[1] = r.results[0];
  variants.push(r);
  r = copy(original);
  r.results[0].id = "ios.build";
  variants.push(r);
  r = copy(original);
  r.results[0].status = "not_applicable";
  variants.push(r);
  r = copy(original);
  r.planSha256 = "0".repeat(64);
  variants.push(r);
  for (const invalid of variants)
    await assert.rejects(reviewRecord(invalid, plan, sha256, "/not-used", now));
});
test("physical pass requires candidate-bound artifact, real evidence claim and attachment", async () =>
  fixture(async ({ dir, artifact, notes, digest, noteHash }) => {
    const r = initializeRecord(plan, sha256, "android", sourceCommit);
    for (const id of Object.keys(r.artifacts))
      r.artifacts[id] = { path: artifact, sha256: digest };
    const row = r.results.find((x) => x.id === "android.account");
    row.status = "passed";
    row.evidence = {
      stage: "physical",
      sourceCommit,
      artifactHashes: { "android-app": digest, "server-manifest": digest },
      environment: "Validator fixture environment",
      tester: "Fixture validator",
      observedAt: "2026-11-15T00:00:00Z",
      synthetic: false,
      result:
        "Manual evidence claim used solely to test structural validation.",
      attachments: [{ path: notes, sha256: noteHash }],
    };
    const ok = await reviewRecord(r, plan, sha256, dir, now);
    assert.equal(ok.evidenceComplete, false);
    assert.equal(ok.releaseAuthorized, false);
    for (const change of [
      (e) => {
        e.synthetic = true;
      },
      (e) => {
        e.stage = "integration";
      },
      (e) => {
        e.sourceCommit = "b".repeat(40);
      },
      (e) => {
        e.attachments = [];
      },
      (e) => {
        e.artifactHashes["android-app"] = "0".repeat(64);
      },
      (e) => {
        e.observedAt = "2027-01-01T00:00:00Z";
      },
    ]) {
      const broken = copy(r);
      change(broken.results.find((x) => x.id === row.id).evidence);
      await assert.rejects(reviewRecord(broken, plan, sha256, dir, now));
    }
    await writeFile(notes, "modified after review");
    await assert.rejects(reviewRecord(r, plan, sha256, dir, now));
  }));
test("all reviewed rows only establish completeness, never authorization", async () =>
  fixture(async ({ dir, artifact, notes, digest, noteHash }) => {
    const r = initializeRecord(plan, sha256, "network", sourceCommit);
    for (const id of Object.keys(r.artifacts))
      r.artifacts[id] = { path: artifact, sha256: digest };
    for (const row of r.results) {
      const gate = plan.gates.find((g) => g.id === row.id);
      row.status = "passed";
      row.evidence = {
        stage: gate.stage,
        sourceCommit,
        artifactHashes: Object.fromEntries(
          gate.artifacts.map((id) => [id, digest]),
        ),
        environment: "Validator fixture only",
        tester: "Test harness",
        observedAt: "2026-11-15T00:00:00Z",
        synthetic: false,
        result: "Structural test, not actual deployment/hardware acceptance.",
        attachments: [{ path: notes, sha256: noteHash }],
      };
    }
    const result = await reviewRecord(r, plan, sha256, dir, now);
    assert.equal(result.evidenceComplete, true);
    assert.equal(result.releaseAuthorized, false);
    await writeFile(artifact, "different binary");
    await assert.rejects(reviewRecord(r, plan, sha256, dir, now));
  }));
test("file inspection rejects symlinks, directories and empty files", async () =>
  fixture(async ({ dir, artifact }) => {
    const link = join(dir, "link");
    await symlink(artifact, link);
    await assert.rejects(fingerprint(link));
    await assert.rejects(fingerprint(dir));
    const empty = join(dir, "empty");
    await writeFile(empty, "");
    await assert.rejects(fingerprint(empty));
  }));
