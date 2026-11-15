import { readFileSync } from "node:fs";
import { validatePayload } from "./validation.mjs";
const path = process.argv[2];
if (!path) throw new Error("Provide the path to the agent capability output.");
const report = JSON.parse(readFileSync(path, "utf8"));
validatePayload("capability-report.schema.json", report);
const ids = report.modules.map((module) => module.id).sort();
if (
  JSON.stringify(ids) !== JSON.stringify(["developer", "network"]) ||
  report.modules.some(
    (module) => module.enabled || module.status !== "temporarily_unavailable",
  )
)
  throw new Error(
    "The scaffold must report both modules unavailable and disabled.",
  );
console.log("Actual Go agent output matches the disabled-module contract.");
