import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const readJSON = (path) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"));
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
});
addFormats(ajv);
const schemas = new Map();
for (const file of readdirSync(resolve(root, "schemas")).filter((file) =>
  file.endsWith(".json"),
)) {
  const schema = readJSON(`schemas/${file}`);
  schemas.set(file, schema);
  ajv.addSchema(schema);
}
for (const schema of schemas.values()) ajv.getSchema(schema.$id);

export const api = readJSON("openapi/api.v1.json");
// OpenAPI schemas use document-local component references. Validate their JSON
// Schema content in a schema root; this is not a complete OpenAPI linter.
const rewriteReferences = (value) => {
  if (Array.isArray(value)) return value.map(rewriteReferences);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        key === "$ref" && typeof child === "string"
          ? child.replace("#/components/schemas/", "#/$defs/")
          : rewriteReferences(child),
      ]),
    );
  return value;
};
const apiSchemaID = "https://netsentry.example/schemas/api-components.v1.json";
ajv.addSchema({
  $id: apiSchemaID,
  $defs: rewriteReferences(api.components.schemas),
});
for (const name of Object.keys(api.components.schemas))
  ajv.getSchema(`${apiSchemaID}#/$defs/${name}`);

function checked(validator, data) {
  if (!validator(data)) throw new Error(ajv.errorsText(validator.errors));
}

export function validateApiPayload(name, data) {
  const validator = ajv.getSchema(`${apiSchemaID}#/$defs/${name}`);
  if (!validator) throw new Error(`Unknown API component: ${name}`);
  checked(validator, data);
}

export function validatePayload(file, data) {
  const schema = schemas.get(file);
  if (!schema) throw new Error(`Unknown contract: ${file}`);
  checked(ajv.getSchema(schema.$id), data);
  if (file === "device-capabilities.v1.schema.json") {
    const ids = data.capabilities.map((capability) => capability.id);
    if (new Set(ids).size !== ids.length)
      throw new Error("Capability identifiers must be unique.");
    if (
      data.capabilities.some(
        (capability) =>
          Date.parse(capability.checkedAt) > Date.parse(data.reportedAt),
      )
    )
      throw new Error("Capability checks cannot occur after report time.");
  }
  if (file === "measurement.v1.schema.json") {
    if (Date.parse(data.intervalEnd) <= Date.parse(data.intervalStart))
      throw new Error("Measurement intervals must have positive duration.");
    if (Date.parse(data.collectedAt) < Date.parse(data.intervalEnd))
      throw new Error(
        "Collection cannot predate the measurement interval end.",
      );
  }
  if (file === "service-command.v1.schema.json") {
    const duration = Date.parse(data.expiresAt) - Date.parse(data.requestedAt);
    if (duration <= 0 || duration > 60_000)
      throw new Error("Commands must expire within 60 seconds of the request.");
    if (
      Date.parse(data.expectedProcess.startedAt) > Date.parse(data.requestedAt)
    )
      throw new Error("The target process must exist before the request.");
  }
  if (file === "local-ipc.v1.schema.json" && data.method === "request_stop")
    validatePayload("service-command.v1.schema.json", data.payload);
}

const responseValidators = new Map();
export function validateApiResponse(method, path, status, data) {
  const cleanPath = path.split("?")[0];
  const entry = Object.entries(api.paths).find(([template]) =>
    new RegExp(`^${template.replace(/\{[^}]+\}/g, "[^/]+")}$`).test(cleanPath),
  );
  if (!entry) throw new Error(`Undocumented API path: ${cleanPath}`);
  const responseSchema =
    entry[1][method.toLowerCase()]?.responses[String(status)]?.content?.[
      "application/json"
    ]?.schema;
  if (!responseSchema)
    throw new Error(
      `Undocumented API response: ${method} ${entry[0]} ${status}`,
    );
  const key = `${method}:${entry[0]}:${status}`;
  if (!responseValidators.has(key))
    responseValidators.set(
      key,
      ajv.compile({
        $defs: rewriteReferences(api.components.schemas),
        ...rewriteReferences(responseSchema),
      }),
    );
  checked(responseValidators.get(key), data);
}
