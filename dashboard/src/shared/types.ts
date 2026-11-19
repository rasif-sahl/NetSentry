export type User = {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: string | null;
  preferences: {
    activeWorkspaceId?: string;
    theme?: string;
    reducedMotion?: boolean;
  };
};
export type Workspace = {
  id: string;
  name: string;
  type: string;
  role: string;
  timezone: string;
  ownerId: string;
};
export type Permissions = { role: string; permissions: string[] };
export type Device = {
  id: string;
  workspaceId: string;
  registeredById: string;
  name: string;
  platform: string;
  state: string;
  monitoringEnabled: boolean;
  consentScopes: string[];
  generation: number;
  lastSeenAt: string | null;
  lastSyncedAt: string | null;
  permissionStatus: string;
  monitoringHealth: string;
  batteryOptimizationStatus: string;
  applicationVersion: string | null;
  operatingSystemVersion: string | null;
  deviceModel: string | null;
  capabilityReport: {
    reportedAt: string;
    capabilities: {
      id: string;
      status: string;
      reason: string;
      source: string;
      checkedAt: string;
      availableActions: string[];
      requiredSetup: string[];
    }[];
  } | null;
};
export type Disclosure = { version: string; text: string; hash: string };
export type Disclosures = { enrolment: Disclosure; monitoring: Disclosure };
export type UsageNetwork = { id: string; name: string; createdAt: string };
export type Retention = {
  workspaceId: string;
  rawDays: number;
  aggregateDays: number;
  alertDays: number;
  diagnosticDays: number;
  effectiveAt: string | null;
};
export type RuleConfig = {
  kind: "threshold" | "device_offline" | "permission_revoked" | "not_reporting";
  metric?: string;
  quality?: "measured" | "estimated";
  applicationId?: string;
  period: string;
  threshold: number;
  severity: string;
  channels: string[];
  quietHours?: { start: string; end: string; timezone: string };
  enabled: boolean;
};
export type AlertRule = {
  id: string;
  deviceId: string | null;
  networkId: string | null;
  config: RuleConfig;
  active: boolean;
};
export type Alert = {
  id: string;
  ruleId: string;
  snapshot: {
    kind: string;
    value: string | null;
    severity: string;
    windowKey: string;
    quality?: "measured" | "estimated";
  };
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  deliveries: {
    id: string;
    channel: string;
    status: string;
    attempts: number;
    dueAt: string;
    attemptHistory: { at: string; outcome: string; code: string | null }[];
  }[];
};
export type Report = {
  timezone: string;
  from: string;
  to: string;
  metric: string;
  period: string;
  deviceIds: string[];
  buckets: {
    periodStart: string;
    measured: string | null;
    estimated: string | null;
    measuredCoverageMs: number;
    expectedMs: number;
    missingMs: number;
    prorated: boolean;
  }[];
  comparison: {
    from: string;
    to: string;
    currentMeasured: string | null;
    measured: string | null;
    percentChange: number | null;
  };
  sources: {
    deviceId: string;
    networkId: string | null;
    localDate: string;
    kind: string;
    collectorVersion: string;
    quality: string;
    value: string;
    coverageMs: string;
    prorated: boolean;
  }[];
  declaredGaps: {
    deviceId: string;
    reason: string;
    intervalStart: string;
    intervalEnd: string;
  }[];
  qualityNote: string;
};
export type Session = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
};
export type DeviceEvent = {
  id: string;
  kind: string;
  createdAt: string;
  details: Record<string, unknown>;
};
export type Member = {
  userId: string;
  displayName: string;
  email: string;
  role: string;
};
export type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};
