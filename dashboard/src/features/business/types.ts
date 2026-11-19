export type Location = { id: string; name: string; revision: number };
export type Department = Location & { locationId: string };
type Employee = {
  id: string;
  userId: string;
  displayName: string;
  departmentId: string | null;
  revision: number;
  offboardedAt: string | null;
};
type Assignment = {
  deviceId: string;
  employeeId: string;
  generation: number;
  revision: number;
  consentedAt: string | null;
  reportFrom: string | null;
};
type Device = {
  id: string;
  name: string;
  platform: string;
  state: string;
  generation: number;
  registeredById: string;
  ownership: string;
  lastSeenAt: string | null;
  compliance: { state: string; checks: string[] };
};
type Endpoint = {
  id: string;
  name: string;
  networkId: string;
  networkName: string;
  departmentId: string | null;
  revision: number;
};
export type Overview = {
  endpoints: Endpoint[];
  moreEndpoints: boolean;
  organization: { id: string; name: string; timezone: string };
  permissions: string[];
  disclosure: { text: string };
  custodyDisclosure: { text: string };
  locations: Location[];
  departments: Department[];
  employees: Employee[];
  assignments: Assignment[];
  devices: Device[];
  networks: {
    id: string;
    name: string;
    locationId: string | null;
    collectorCount: number;
    freshCollectors: number;
  }[];
  policy: {
    revision: number;
    staleMinutes: number;
    requireMonitoring: boolean;
    requirePermission: boolean;
  } | null;
  qualityNote: string;
};
export type Report = {
  from: string;
  to: string;
  timezone: string;
  qualityNote: string;
  rows: {
    localDate: string;
    metric: string;
    quality: string;
    sourceKind: string;
    collectorVersion: string;
    departmentId: string | null;
    locationId: string | null;
    value: string;
    deviceCount: number;
  }[];
};
export type Audit = {
  rows: {
    id: string;
    action: string;
    targetId: string | null;
    actorId: string | null;
    occurredAt: string;
  }[];
  retentionDays: number;
};
export type Alert = {
  id: string;
  kind: string;
  severity: string;
  occurredAt: string;
  networkName: string;
  assigneeId: string | null;
  revision: number;
  resolvedAt: string | null;
};

export type BusinessSectionProps = {
  data: Overview;
  options?: Overview;
  can: (permission: string) => boolean;
  mutate: (path: string, method: string, body?: unknown) => Promise<void>;
};
