import { app, BrowserWindow, session, ipcMain, dialog } from "electron";
import { BackgroundService } from "./background-service.js";
import { nativeBackgroundPorts } from "./background-native.js";
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
let background: BackgroundService | undefined;
let lifecycleBusy = false;
async function lifecycle<T>(operation: () => Promise<T>): Promise<T> {
  if (lifecycleBusy || updates?.status().state === "installing")
    throw new Error("Another desktop lifecycle operation is in progress.");
  lifecycleBusy = true;
  try {
    return await operation();
  } finally {
    lifecycleBusy = false;
  }
}
async function confirmBackground(action: string) {
  const answer = await dialog.showMessageBox({
    type: "question",
    buttons: [
      "Cancel",
      action === "remove"
        ? "Remove service"
        : action === "start"
          ? "Start service"
          : "Register service",
    ],
    defaultId: 0,
    cancelId: 0,
    message:
      action === "remove"
        ? "Stop and remove NetSentry’s background service?"
        : "Run NetSentry in the background for this user?",
    detail:
      action === "remove"
        ? "Only NetSentry’s managed job is stopped. Pairing, module choices and stored data are preserved. Local background permission will be disabled when the trusted agent is available."
        : "Stop the foreground agent first. Confirming allows local background operation only after a fresh workspace grant is verified. The service starts at login with no automatic restart loop; it grants no new monitoring or shutdown permissions.",
  });
  return answer.response === 1;
}

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
    if (
      method === "set_background" &&
      payload &&
      typeof payload === "object" &&
      (payload as { allowed?: unknown }).allowed === false &&
      Object.keys(payload).length === 1 &&
      app.isPackaged &&
      background
    ) {
      await lifecycle(() =>
        background!.act("remove", () => confirmBackground("remove")),
      );
      return request(
        {
          binary: join(process.resourcesPath, "agent", "netsentry-agent"),
          stateDir: agentState(),
        },
        "get_status",
        {},
      );
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

ipcMain.handle("netsentry:background", async (event, action: unknown) => {
  if (
    event.senderFrame !== event.sender.mainFrame ||
    event.senderFrame.url !== rendererURL ||
    typeof action !== "string" ||
    !["status", "register", "start", "remove"].includes(action)
  )
    throw new Error("Invalid background request.");
  if (!background) throw new Error("Background controls unavailable.");
  return action === "status"
    ? background.status()
    : lifecycle(() => background!.act(action, () => confirmBackground(action)));
});

ipcMain.handle("netsentry:update", async (event, action: unknown) => {
  if (
    event.senderFrame !== event.sender.mainFrame ||
    event.senderFrame.url !== rendererURL ||
    typeof action !== "string" ||
    !["status", "check", "download", "install"].includes(action)
  )
    throw new Error("Invalid update request.");
  if (!updates) throw new Error("Update controls unavailable.");
  const operation = () =>
    updates!.act(action, async () => {
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
            ? "Stop the foreground agent and remove any registered background service first. Credentials are preserved; monitoring permissions are not changed."
            : "This downloads a signed release candidate. Installation requires another confirmation.",
      });
      return answer.response === 1;
    });
  return action === "status" ? operation() : lifecycle(operation);
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
      await background?.assertRemovedForUpdate();
      return holdAgentUpdateLock(
        join(process.resourcesPath, "agent", "netsentry-agent"),
        agentState(),
      );
    },
  );
  background = new BackgroundService(
    app.getPath("home"),
    join(process.resourcesPath, "agent", "netsentry-agent"),
    agentState(),
    desktopData,
    nativeBackgroundPorts(
      app.getPath("home"),
      bundle(),
      process.resourcesPath,
      agentState(),
      () => policy.teamId,
      app.isPackaged,
    ),
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
