export type Modules = { network: boolean; developer: boolean };
export type AgentStatus = {
  schemaVersion: 1; installationId: string; version: string; platform: string;
  paired: boolean; connection: "unpaired" | "offline" | "online" | "revoked";
  requested: Modules; authorized: Modules; effective: Modules;
  backgroundRequested: boolean; backgroundAllowed: boolean;
  bufferedEvents: number; droppedEvents: number; lastContact: string; code: string;
  serviceControlAvailable: false;
};
export type AgentResult = { ok: true; status: AgentStatus } | { ok: false; code: string };
export type AgentBridge = {
  getRuntimeInfo(): { platform: string; electronVersion: string };
  getAgentStatus(): Promise<AgentResult>;
  pairAgent(code: string): Promise<AgentResult>;
  setAgentModules(modules: Modules): Promise<AgentResult>;
  setAgentBackground(allowed: boolean): Promise<AgentResult>;
};
