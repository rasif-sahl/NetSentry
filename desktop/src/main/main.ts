import { app, BrowserWindow, session, ipcMain, dialog } from "electron";
import { mkdirSync } from "node:fs";
import { holdAgentUpdateLock } from "./update-lock.js";
import { dirname, join } from "node:path";
import { request, requestServices } from "./agent-client.js";
import {
  validatePolicy,
  privateRead,
  UpdateStore,
  type ReleasePolicy,
} from "./update-policy.js";
import { UpdateController } from "./update-controller.js";
import { updaterRuntime } from "./updater-runtime.js";
import { verifyDesktopTrust } from "./desktop-trust.js";
import { pathToFileURL, fileURLToPath } from "node:url";

const desktopData = join(app.getPath("appData"), "NetSentry", "desktop");
mkdirSync(desktopData, { recursive: true, mode: 0o700 });
app.setPath("userData", desktopData);
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
let policy: ReleasePolicy = {
  schemaVersion: 1,
  enabled: false,
  appId: "com.netsentry.desktop",
  teamId: "",
  feedUrl: "",
  publicKey: "",
  release: 1,
};
const agentState = () => join(app.getPath("appData"), "NetSentry", "agent");
const bundle = () => join(process.resourcesPath, "../..");
let updates: UpdateController | undefined;
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
    if (app.isPackaged) {
      try {
        await verifyDesktopTrust(
          bundle(),
          process.resourcesPath,
          policy.teamId,
        );
      } catch {
        return { ok: false, code: "SIGNED_INSTALL_REQUIRED" };
      }
    }
    const call = [
      "get_network_preferences",
      "set_network_preferences",
      "get_remote_preferences",
      "set_remote_preferences",
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

ipcMain.handle("netsentry:update", async (event, action: unknown) => {
  if (
    event.senderFrame !== event.sender.mainFrame ||
    event.senderFrame.url !== rendererURL ||
    typeof action !== "string" ||
    !["status", "check", "download", "install"].includes(action)
  )
    throw new Error("Invalid update request.");
  if (!updates) throw new Error("Update controls unavailable.");
  return updates.act(action, async () => {
    const answer = await dialog.showMessageBox({
      type: "question",
      buttons: [
        "Cancel",
        action === "install" ? "Restart and install" : "Download update",
      ],
      defaultId: 0,
      cancelId: 0,
      message:
        action === "install"
          ? "Restart NetSentry to install this update?"
          : "Download the verified desktop update?",
      detail:
        action === "install"
          ? "Stop the separately running agent first. Credentials are preserved; monitoring permissions are not changed."
          : "This downloads a signed release candidate. Installation requires another confirmation.",
    });
    return answer.response === 1;
  });
});
async function prepareUpdates() {
  if (app.isPackaged) {
    try {
      policy = validatePolicy(
        JSON.parse(
          (
            await privateRead(
              join(process.resourcesPath, "update-policy.json"),
              8192,
            )
          ).toString(),
        ),
      );
    } catch {
      policy.enabled = false;
    }
  }
  let port = null;
  if (app.isPackaged && process.platform === "darwin" && policy.enabled) {
    try {
      await verifyDesktopTrust(bundle(), process.resourcesPath, policy.teamId);
      port = await updaterRuntime(policy);
    } catch {
      port = null;
    }
  }
  updates = new UpdateController(
    policy,
    app.getVersion(),
    process.arch,
    new UpdateStore(join(app.getPath("userData"), "updates")),
    agentState(),
    port,
    undefined,
    async () => {
      await verifyDesktopTrust(bundle(), process.resourcesPath, policy.teamId);
      return holdAgentUpdateLock(
        join(process.resourcesPath, "agent", "netsentry-agent"),
        agentState(),
      );
    },
  );
  await updates.restore();
}
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

(primaryInstance ? app.whenReady() : new Promise<void>(() => {}))
  .then(async () => {
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    await prepareUpdates();
    await createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  })
  .catch((error: unknown) => {
    console.error(
      "Could not open NetSentry Desktop. Check the installed application.",
    );
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
