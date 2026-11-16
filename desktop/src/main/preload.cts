import { contextBridge, ipcRenderer } from "electron";
import type { AgentBridge } from "./agent-types.js";
const bridge: AgentBridge = {
 getRuntimeInfo: () => ({ platform: process.platform, electronVersion: process.versions.electron }),
 getAgentStatus: () => ipcRenderer.invoke("netsentry:agent", "get_status", {}),
 pairAgent: (token) => ipcRenderer.invoke("netsentry:agent", "pair", { token }),
 setAgentModules: (modules) => ipcRenderer.invoke("netsentry:agent", "set_modules", modules),
 setAgentBackground: (allowed) => ipcRenderer.invoke("netsentry:agent", "set_background", { allowed }),
};
contextBridge.exposeInMainWorld("netsentry", Object.freeze(bridge));
