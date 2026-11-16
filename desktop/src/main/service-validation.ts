import { isIP } from "node:net";
import { outcomes } from "./service-types.js";
import type { DeveloperData } from "./service-types.js";
const hash = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    v,
  );
const text = (v: unknown) =>
  typeof v === "string" &&
  [...v].length <= 100 &&
  !/[\u0000-\u001f\u007f]/.test(v);
const integer = (v: unknown, min = 0, max = 2147483647) =>
  Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
const date = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v));
function keys(v: unknown, names: string[]): v is Record<string, unknown> {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === names.length &&
    names.every((n) => Object.hasOwn(v, n))
  );
}
export function servicePayload(method: string, v: unknown): boolean {
  switch (method) {
    case "get_network_preferences":
      return keys(v, []);
    case "set_network_preferences":
      return (
        keys(v, ["sharing", "networkId", "accepted", "disclosureVersion"]) &&
        typeof v.sharing === "boolean" &&
        (v.sharing
          ? uuid(v.networkId)
          : v.networkId === "" || uuid(v.networkId)) &&
        typeof v.accepted === "boolean" &&
        v.disclosureVersion === "network-sharing-v1"
      );

    case "get_remote_preferences":
      return keys(v, []);
    case "set_remote_preferences":
      return (
        keys(v, ["sharing", "control", "accepted", "disclosureVersion"]) &&
        typeof v.sharing === "boolean" &&
        typeof v.control === "boolean" &&
        typeof v.accepted === "boolean" &&
        v.disclosureVersion === "developer-sharing-v1"
      );
    case "list_services":
      return (
        keys(v, ["query", "offset"]) &&
        text(v.query) &&
        integer(v.offset, 0, 256)
      );
    case "request_stop":
      return (
        keys(v, [
          "actionId",
          "serviceId",
          "observationId",
          "mode",
          "includeChildren",
        ]) &&
        uuid(v.actionId) &&
        hash(v.serviceId) &&
        uuid(v.observationId) &&
        ["graceful", "force"].includes(String(v.mode)) &&
        typeof v.includeChildren === "boolean"
      );
    case "set_project":
      return (
        keys(v, ["serviceId", "observationId", "label"]) &&
        hash(v.serviceId) &&
        uuid(v.observationId) &&
        text(v.label)
      );
    case "get_action_history":
      return keys(v, []) || (keys(v, ["offset"]) && integer(v.offset, 0, 75));
    case "set_local_control":
      return keys(v, ["allowed"]) && typeof v.allowed === "boolean";
    default:
      return false;
  }
}
function service(v: unknown): boolean {
  if (
    !keys(v, [
      "id",
      "observationId",
      "pid",
      "parentPid",
      "runtime",
      "executable",
      "startedAt",
      "uptimeSeconds",
      "observedAt",
      "endpoints",
      "additionalEndpoints",
      "project",
      "childCount",
      "canStop",
      "blockReason",
    ])
  )
    return false;
  const p = v.project;
  return (
    hash(v.id) &&
    uuid(v.observationId) &&
    integer(v.pid, 2) &&
    integer(v.parentPid) &&
    text(v.runtime) &&
    text(v.executable) &&
    date(v.startedAt) &&
    integer(v.uptimeSeconds, 0, Number.MAX_SAFE_INTEGER) &&
    date(v.observedAt) &&
    Array.isArray(v.endpoints) &&
    v.endpoints.length > 0 &&
    v.endpoints.length <= 8 &&
    v.endpoints.every(
      (e) =>
        keys(e, ["address", "port", "socketId"]) &&
        typeof e.address === "string" &&
        isIP(e.address) > 0 &&
        integer(e.port, 1, 65535) &&
        hash(e.socketId),
    ) &&
    integer(v.additionalEndpoints, 0, 64) &&
    integer(v.childCount, 0, 8192) &&
    typeof v.canStop === "boolean" &&
    text(v.blockReason) &&
    keys(p, ["id", "name", "source", "confidence", "evidence"]) &&
    hash(p.id) &&
    text(p.name) &&
    ["inferred", "directory", "unknown", "manual"].includes(String(p.source)) &&
    ["inferred", "uncertain", "unknown", "user_confirmed"].includes(
      String(p.confidence),
    ) &&
    text(p.evidence)
  );
}
function action(v: unknown): boolean {
  return (
    keys(v, [
      "actionId",
      "serviceId",
      "mode",
      "includeChildren",
      "pid",
      "project",
      "requestedAt",
      "completedAt",
      "outcome",
      "targetCount",
    ]) &&
    uuid(v.actionId) &&
    hash(v.serviceId) &&
    ["graceful", "force"].includes(String(v.mode)) &&
    typeof v.includeChildren === "boolean" &&
    integer(v.pid, 2) &&
    text(v.project) &&
    date(v.requestedAt) &&
    (v.completedAt === "" || date(v.completedAt)) &&
    outcomes.includes(v.outcome as (typeof outcomes)[number]) &&
    integer(v.targetCount, 1, 17)
  );
}
export function serviceData(method: string, v: unknown): v is DeveloperData {
  switch (method) {
    case "get_network_preferences":
    case "set_network_preferences":
      return (
        keys(v, ["sharing", "networkId", "supported"]) &&
        typeof v.sharing === "boolean" &&
        (v.networkId === "" || uuid(v.networkId)) &&
        typeof v.supported === "boolean"
      );

    case "get_remote_preferences":
    case "set_remote_preferences":
      return (
        keys(v, ["sharing", "control", "supported"]) &&
        typeof v.sharing === "boolean" &&
        typeof v.control === "boolean" &&
        typeof v.supported === "boolean"
      );
    case "list_services":
      return (
        keys(v, [
          "schemaVersion",
          "services",
          "total",
          "offset",
          "nextOffset",
          "truncated",
          "skippedProcesses",
          "observedAt",
          "expiresAt",
          "platformSupported",
          "localControlAllowed",
        ]) &&
        v.schemaVersion === 1 &&
        Array.isArray(v.services) &&
        v.services.length <= 10 &&
        v.services.every(service) &&
        integer(v.total, 0, 256) &&
        integer(v.offset, 0, 256) &&
        integer(v.nextOffset, -1, 256) &&
        typeof v.truncated === "boolean" &&
        integer(v.skippedProcesses, 0, 8192) &&
        date(v.observedAt) &&
        date(v.expiresAt) &&
        typeof v.platformSupported === "boolean" &&
        typeof v.localControlAllowed === "boolean"
      );
    case "request_stop":
      return action(v);
    case "get_action_history":
      return Array.isArray(v) && v.length <= 100 && v.every(action);
    case "set_project":
      return keys(v, ["saved"]) && v.saved === true;
    case "set_local_control":
      return keys(v, ["allowed"]) && typeof v.allowed === "boolean";
    default:
      return false;
  }
}
