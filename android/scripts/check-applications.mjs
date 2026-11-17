import { readFileSync } from "node:fs";
import {
  validatePayload,
  validateApiPayload,
} from "../../contracts/scripts/validation.mjs";
import assert from "node:assert/strict";
const file =
  process.argv[2] ??
  new URL("../test/fixtures/application-usage.v1.json", import.meta.url);
const batch = JSON.parse(readFileSync(file, "utf8"));
validatePayload("app-usage-batch.v1.schema.json", batch);
validateApiPayload("ApplicationUsageBatch", batch);
assert.ok(!JSON.stringify(batch).includes("activity.Class"));
assert.throws(() =>
  validatePayload("app-usage-batch.v1.schema.json", {
    ...batch,
    activityClass: "secret",
  }),
);
console.log(
  "Actual Kotlin application-event payload matches the detailed-usage contract; fixture data is synthetic.",
);
