import { contextBridge, ipcRenderer } from "electron";
import type { AgentBridge } from "./agent-types.js";
const bridge: AgentBridge = {
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
  getServiceHistory: () =>
    ipcRenderer.invoke("netsentry:agent", "get_action_history", {}),
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
