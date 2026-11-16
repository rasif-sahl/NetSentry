import { CancellationToken } from "builder-util-runtime";
import type { AppUpdater } from "electron-updater";
import { signedProvider } from "./signed-provider.js";
import type { DesktopManifest, ReleasePolicy } from "./update-policy.js";
import type { UpdaterPort } from "./update-controller.js";
export async function updaterRuntime(
  policy: ReleasePolicy,
): Promise<UpdaterPort> {
  const { default: library } = await import("electron-updater");
  const updater: AppUpdater = library.autoUpdater;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  updater.disableDifferentialDownload = true;
  updater.logger = null;
  let errorHandler = () => {};
  updater.on("error", () => errorHandler()); // Provider/native details must never enter renderer or logs.
  const origin = new URL(policy.feedUrl).origin;
  updater.netSession.webRequest.onBeforeRequest((details, done) => {
    try {
      const url = new URL(details.url);
      done({ cancel: url.protocol !== "https:" || url.origin !== origin });
    } catch {
      done({ cancel: true });
    }
  });
  let file = "";
  updater.on("update-downloaded", (info) => {
    file = info.downloadedFile;
  });
  return {
    onError(callback) {
      errorHandler = callback;
    },
    async check(manifest: DesktopManifest) {
      file = "";
      updater.setFeedURL({
        provider: "custom",
        updateProvider: signedProvider(policy, manifest),
      });
      const result = await updater.checkForUpdates();
      if (!result?.isUpdateAvailable) throw new Error("Candidate unavailable.");
    },
    async download() {
      const token = new CancellationToken();
      const timer = setTimeout(() => token.cancel(), 300000);
      try {
        await updater.downloadUpdate(token);
        if (!file) throw new Error("No verified download.");
        return file;
      } finally {
        clearTimeout(timer);
      }
    },
    install() {
      updater.quitAndInstall();
    },
  };
}
