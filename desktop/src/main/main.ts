import { app, BrowserWindow, session, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { request, requestServices } from "./agent-client.js";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const rendererURL = pathToFileURL(join(here, "../renderer/index.html")).href;
ipcMain.handle(
  "netsentry:agent",
  async (event, method: unknown, payload: unknown) => {
    if (
      event.senderFrame !== event.sender.mainFrame ||
      event.senderFrame.url !== rendererURL ||
      typeof method !== "string"
    )
      return { ok: false, code: "INVALID_REQUEST" };
    const call = [
      "list_services",
      "request_stop",
      "set_project",
      "get_action_history",
      "set_local_control",
    ].includes(method)
      ? requestServices
      : request;
    return call(
      {
        stateDir:
          (!app.isPackaged && process.env.NETSENTRY_AGENT_STATE_DIR) ||
          join(app.getPath("appData"), "NetSentry", "agent"),
        binary:
          (!app.isPackaged && process.env.NETSENTRY_AGENT_BINARY) ||
          join(process.resourcesPath, "agent", "netsentry-agent"),
      },
      method,
      payload,
    );
  },
);

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    show: false,
    webPreferences: {
      preload: join(here, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.once("ready-to-show", () => window.show());
  await window.loadFile(join(here, "../renderer/index.html"));
}

app
  .whenReady()
  .then(async () => {
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    await createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  })
  .catch((error: unknown) => {
    console.error("Could not open NetSentry Desktop:", error);
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
