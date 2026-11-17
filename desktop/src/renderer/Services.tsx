import { useEffect, useRef, useState } from "react";
import { Unavailable } from "./Navigation";
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
  view = "inventory",
}: {
  enabled: boolean;
  installationId: string;
  view?: "inventory" | "projects" | "control" | "history";
}) {
  const [detailId, setDetailId] = useState<string>();
  const detailHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (detailId) detailHeading.current?.focus();
  }, [detailId]);
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
    setDetailId(undefined);
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
    setDetailId(undefined);
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
  const detail = inventory?.services.find((service) => service.id === detailId);
  const endpoints = (service: Service) =>
    service.endpoints
      .map(
        (e) =>
          `${e.address.includes(":") ? `[${e.address}]` : e.address}:${e.port}`,
      )
      .join(", ");
  return (
    <section aria-labelledby="services-heading" className="desktop-card">
      <h2 id="services-heading">
        {view === "history"
          ? "Local action history"
          : view === "control"
            ? "Local shutdown permissions"
            : view === "projects"
              ? "Project associations"
              : "Development services"}
      </h2>
      {!enabled ? (
        <Unavailable>
          Pair this computer and enable Developer Tools locally and in your
          workspace to inspect services.
        </Unavailable>
      ) : (
        <>
          <p>
            Local TCP listeners owned by your user. Full paths and command
            arguments stay on this computer. Remote service access requires
            separate consent in Sharing.
          </p>
          {view === "history" ? (
            <button disabled={busy} onClick={() => void loadHistory()}>
              Load action history
            </button>
          ) : view === "control" ? (
            <button disabled={busy} onClick={() => void refresh()}>
              Refresh control status
            </button>
          ) : (
            <form
              className="desktop-search"
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
              <label className="desktop-filter">
                Filter this page
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">All listeners</option>
                  <option value="controllable">Controllable services</option>
                </select>
              </label>
            </form>
          )}
          {message && (
            <p role="status" aria-live="polite" className="desktop-notice">
              {message}
            </p>
          )}
          {view === "control" && (
            <>
              <p>
                This permission allows only separately confirmed local actions
                on supported processes owned by your user. It does not grant
                mobile or remote access.
              </p>
              {inventory ? (
                <label className="desktop-setting-row">
                  <span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={inventory.localControlAllowed}
                      disabled={busy || !inventory.platformSupported}
                      onChange={(event) => void control(event.target.checked)}
                    />
                    Allow local service shutdown
                  </span>
                </label>
              ) : (
                <p className="desktop-empty">
                  Refresh control status to read the current setting.
                </p>
              )}
              {inventory && !inventory.platformSupported && (
                <p>Local shutdown is unavailable on this platform.</p>
              )}
              <p>
                Graceful stop and force stop require independent confirmations.
                Force stop can discard unfinished work.
              </p>
              <a className="desktop-button secondary" href="#services">
                Review services
              </a>
            </>
          )}
          {(view === "inventory" || view === "projects") && (
            <>
              {!inventory && (
                <p className="desktop-empty">
                  No service inventory loaded. Refresh services to inspect
                  current observations.
                </p>
              )}
              {inventory && (
                <>
                  <p>
                    {inventory.total} matching services · observed{" "}
                    {inventory.observedAt}.{" "}
                    {expired
                      ? "Observation expired — refresh before changing or stopping services."
                      : "Observation is fresh."}
                  </p>
                  {!inventory.platformSupported && (
                    <p>
                      Developer discovery and control are unavailable on this
                      platform.
                    </p>
                  )}
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
                  {inventory.platformSupported && (
                    <>
                      {!visible.length && (
                        <p className="desktop-empty">
                          No matching services on this page. Try another search
                          or page.
                        </p>
                      )}
                      {view === "inventory" &&
                        !detail &&
                        visible.length > 0 && (
                          <div
                            className="desktop-table-scroll"
                            role="region"
                            aria-label="Service inventory"
                            tabIndex={0}
                          >
                            <table className="desktop-service-table">
                              <thead>
                                <tr>
                                  <th>Project / runtime</th>
                                  <th>Process</th>
                                  <th>Listening on</th>
                                  <th>Observation</th>
                                  <th>Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {visible.map((service) => (
                                  <tr key={service.id}>
                                    <td>
                                      <strong>{service.project.name}</strong>
                                      <span>
                                        {service.runtime === "unknown"
                                          ? service.executable
                                          : service.runtime}{" "}
                                        ·{" "}
                                        {service.project.confidence.replaceAll(
                                          "_",
                                          " ",
                                        )}
                                      </span>
                                    </td>
                                    <td>PID {service.pid}</td>
                                    <td>
                                      <code>{endpoints(service)}</code>
                                      {service.additionalEndpoints > 0 && (
                                        <span>
                                          + {service.additionalEndpoints} more
                                          listeners
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <span className="desktop-state">
                                        {expired ? "Expired" : "Fresh"}
                                      </span>
                                    </td>
                                    <td>
                                      <button
                                        className="secondary"
                                        disabled={busy}
                                        onClick={() => setDetailId(service.id)}
                                      >
                                        Review service
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      {view === "inventory" && detail && (
                        <article className="desktop-service-detail">
                          <button
                            className="secondary"
                            onClick={() => setDetailId(undefined)}
                          >
                            Back to inventory
                          </button>
                          <h3 ref={detailHeading} tabIndex={-1}>
                            {detail.project.name} · PID {detail.pid}
                          </h3>
                          <p>
                            {detail.runtime === "unknown"
                              ? detail.executable
                              : detail.runtime}{" "}
                            · Parent PID {detail.parentPid} · Started{" "}
                            {detail.startedAt} · Running{" "}
                            {Math.floor(detail.uptimeSeconds / 60)} min ·{" "}
                            {detail.childCount} child processes
                          </p>
                          <p>
                            <code>{endpoints(detail)}</code>
                            {detail.additionalEndpoints > 0 &&
                              ` and ${detail.additionalEndpoints} more listeners`}
                          </p>
                          <p>
                            {detail.project.evidence} ·{" "}
                            {detail.project.confidence.replaceAll("_", " ")}
                          </p>
                          {!detail.canStop && (
                            <p>
                              {detail.blockReason
                                .replaceAll("_", " ")
                                .toLowerCase()}
                            </p>
                          )}
                          <p>
                            Local shutdown:{" "}
                            {inventory.localControlAllowed
                              ? "enabled"
                              : "disabled"}
                            . Service actions require fresh observations and
                            current authorization.
                          </p>
                          <a
                            className="desktop-button secondary"
                            href="#control"
                          >
                            Review local shutdown permissions
                          </a>
                          <div className="desktop-actions">
                            <button
                              disabled={
                                busy ||
                                expired ||
                                !detail.canStop ||
                                !inventory.localControlAllowed
                              }
                              onClick={() => {
                                setChildren(false);
                                setSelected({
                                  service: detail,
                                  mode: "graceful",
                                });
                              }}
                            >
                              Stop gracefully
                            </button>
                            <button
                              className="border-danger-line bg-danger-surface text-danger"
                              disabled={
                                busy ||
                                expired ||
                                !detail.canStop ||
                                !inventory.localControlAllowed
                              }
                              onClick={() => {
                                setChildren(false);
                                setSelected({ service: detail, mode: "force" });
                              }}
                            >
                              Force stop…
                            </button>
                          </div>
                          <a
                            className="desktop-button secondary"
                            href="#history"
                          >
                            Review action history
                          </a>
                        </article>
                      )}
                      {view === "projects" &&
                        [...groups.entries()].map(([id, services]) => (
                          <article className="desktop-service-detail" key={id}>
                            <h3>{services[0].project.name}</h3>
                            <p>
                              {services[0].project.evidence} ·{" "}
                              {services[0].project.confidence.replaceAll(
                                "_",
                                " ",
                              )}
                            </p>
                            {services.map((service) => (
                              <div
                                className="desktop-project-service"
                                key={service.id}
                              >
                                <h4>
                                  {service.runtime === "unknown"
                                    ? service.executable
                                    : service.runtime}{" "}
                                  · PID {service.pid}
                                </h4>
                                <p>
                                  <code>{endpoints(service)}</code>
                                </p>
                                <ProjectForm
                                  service={service}
                                  disabled={busy || expired}
                                  save={(label) =>
                                    void associate(service, label)
                                  }
                                />
                              </div>
                            ))}
                          </article>
                        ))}
                      {!detail && (
                        <div className="desktop-actions">
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
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
          {view === "history" && (
            <>
              <p>
                Up to 100 actions within seven days, 25 per page. A sent signal
                is not a confirmed shutdown.
              </p>
              {!historyLoaded && (
                <p className="desktop-empty">No action history loaded.</p>
              )}
              {historyLoaded && (
                <>
                  <ol className="desktop-action-history">
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
                  {!history.length && (
                    <p className="desktop-empty">
                      No action receipts on this page.
                    </p>
                  )}
                  <div className="desktop-actions">
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
                      disabled={
                        busy || history.length < 25 || historyOffset >= 75
                      }
                      onClick={() => void loadHistory(historyOffset + 25)}
                    >
                      Next history page
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
      <dialog
        className="m-auto max-h-[calc(100dvh_-_40px)] max-w-[min(600px,calc(100vw_-_40px))] overflow-y-auto break-words rounded-[14px] border border-line bg-surface p-7 text-foreground backdrop:bg-[#20152a99]"
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
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                className={
                  selected.mode === "force"
                    ? "border-danger-line bg-danger-surface text-danger"
                    : ""
                }
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
                className="bg-surface text-primary"
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
      className="my-4 flex flex-wrap items-end gap-3 [&_label]:min-w-[200px] [&_label]:flex-1"
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
      <button className="bg-surface text-primary" disabled={disabled}>
        Save association
      </button>
      {service.project.source === "manual" && (
        <button
          className="bg-surface text-primary"
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
