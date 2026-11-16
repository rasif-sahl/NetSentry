export type NetworkPreferences = {
  sharing: boolean;
  networkId: string;
  supported: boolean;
};
export type Endpoint = { address: string; port: number; socketId: string };
export type Project = {
  id: string;
  name: string;
  source: "inferred" | "directory" | "unknown" | "manual";
  confidence: "inferred" | "uncertain" | "unknown" | "user_confirmed";
  evidence: string;
};
export type Service = {
  id: string;
  observationId: string;
  pid: number;
  parentPid: number;
  runtime: string;
  executable: string;
  startedAt: string;
  uptimeSeconds: number;
  observedAt: string;
  endpoints: Endpoint[];
  additionalEndpoints: number;
  project: Project;
  childCount: number;
  canStop: boolean;
  blockReason: string;
};
export type Inventory = {
  schemaVersion: 1;
  services: Service[];
  total: number;
  offset: number;
  nextOffset: number;
  truncated: boolean;
  skippedProcesses: number;
  observedAt: string;
  expiresAt: string;
  platformSupported: boolean;
  localControlAllowed: boolean;
};
export type StopInput = {
  actionId: string;
  serviceId: string;
  observationId: string;
  mode: "graceful" | "force";
  includeChildren: boolean;
};
export const outcomes = [
  "pending",
  "unknown",
  "already_stopped",
  "permission_denied",
  "target_changed",
  "inspection_failed",
  "tree_limit",
  "tree_changed",
  "partial",
  "stopped_unverified_listeners",
  "replacement_listener",
  "stopped",
  "still_running",
] as const;
export type Action = {
  actionId: string;
  serviceId: string;
  mode: "graceful" | "force";
  includeChildren: boolean;
  pid: number;
  project: string;
  requestedAt: string;
  completedAt: string;
  outcome: (typeof outcomes)[number];
  targetCount: number;
};
export type RemotePreferences = {
  sharing: boolean;
  control: boolean;
  supported: boolean;
};
export type DeveloperData =
  | NetworkPreferences
  | RemotePreferences
  | Inventory
  | Action
  | Action[]
  | { saved: true }
  | { allowed: boolean };
export type ServiceResult<T extends DeveloperData = DeveloperData> =
  { ok: true; data: T } | { ok: false; code: string };
