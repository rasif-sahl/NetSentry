import { Diagnostics } from "./Diagnostics";
import { BackgroundService } from "./BackgroundService";
import { Updates } from "./Updates";
import { Appearance, useAppearance } from "./Appearance";
import { NetworkSharing } from "./NetworkSharing";
import { RemoteSharing } from "./RemoteSharing";
import { Services } from "./Services";
import {
  currentPage,
  navigation,
  PageCard,
  Sidebar,
  Unavailable,
} from "./Navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentResult, AgentStatus } from "../main/agent-types";
import type { BackgroundView } from "../main/background-service";

export function App() {
  const [page, setPage] = useState(currentPage);
  const [status, setStatus] = useState<AgentStatus>();
  const [background, setBackground] = useState<BackgroundView>();
  const [message, setMessage] = useState("Checking the local agent…");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const backgroundGeneration = useRef(0);
  const previousPage = useRef(page);
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLElement>(null);
  const { theme, setTheme } = useAppearance();
  const group = navigation.find((group) =>
    group.pages.some((child) => child.id === page),
  )!;
  const destination = group.pages.find((child) => child.id === page)!;
  const perform = useCallback(
    async (action: () => Promise<AgentResult> | undefined) => {
      const epoch = ++generation.current;
      setBusy(true);
      try {
        const result = await action();
        if (epoch !== generation.current) return;
        if (result?.ok) {
          setStatus(result.status);
          setMessage("Local agent connected.");
        } else {
          setStatus(undefined);
          setMessage(
            result?.code === "PAIRING_FAILED"
              ? "Pairing failed. Check the code and backend connection."
              : "Agent unavailable. Initialize and run the local agent, then retry.",
          );
        }
      } catch {
        if (epoch === generation.current) {
          setStatus(undefined);
          setMessage("Could not contact the local agent.");
        }
      } finally {
        if (epoch === generation.current) setBusy(false);
      }
    },
    [],
  );
  const refreshBackground = useCallback(async () => {
    const epoch = ++backgroundGeneration.current;
    try {
      const next = await window.netsentry?.backgroundService?.("status");
      if (epoch === backgroundGeneration.current)
        setBackground(next?.verified ? next : undefined);
    } catch {
      if (epoch === backgroundGeneration.current) setBackground(undefined);
    }
  }, []);
  useEffect(() => {
    const change = () => setPage(currentPage());
    window.addEventListener("hashchange", change);
    void perform(() => window.netsentry?.getAgentStatus());
    return () => {
      window.removeEventListener("hashchange", change);
      generation.current++;
      backgroundGeneration.current++;
    };
  }, [perform]);
  useEffect(() => {
    setCode("");
    if (previousPage.current !== page) {
      previousPage.current = page;
      heading.current?.focus();
      window.scrollTo({ top: 0 });
    }
    if (page === "status") void refreshBackground();
  }, [page, refreshBackground]);
  const scope = `${status?.installationId || "unavailable"}:${status?.paired}:${status?.connection}:${status?.requested.developer}:${status?.requested.network}`;
  const developer = Boolean(status?.paired && status.requested.developer);
  function modulePreferences() {
    return status ? (
      <PageCard title="Local module preferences">
        <p>
          Local choices and current workspace authorization are both required.
          Native platform support and sharing consent are checked separately.
        </p>
        {(["network", "developer"] as const).map((module) => (
          <div className="desktop-setting-row" key={module}>
            <label>
              <input
                type="checkbox"
                role="switch"
                checked={status.requested[module]}
                disabled={busy}
                onChange={(event) =>
                  void perform(() =>
                    window.netsentry?.setAgentModules({
                      ...status.requested,
                      [module]: event.target.checked,
                    }),
                  )
                }
              />
              {module === "network" ? "Network Monitoring" : "Developer Tools"}
            </label>
            <span className="desktop-state">
              Workspace{" "}
              {status.authorized[module] ? "authorized" : "not authorized"}
            </span>
          </div>
        ))}
        <p>
          Remote access is configured in Sharing. Revoking pairing or erasing
          agent data is managed from workspace settings.
        </p>
        <a className="desktop-button secondary" href="#remote">
          Review sharing settings
        </a>
      </PageCard>
    ) : (
      <Unavailable>
        Connect the local agent before inspecting or changing module
        preferences.
      </Unavailable>
    );
  }
  function renderPage() {
    switch (page) {
      case "status":
        return (
          <>
            <div className="desktop-metrics">
              <div className="desktop-metric">
                <span>LOCAL AGENT</span>
                <strong>{status ? "Connected" : "Unavailable"}</strong>
                <p>
                  {status
                    ? `Backend ${status.connection}`
                    : "No verified local status available."}
                </p>
              </div>
              <div className="desktop-metric">
                <span>PAIRING</span>
                <strong>
                  {status
                    ? status.paired
                      ? "Paired"
                      : "Not paired"
                    : "Not checked"}
                </strong>
                <p>Pairing identifies this installation.</p>
              </div>
              <div className="desktop-metric">
                <span>BACKGROUND SERVICE</span>
                <strong>
                  {background
                    ? background.registered
                      ? "Registered"
                      : "Not registered"
                    : "Not checked"}
                </strong>
                <p>Registration is separate from consent.</p>
              </div>
            </div>
            <div className="desktop-two-column">
              <PageCard title="Computer overview">
                <p>
                  Only reported state appears here. This page does not start a
                  scan or enable monitoring.
                </p>
                <div className="desktop-status-row">
                  <span>Agent version</span>
                  <span className="desktop-state">
                    {status?.version || "Unavailable"}
                  </span>
                </div>
                <div className="desktop-status-row">
                  <span>Backend connection</span>
                  <span className="desktop-state">
                    {status?.connection || "Not checked"}
                  </span>
                </div>
                {(["developer", "network"] as const).map((module) => (
                  <div className="desktop-status-row" key={module}>
                    <span>
                      {module === "developer"
                        ? "Developer Tools"
                        : "Network Monitoring"}
                    </span>
                    <span className="desktop-state">
                      {status
                        ? status.effective[module]
                          ? "Enabled by configuration"
                          : "Not enabled"
                        : "Not checked"}
                    </span>
                  </div>
                ))}
                <div className="desktop-actions">
                  <a className="desktop-button secondary" href="#pairing">
                    Review pairing
                  </a>
                  <a className="desktop-button secondary" href="#modules">
                    Module preferences
                  </a>
                </div>
              </PageCard>
              <PageCard title="Quick access">
                <p>Go directly to a focused workspace.</p>
                <div className="desktop-shortcuts">
                  {["services", "remote", "background", "diagnostics"].map(
                    (id) => {
                      const link = navigation
                        .flatMap((group) => [...group.pages])
                        .find((item) => item.id === id)!;
                      return (
                        <a key={id} href={`#${id}`}>
                          {link.label}
                          <span aria-hidden="true">›</span>
                        </a>
                      );
                    },
                  )}
                </div>
              </PageCard>
            </div>
          </>
        );
      case "pairing":
        return status ? (
          <PageCard title="Agent identity">
            <div className="desktop-status-row">
              <span>Installation</span>
              <code>{status.installationId}</code>
            </div>
            <div className="desktop-status-row">
              <span>Version / platform</span>
              <span>
                {status.version} · {status.platform}
              </span>
            </div>
            <p>
              Backend {status.connection} · Buffered diagnostics:{" "}
              {status.bufferedEvents} · Dropped: {status.droppedEvents}
            </p>
            {status.lastContact && (
              <p>Last backend contact: {status.lastContact}</p>
            )}
            {!status.paired ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const token = code;
                  setCode("");
                  void perform(() => window.netsentry?.pairAgent(token));
                }}
              >
                <label>
                  Single-use workspace enrolment code
                  <input
                    type="password"
                    autoComplete="off"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    maxLength={43}
                    required
                  />
                </label>
                <p>
                  Create a code for this installation in your workspace. Pairing
                  does not authorize monitoring or server control.
                </p>
                <button disabled={busy || !/^[A-Za-z0-9_-]{43}$/.test(code)}>
                  Pair computer
                </button>
              </form>
            ) : (
              <p>
                This installation is paired. Module preferences and sharing
                consent remain separate.
              </p>
            )}
          </PageCard>
        ) : (
          <Unavailable>
            Initialize and run the local agent, then refresh its status to
            inspect this installation and pair it.
          </Unavailable>
        );
      case "modules":
        return modulePreferences();
      case "services":
      case "projects":
      case "control":
      case "history":
        return (
          <Services
            enabled={developer}
            installationId={status?.installationId || ""}
            view={page === "services" ? "inventory" : page}
          />
        );
      case "remote":
        return developer ? (
          <RemoteSharing enabled />
        ) : (
          <Unavailable>
            Pair this computer and enable Developer Tools before reviewing
            remote sharing consent.
          </Unavailable>
        );
      case "network":
        return status?.paired && status.requested.network ? (
          <NetworkSharing enabled />
        ) : (
          <Unavailable>
            Pair this computer and enable Network Monitoring before configuring
            named-network sharing.
          </Unavailable>
        );
      case "background":
        return <BackgroundService refreshKey={scope} view="status" />;
      case "login":
        return (
          <>
            <PageCard title="Local background preference">
              <p>
                This preference does not register a service or grant
                monitoring/shutdown authority.
              </p>
              {status ? (
                <>
                  <label>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={status.backgroundRequested}
                      disabled={busy}
                      onChange={(event) =>
                        void perform(() =>
                          window.netsentry?.setAgentBackground(
                            event.target.checked,
                          ),
                        )
                      }
                    />
                    Allow background operation locally
                  </label>
                  <p>
                    Workspace background authorization:{" "}
                    {status.backgroundAllowed ? "allowed" : "not active"}.
                    Turning this off also removes an owned registration.
                  </p>
                </>
              ) : (
                <p>Connect the local agent to inspect this preference.</p>
              )}
            </PageCard>
            <BackgroundService
              refreshKey={`${scope}:${status?.backgroundRequested}`}
              view="login"
            />
          </>
        );
      case "appearance":
        return <Appearance theme={theme} setTheme={setTheme} />;
      case "updates":
        return <Updates />;
      case "diagnostics":
        return <Diagnostics />;
    }
  }
  return (
    <div className="desktop-shell">
      <a
        className="desktop-skip"
        href="#desktop-content"
        onClick={(event) => {
          event.preventDefault();
          content.current?.focus();
        }}
      >
        Skip to content
      </a>
      <Sidebar page={page} connected={Boolean(status)} />
      <main
        className="desktop-main"
        id="desktop-content"
        tabIndex={-1}
        ref={content}
      >
        <header className="desktop-topbar">
          <nav aria-label="Breadcrumb">
            Desktop <span aria-hidden="true">/</span> {group.label}{" "}
            <span aria-hidden="true">/</span>{" "}
            <span aria-current="page">{destination.label}</span>
          </nav>
          <button
            className="desktop-theme-button"
            onClick={() =>
              setTheme(
                document.documentElement.dataset.theme === "dark"
                  ? "LIGHT"
                  : "DARK",
              )
            }
            aria-label="Toggle appearance"
          >
            ◐
          </button>
        </header>
        <div className="desktop-page-heading">
          <div>
            <p className="desktop-kicker">{group.label}</p>
            <h1 ref={heading} tabIndex={-1}>
              {destination.label}
            </h1>
            <p>{destination.description}</p>
          </div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              void perform(() => window.netsentry?.getAgentStatus());
              if (page === "status") void refreshBackground();
            }}
          >
            Refresh agent status
          </button>
        </div>
        <p role="status" className="desktop-notice">
          {message}
        </p>
        <div className="desktop-page-content" key={`${page}:${scope}`}>
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
