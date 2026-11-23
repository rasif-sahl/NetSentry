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
  NavigationIcon,
  sectionPage,
  SectionLinks,
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
  const section = sectionPage(page);
  const group = navigation.find((group) =>
    group.pages.some((child) => child.id === section),
  )!;
  const destination = group.pages.find((child) => child.id === section)!;
  const reviewingService = page === "service-review";
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
  function refreshAgent() {
    void perform(() => window.netsentry?.getAgentStatus());
    if (page === "status") void refreshBackground();
  }

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
                <NavigationIcon name="developer" />
                <span>Local Agent</span>
                <strong>{status ? "Connected" : "Unavailable"}</strong>
                <p>
                  {status
                    ? `Backend ${status.connection}`
                    : "No verified local status available."}
                </p>
              </div>
              <div className="desktop-metric">
                <NavigationIcon name="pairing" />
                <span>Pairing</span>
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
                <NavigationIcon name="background" />
                <span>Background Service</span>
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
            <PageCard title="Computer setup">
              <div className="desktop-setup-row">
                <NavigationIcon name="pairing" />
                <div>
                  <strong>Pairing &amp; identity</strong>
                  <p>Review this installation and its workspace pairing.</p>
                </div>
                <a className="desktop-button secondary" href="#pairing">View pairing</a>
              </div>
              <div className="desktop-setup-row">
                <NavigationIcon name="settings" />
                <div>
                  <strong>Module preferences</strong>
                  <p>Developer Tools and Network Monitoring.</p>
                </div>
                <a className="desktop-button secondary" href="#modules">View modules</a>
              </div>
            </PageCard>
            <PageCard title="Reported configuration">
              <div className="desktop-status-row">
                <span>Agent version</span>
                <span className="desktop-state">{status?.version || "Unavailable"}</span>
              </div>
              {(["developer", "network"] as const).map((module) => (
                <div className="desktop-status-row" key={module}>
                  <span>{module === "developer" ? "Developer Tools" : "Network Monitoring"}</span>
                  <span className="desktop-state">
                    {status
                      ? status.effective[module] ? "Enabled by configuration" : "Not enabled"
                      : "Not checked"}
                  </span>
                </div>
              ))}
            </PageCard>
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
      case "service-review":
      case "projects":
      case "control":
      case "history":
        return (
          <Services
            enabled={developer}
            installationId={status?.installationId || ""}
            view={page === "services" || page === "service-review" ? "inventory" : page}
            review={reviewingService}
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
      <Sidebar page={section} />
      <main
        className="desktop-main"
        id="desktop-content"
        tabIndex={-1}
        ref={content}
      >
        <header className="desktop-topbar">
          <strong className="desktop-computer">
            <NavigationIcon name="developer" />
            This computer
          </strong>
          <div className="desktop-topbar-actions">
            <span className="desktop-connection" data-connected={Boolean(status)}>
              <span aria-hidden="true">●</span>{" "}
              {status ? "Agent connected" : busy ? "Checking agent" : "Agent unavailable"}
            </span>
            {page !== "status" && (
              <button
                type="button"
                className="desktop-theme-button desktop-icon-button"
                aria-label="Refresh agent status"
                title="Refresh agent status"
                disabled={busy}
                onClick={refreshAgent}
              >
                <NavigationIcon name="refresh" />
              </button>
            )}
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
          </div>
        </header>
        <div className="desktop-page-heading">
          <div>
            <h1 ref={heading} tabIndex={-1}>
              {reviewingService ? "Service details" : destination.label}
            </h1>
            <p>{reviewingService ? "Review a captured local service observation." : destination.description}</p>
          </div>
          {page === "status" && (
            <button type="button" className="secondary desktop-icon-button" disabled={busy} onClick={refreshAgent}>
              <NavigationIcon name="refresh" /> Refresh agent status
            </button>
          )}
        </div>
        <p role="status" className={status ? "sr-only" : "desktop-notice"}>{message}</p>
        {page !== "status" && !reviewingService && <SectionLinks page={section} />}
        <div className="desktop-page-content" key={`${section}:${scope}`}>
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
