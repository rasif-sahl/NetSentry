import type { NetworkPreferences, RemotePreferences } from "./service-types.js";
import type {
  Inventory,
  Action,
  StopInput,
  ServiceResult,
} from "./service-types.js";
export type Modules = { network: boolean; developer: boolean };
export type AgentStatus = {
  schemaVersion: 1;
  installationId: string;
  version: string;
  platform: string;
  paired: boolean;
  connection: "unpaired" | "offline" | "online" | "revoked";
  requested: Modules;
  authorized: Modules;
  effective: Modules;
  backgroundRequested: boolean;
  backgroundAllowed: boolean;
  bufferedEvents: number;
  droppedEvents: number;
  lastContact: string;
  code: string;
  serviceControlAvailable: false;
};
export type AgentResult =
  { ok: true; status: AgentStatus } | { ok: false; code: string };
export type AgentBridge = {
  desktopUpdate(action: "status" | "check" | "download" | "install"): Promise<import("./update-controller.js").UpdateView>;
  getNetworkPreferences(): Promise<ServiceResult<NetworkPreferences>>;
  setNetworkPreferences(sharing: boolean, networkId: string, accepted: boolean): Promise<ServiceResult<NetworkPreferences>>;
  getRemotePreferences(): Promise<ServiceResult<RemotePreferences>>;
  setRemotePreferences(
    sharing: boolean,
    control: boolean,
    accepted: boolean,
  ): Promise<ServiceResult<RemotePreferences>>;
  listServices(
    query: string,
    offset: number,
  ): Promise<ServiceResult<Inventory>>;
  stopService(input: StopInput): Promise<ServiceResult<Action>>;
  setServiceProject(
    serviceId: string,
    observationId: string,
    label: string,
  ): Promise<ServiceResult<{ saved: true }>>;
  getServiceHistory(offset?: number): Promise<ServiceResult<Action[]>>;
  setLocalControl(
    allowed: boolean,
  ): Promise<ServiceResult<{ allowed: boolean }>>;
  getRuntimeInfo(): { platform: string; electronVersion: string };
  getAgentStatus(): Promise<AgentResult>;
  pairAgent(code: string): Promise<AgentResult>;
  setAgentModules(modules: Modules): Promise<AgentResult>;
  setAgentBackground(allowed: boolean): Promise<AgentResult>;
};
