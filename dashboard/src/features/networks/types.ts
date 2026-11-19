export type NetworkSite = { networkId: string; name: string; cidrs: string[] };
type Endpoint = {
  id: string;
  name: string;
  mac: string | null;
  category: string;
  trust: string;
  notes: string;
  archived: boolean;
  assignedUserId: string | null;
  registeredDeviceId: string | null;
  presence: string;
  lastSeenAt: string;
  observations: {
    agentId: string;
    address: string;
    evidence: string;
    observedAt: string;
  }[];
};
export type NetworkView = NetworkSite & {
  collectors: {
    agentId: string;
    name: string;
    connection: string;
    enabled: boolean;
    observedAt: string | null;
    interfaces: { name: string; cidr: string; gateway: string | null }[];
  }[];
  endpoints: Endpoint[];
  presenceHistory: {
    id: string;
    endpointId: string;
    agentId: string;
    address: string;
    evidence: string;
    firstObservedAt: string;
    lastObservedAt: string;
  }[];
  router: null | {
    adapter: string;
    url: string;
    model: string;
    firmware: string;
    reportedModel: string | null;
    reportedFirmware: string | null;
    testStatus: string;
    credentialConfigured: boolean;
  };
  routerHealth: string;
  wanUp: boolean | null;
  reportedAt: string | null;
  bandwidth: {
    receivedBytes: string;
    sentBytes: string;
    coverageMs: number;
    missingMs: number;
    peakRecentBitsPerSecond: number | null;
    history: { at: string; rx: string; tx: string; gaps: number }[];
    samples: {
      id: string;
      observedAt: string;
      quality: string;
      rxDelta: string | null;
      txDelta: string | null;
    }[];
  };
  events: {
    id: string;
    kind: string;
    severity: string;
    occurredAt: string;
    acknowledgedAt: string | null;
  }[];
  compatibility: {
    id: string;
    manufacturer: string;
    model: string;
    firmware: string;
    evidence: string;
    testedAt: string;
    features: string[];
    limitations: string;
    feedback: string;
  }[];
  limitations: string[];
};
