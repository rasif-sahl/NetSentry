import { useState, useEffect } from "react";
import type { UpdateView } from "../main/update-controller";
export function Updates() {
  const [view, setView] = useState<UpdateView>(),
    [busy, setBusy] = useState(false);
  async function action(value: "status" | "check" | "download" | "install") {
    setBusy(true);
    try {
      const result = await window.netsentry?.desktopUpdate(value);
      if (result) setView(result);
    } catch {
      setView({
        state: "error",
        version: "",
        message:
          "Update controls are unavailable. Retry from the installed application.",
      });
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (view?.state !== "installing") return;
    let active = true;
    const timer = setInterval(() => {
      void window.netsentry
        ?.desktopUpdate("status")
        .then((result) => {
          if (active) setView(result);
        })
        .catch(() => {});
    }, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [view?.state]);
  return (
    <section className="desktop-card" aria-labelledby="updates-heading">
      <h2 id="updates-heading">Desktop updates</h2>
      <p>
        Updates require a signed macOS application and a configured update host.
        Downloads and installation each require confirmation. Agent credentials
        and monitoring consent stay separate.
      </p>
      <p role="status">
        {view?.message ||
          "Check update status to see whether this installation is configured."}
      </p>
      {view?.version && (
        <p>
          Version {view.version} · {view.state}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          disabled={
            busy || view?.state === "disabled" || view?.state === "installing"
          }
          onClick={() => void action(view ? "check" : "status")}
        >
          {busy ? "Working…" : view ? "Check for updates" : "Update status"}
        </button>
        {view?.state === "available" && (
          <button disabled={busy} onClick={() => void action("download")}>
            Download update
          </button>
        )}
        {view?.state === "downloaded" && (
          <button disabled={busy} onClick={() => void action("install")}>
            Restart and install
          </button>
        )}
      </div>
    </section>
  );
}
