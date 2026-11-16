import { contextBridge, ipcRenderer } from "electron";
import type { AgentBridge } from "./agent-types.js";
const bridge: AgentBridge = {
  desktopDiagnostics: (action) => ipcRenderer.invoke("netsentry:diagnostics", action),
  backgroundService: (action) => ipcRenderer.invoke("netsentry:background", action),
  desktopUpdate: (action) => ipcRenderer.invoke("netsentry:update", action),
  getNetworkPreferences: () => ipcRenderer.invoke("netsentry:agent", "get_network_preferences", {}),
  setNetworkPreferences: (sharing, networkId, accepted) => ipcRenderer.invoke("netsentry:agent", "set_network_preferences", { sharing, networkId, accepted, disclosureVersion: "network-sharing-v1" }),
  getRemotePreferences: () =>
    ipcRenderer.invoke("netsentry:agent", "get_remote_preferences", {}),
  setRemotePreferences: (sharing, control, accepted) =>
    ipcRenderer.invoke("netsentry:agent", "set_remote_preferences", {
      sharing,
      control,
      accepted,
      disclosureVersion: "developer-sharing-v1",
    }),
  listServices: (query, offset) =>
    ipcRenderer.invoke("netsentry:agent", "list_services", { query, offset }),
  stopService: (input) =>
    ipcRenderer.invoke("netsentry:agent", "request_stop", input),
  setServiceProject: (serviceId, observationId, label) =>
    ipcRenderer.invoke("netsentry:agent", "set_project", {
      serviceId,
      observationId,
      label,
    }),
  getServiceHistory: (offset = 0) =>
    ipcRenderer.invoke("netsentry:agent", "get_action_history", { offset }),
  setLocalControl: (allowed) =>
    ipcRenderer.invoke("netsentry:agent", "set_local_control", { allowed }),
  getRuntimeInfo: () => ({
    platform: process.platform,
    electronVersion: process.versions.electron,
  }),
  getAgentStatus: () => ipcRenderer.invoke("netsentry:agent", "get_status", {}),
  pairAgent: (token) =>
    ipcRenderer.invoke("netsentry:agent", "pair", { token }),
  setAgentModules: (modules) =>
    ipcRenderer.invoke("netsentry:agent", "set_modules", modules),
  setAgentBackground: (allowed) =>
    ipcRenderer.invoke("netsentry:agent", "set_background", { allowed }),
};
contextBridge.exposeInMainWorld("netsentry", Object.freeze(bridge));
