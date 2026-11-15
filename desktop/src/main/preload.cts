import { contextBridge } from "electron";

// Read-only metadata only. Agent IPC and service controls belong to later phases.
contextBridge.exposeInMainWorld("netsentry", {
  getRuntimeInfo: () => ({ platform: process.platform, electronVersion: process.versions.electron }),
});
