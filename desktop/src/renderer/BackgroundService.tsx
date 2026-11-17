import { useEffect, useState } from "react";
import type { BackgroundView } from "../main/background-service";
export function BackgroundService({
  refreshKey,
  view: page = "status",
}: {
  refreshKey: string;
  view?: "status" | "login";
}) {
  const [view, setView] = useState<BackgroundView>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function action(value: "status" | "register" | "start" | "remove") {
    setBusy(true);
    setError("");
    try {
      const next = await window.netsentry?.backgroundService(value);
      if (next) setView(next);
      else
        setError(
          "Background controls are available in the desktop application.",
        );
    } catch {
      setError(
        "The service operation could not be verified. Refresh before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    void window.netsentry
      ?.backgroundService?.("status")
      .then((next) => {
        if (active) setView(next);
      })
      .catch(() => {
        if (active) setError("Background controls are unavailable.");
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);
  return (
    <section className="desktop-card" aria-labelledby="background-heading">
      <h2 id="background-heading">
        {page === "login" ? "Run at login" : "Background service status"}
      </h2>
      <p>
        Register a per-user macOS service after reviewing your workspace grant.
        Confirming registration saves your local background choice. Stop the
        foreground agent first. No monitoring or shutdown permission is granted
        by registration.
      </p>
      <p>
        The service starts at login without an automatic restart loop. If
        startup fails, resolve the issue and choose Start. Remove it before
        installing an app update.
      </p>
      <p role="status">
        {error ||
          view?.message ||
          "Background registration is optional and starts off."}
      </p>
      {view?.verified && (
        <p>
          Registered: {view.registered ? "yes" : "no"} · Loaded:{" "}
          {view.loaded ? "yes" : "no"} · Process running:{" "}
          {view.running ? "yes" : "no"}
        </p>
      )}
      {view?.checkedAt && (
        <p>Last checked: {new Date(view.checkedAt).toLocaleString()}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          className="bg-surface text-primary"
          disabled={busy}
          onClick={() => void action("status")}
        >
          Refresh background status
        </button>
        {page === "login" && (
          <button
            disabled={
              busy || !view?.verified || !view.canRegister || view.registered
            }
            onClick={() => void action("register")}
          >
            Register background service
          </button>
        )}
        {page === "status" && (
          <button
            disabled={
              busy ||
              !view?.verified ||
              !view.canRegister ||
              !view.registered ||
              view.running
            }
            onClick={() => void action("start")}
          >
            Start registered service
          </button>
        )}
        {page === "status" && (
          <button
            className="border-danger-line bg-danger-surface text-danger"
            disabled={busy || !view?.verified}
            onClick={() => void action("remove")}
          >
            Remove background service
          </button>
        )}
      </div>
      <p>
        <a href={page === "login" ? "#background" : "#login"}>
          {page === "login"
            ? "Review service status and removal"
            : "Review run-at-login registration"}
        </a>
      </p>
      <p>
        Removal stops only the managed NetSentry job and preserves pairing,
        module choices and stored data. Removing the app itself does not
        unregister a job; remove the service first.
      </p>
    </section>
  );
}
