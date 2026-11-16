import { useEffect, useRef, useState } from "react";
import type {
  Action,
  Inventory,
  Service,
  StopInput,
} from "../main/service-types";
const outcomeText: Record<string, string> = {
  stopped:
    "Process exit verified. No replacement listener was observed during the check.",
  replacement_listener:
    "The original process exited, but another process is listening on its address/port. A supervisor may have restarted it; refresh before any further action.",
  still_running:
    "The original process is still running. Graceful stop did not complete. Force-stop requires a separate confirmation.",
  stopped_unverified_listeners:
    "Original process exit verified. Replacement-listener inspection was unavailable.",
  already_stopped:
    "The original process has already exited. No signal was sent.",
  target_changed:
    "The process or its listening sockets changed. No replacement target was selected.",
  tree_changed:
    "The child-process tree changed. Refresh and review the new tree before trying again.",
  permission_denied:
    "The operating system denied this action. No elevated-privilege fallback is attempted.",
  partial:
    "Only part of the captured process tree was signalled. Refresh to inspect the outcome.",
  unknown:
    "The outcome is unknown. Inspect history and refresh; do not assume the service stopped.",
  inspection_failed:
    "The process could not be inspected reliably. Shutdown is not confirmed.",
  tree_limit:
    "This process has more than 16 descendants. No tree stop was attempted.",
  pending: "The request was recorded; completion has not been confirmed.",
};
function errorText(code: string): string {
  if (code === "STALE_OBSERVATION")
    return "This observation expired or changed. Refresh and review the service again.";
  if (code === "LOCAL_CONTROL_DISABLED")
    return "Local service control is disabled. Enable it explicitly before stopping a service.";
  if (
    code === "MODULE_DISABLED" ||
    code === "AUTHORIZATION_UNAVAILABLE" ||
    code === "CONFIGURATION_REQUIRED"
  )
    return "Developer access is unavailable. Check pairing, workspace authorization and the backend connection, then refresh.";
  return "The agent could not complete this request. Refresh and inspect action history before retrying a stop.";
}
export function Services({
  enabled,
  installationId,
}: {
  enabled: boolean;
  installationId: string;
}) {
  const [inventory, setInventory] = useState<Inventory>();
  const [history, setHistory] = useState<Action[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<{
    service: Service;
    mode: "graceful" | "force";
  }>();
  const [children, setChildren] = useState(false);
  const [now, setNow] = useState(Date.now());
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    generation.current++;
    setInventory(undefined);
    setHistory([]);
    setHistoryLoaded(false);
    setHistoryOffset(0);
    setSelected(undefined);
    setMessage("");
    return () => {
      generation.current++;
    };
  }, [enabled, installationId]);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  async function refresh(offset = 0, search = activeQuery) {
    const epoch = generation.current;
    setBusy(true);
    setSelected(undefined);
    try {
      const result = await window.netsentry?.listServices(search, offset);
      if (epoch !== generation.current) return;
      if (result?.ok) {
        setInventory(result.data);
        setMessage(
          result.data.platformSupported
            ? "Inventory refreshed. Observations are valid for 15 seconds."
            : "Developer discovery and control are unavailable on this platform.",
        );
      } else {
        setInventory(undefined);
        setHistory([]);
        setMessage(errorText(result?.code || "AGENT_UNAVAILABLE"));
      }
    } catch {
      if (epoch === generation.current) {
        setInventory(undefined);
        setHistory([]);
        setMessage("Local agent unavailable.");
      }
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function loadHistory(offset = 0) {
    const epoch = generation.current;
    setBusy(true);
    try {
      const result = await window.netsentry?.getServiceHistory(offset);
      if (epoch !== generation.current) return;
      if (result?.ok) {
        setHistory(result.data);
        setHistoryOffset(offset);
        setHistoryLoaded(true);
      } else {
        setHistory([]);
        setInventory(undefined);
        setMessage(errorText(result?.code || "AGENT_UNAVAILABLE"));
      }
    } catch {
      if (epoch === generation.current) {
        setInventory(undefined);
        setHistory([]);
        setMessage("Local agent unavailable. Refresh to try again.");
      }
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function control(allowed: boolean) {
    setBusy(true);
    const epoch = generation.current;
    try {
      const result = await window.netsentry?.setLocalControl(allowed);
      if (epoch !== generation.current) return;
      if (result?.ok) await refresh();
      else setMessage(errorText(result?.code || "AGENT_UNAVAILABLE"));
    } catch {
      if (epoch === generation.current) {
        setInventory(undefined);
        setMessage("Local agent unavailable.");
      }
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function associate(service: Service, label: string) {
    const epoch = generation.current;
    setBusy(true);
    try {
      const result = await window.netsentry?.setServiceProject(
        service.id,
        service.observationId,
        label,
      );
      if (epoch !== generation.current) return;
      if (result?.ok) await refresh(0);
      else {
        setInventory(undefined);
        setMessage(errorText(result?.code || "AGENT_UNAVAILABLE"));
      }
    } catch {
      if (epoch === generation.current) {
        setInventory(undefined);
        setHistory([]);
        setMessage("Local agent unavailable. Refresh to try again.");
      }
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function stop() {
    if (!selected || expired || busy) return;
    const epoch = generation.current;
    const input: StopInput = {
      actionId: crypto.randomUUID(),
      serviceId: selected.service.id,
      observationId: selected.service.observationId,
      mode: selected.mode,
      includeChildren: children,
    };
    setBusy(true);
    try {
      const result = await window.netsentry?.stopService(input);
      if (epoch !== generation.current) return;
      setSelected(undefined);
      setInventory(undefined);
      if (result?.ok) {
        setHistory((previous) =>
          [
            result.data,
            ...(historyOffset === 0 ? previous : []).filter(
              (a) => a.actionId !== result.data.actionId,
            ),
          ].slice(0, 25),
        );
        setHistoryOffset(0);
        setHistoryLoaded(true);
        setMessage(
          outcomeText[result.data.outcome] ||
            "Inspect history for the action outcome.",
        );
      } else {
        setMessage(errorText(result?.code || "AGENT_UNAVAILABLE"));
      }
    } catch {
      if (epoch === generation.current) {
        setSelected(undefined);
        setInventory(undefined);
        setMessage(
          "The response was lost. Inspect history before retrying; shutdown is not confirmed.",
        );
      }
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  const expired = !inventory || now > Date.parse(inventory.expiresAt);
  const visible = (inventory?.services || []).filter(
    (s) => filter !== "controllable" || s.canStop,
  );
  const groups = new Map<string, Service[]>();
  for (const service of visible) {
    groups.set(service.project.id, [
      ...(groups.get(service.project.id) || []),
      service,
    ]);
  }
  return (
    <section aria-labelledby="services-heading" className="developer-section">
      <h2 id="services-heading">Development services</h2>
      <p>
        Local TCP listeners owned by your user. Runtime labels are inferred from
        executable names. Full paths, command arguments and service inventory
        stay on this computer. Remote controls are unavailable.
      </p>
      {!enabled ? (
        <p>
          Pair this computer and enable Developer Tools locally and in your
          workspace to inspect services.
        </p>
      ) : (
        <>
          <form
            className="toolbar"
            onSubmit={(event) => {
              event.preventDefault();
              setActiveQuery(query);
              void refresh(0, query);
            }}
          >
            <label>
              Search projects, runtimes, PIDs or ports
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={100}
              />
            </label>
            <button disabled={busy}>Refresh services</button>
          </form>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void loadHistory()}
          >
            Load action history
          </button>
          <p role="status" aria-live="polite">
            {message}
          </p>
          {inventory && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={inventory.localControlAllowed}
                  disabled={busy || !inventory.platformSupported}
                  onChange={(event) => void control(event.target.checked)}
                />{" "}
                Allow local service shutdown
              </label>
              <p>
                This is separate from module eligibility. It allows only
                confirmed actions on supported processes owned by your user; it
                grants no mobile or remote access.
              </p>
              {inventory.platformSupported && (
                <>
                  <p>
                    {inventory.total} matching services · observed{" "}
                    {inventory.observedAt}.{" "}
                    {expired
                      ? "Observation expired — refresh before changing or stopping services."
                      : "Observation is fresh."}
                  </p>
                  {inventory.skippedProcesses > 0 && (
                    <p>
                      {inventory.skippedProcesses} processes could not be
                      inspected completely (permissions, process exits or
                      inspection limits).
                    </p>
                  )}
                  {inventory.truncated && (
                    <p>
                      Inventory reached its 256-service limit. Some services are
                      not shown.
                    </p>
                  )}
                  <label>
                    Filter this page{" "}
                    <select
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                    >
                      <option value="all">All listeners</option>
                      <option value="controllable">
                        Controllable services
                      </option>
                    </select>
                  </label>
                  {!visible.length && (
                    <p>
                      No matching services on this page. Try another search or
                      page.
                    </p>
                  )}
                  {[...groups.entries()].map(([id, services]) => (
                    <div key={id} className="project-group">
                      <h3>{services[0].project.name}</h3>
                      <p>
                        {services[0].project.evidence} ·{" "}
                        {services[0].project.confidence.replaceAll("_", " ")}
                      </p>
                      {services.map((service) => (
                        <article key={service.id} className="service-card">
                          <h4>
                            {service.runtime === "unknown"
                              ? service.executable
                              : service.runtime}{" "}
                            · PID {service.pid}
                          </h4>
                          <p>
                            Parent PID {service.parentPid} · Started{" "}
                            {service.startedAt} · Running{" "}
                            {Math.floor(service.uptimeSeconds / 60)} min ·{" "}
                            {service.childCount} child processes
                          </p>
                          <p className="endpoints">
                            {service.endpoints
                              .map(
                                (e) =>
                                  `${e.address.includes(":") ? `[${e.address}]` : e.address}:${e.port}`,
                              )
                              .join(", ")}
                            {service.additionalEndpoints > 0
                              ? ` and ${service.additionalEndpoints} more listeners`
                              : ""}
                          </p>
                          {!service.canStop && (
                            <p>
                              {service.blockReason
                                .replaceAll("_", " ")
                                .toLowerCase()}
                            </p>
                          )}
                          <ProjectForm
                            service={service}
                            disabled={busy || expired}
                            save={(label) => void associate(service, label)}
                          />
                          <div className="actions">
                            <button
                              disabled={busy || expired || !service.canStop}
                              onClick={() => {
                                setChildren(false);
                                setSelected({ service, mode: "graceful" });
                              }}
                            >
                              Stop gracefully
                            </button>
                            <button
                              className="danger"
                              disabled={busy || expired || !service.canStop}
                              onClick={() => {
                                setChildren(false);
                                setSelected({ service, mode: "force" });
                              }}
                            >
                              Force stop…
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ))}
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={busy || inventory.offset === 0}
                      onClick={() =>
                        void refresh(Math.max(0, inventory.offset - 10))
                      }
                    >
                      Previous page
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || inventory.nextOffset < 0}
                      onClick={() => void refresh(inventory.nextOffset)}
                    >
                      Next page
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          {historyLoaded && (
            <div>
              <h3>Local action history</h3>
              <p>
                Up to 100 actions within seven days, 25 per page. A sent signal
                is not a confirmed shutdown.
              </p>
              <ol className="history">
                {history.map((action) => (
                  <li key={action.actionId}>
                    <strong>
                      {action.project} · PID {action.pid} · {action.mode}
                    </strong>
                    <p>{outcomeText[action.outcome] || action.outcome}</p>
                    <small>
                      {action.requestedAt} · {action.targetCount} captured
                      targets
                      {action.completedAt
                        ? ` · checked ${action.completedAt}`
                        : " · completion unknown"}
                    </small>
                  </li>
                ))}
              </ol>
              {!history.length && <p>No action receipts on this page.</p>}
              <div className="actions">
                <button
                  className="secondary"
                  disabled={busy || historyOffset === 0}
                  onClick={() =>
                    void loadHistory(Math.max(0, historyOffset - 25))
                  }
                >
                  Previous history page
                </button>
                <button
                  className="secondary"
                  disabled={busy || history.length < 25 || historyOffset >= 75}
                  onClick={() => void loadHistory(historyOffset + 25)}
                >
                  Next history page
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="stop-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setSelected(undefined);
        }}
      >
        {selected && (
          <>
            <h2 id="stop-title">
              {selected.mode === "force" ? "Force stop" : "Stop gracefully"} ·
              PID {selected.service.pid}?
            </h2>
            <p>
              {selected.service.runtime} in {selected.service.project.name}.
              This stops the process and all its listeners, not just one port.
            </p>
            <p>
              {selected.mode === "force"
                ? "Force-stop sends SIGKILL and may discard unfinished work. It is never an automatic fallback."
                : "Graceful stop sends SIGTERM. The application may ignore it or take time to exit."}{" "}
              A parent supervisor may start a replacement.
            </p>
            {selected.service.childCount > 0 && (
              <label>
                <input
                  type="checkbox"
                  checked={children}
                  disabled={busy}
                  onChange={(event) => setChildren(event.target.checked)}
                />{" "}
                Also stop the {selected.service.childCount} captured child
                processes (maximum 16)
              </label>
            )}
            {expired && (
              <p role="alert">This observation expired. Cancel and refresh.</p>
            )}
            <div className="actions">
              <button
                className={selected.mode === "force" ? "danger" : ""}
                disabled={busy || expired}
                onClick={() => void stop()}
              >
                {busy
                  ? "Checking outcome…"
                  : selected.mode === "force"
                    ? "Confirm force-stop"
                    : "Confirm graceful stop"}
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setSelected(undefined)}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
function ProjectForm({
  service,
  disabled,
  save,
}: {
  service: Service;
  disabled: boolean;
  save: (label: string) => void;
}) {
  const [label, setLabel] = useState(
    service.project.source === "manual" ? service.project.name : "",
  );
  useEffect(
    () =>
      setLabel(service.project.source === "manual" ? service.project.name : ""),
    [service.project.source, service.project.name],
  );
  return (
    <form
      className="project-form"
      onSubmit={(event) => {
        event.preventDefault();
        save(label);
      }}
    >
      <label>
        Correct project/group name for PID {service.pid}
        <input
          value={label}
          disabled={disabled}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={100}
          placeholder="Your project name"
        />
      </label>
      <button className="secondary" disabled={disabled}>
        Save association
      </button>
      {service.project.source === "manual" && (
        <button
          className="secondary"
          disabled={disabled}
          type="button"
          onClick={() => save("")}
        >
          Use inferred project
        </button>
      )}
    </form>
  );
}
