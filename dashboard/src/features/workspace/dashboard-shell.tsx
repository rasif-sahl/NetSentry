"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import {
  ArrowRight,
  Bell,
  ChevronRight,
  Gauge,
  Home,
  Laptop,
  Menu,
  Network,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import {
  api,
  signOut,
  announceSession,
  adoptActor,
  listenForSessionChanges,
} from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { Device, Permissions, User, Workspace } from "@/shared/types";
import type { PageContext } from "./types";
import { AuthPanel } from "@/features/account/auth-panel";
import {
  ActionButton,
  Card,
  Empty,
  ErrorNotice,
  Loading,
  formatTime,
} from "@/shared/ui/common";
import { PageLoading } from "@/shared/ui/loading";
import { EmailVerificationStripe } from "./email-verification-stripe";
const BillingPanel = dynamic(
  () =>
    import("@/features/billing/billing-panel").then(
      (module) => module.BillingPanel,
    ),
  { loading: Loading },
);
const OperationsPanel = dynamic(
  () =>
    import("@/features/operations/operations-panel").then(
      (module) => module.OperationsPanel,
    ),
  { loading: Loading },
);
const BusinessPanel = dynamic(
  () =>
    import("@/features/business/business-panel").then(
      (module) => module.BusinessPanel,
    ),
  { loading: Loading },
);
const FamilyPanel = dynamic(
  () =>
    import("@/features/family/family-panel").then(
      (module) => module.FamilyPanel,
    ),
  { loading: Loading },
);
const DeveloperPanel = dynamic(
  () =>
    import("@/features/developer/developer-panel").then(
      (module) => module.DeveloperPanel,
    ),
  { loading: Loading },
);
const SettingsPanel = dynamic(
  () =>
    import("@/features/settings/settings-panel").then(
      (module) => module.SettingsPanel,
    ),
  { loading: Loading },
);
const TeamPanel = dynamic(
  () => import("@/features/team/team-panel").then((module) => module.TeamPanel),
  { loading: Loading },
);
const AlertsPanel = dynamic(
  () =>
    import("@/features/alerts/alerts-panel").then(
      (module) => module.AlertsPanel,
    ),
  { loading: Loading },
);
const DevicesPanel = dynamic(
  () =>
    import("@/features/devices/devices-panel").then(
      (module) => module.DevicesPanel,
    ),
  { loading: Loading },
);
const NetworksPanel = dynamic(
  () =>
    import("@/features/networks/networks-panel").then(
      (module) => module.NetworksPanel,
    ),
  { loading: Loading },
);
const ReportsPanel = dynamic(
  () =>
    import("@/features/reports/reports-panel").then(
      (module) => module.ReportsPanel,
    ),
  { loading: Loading },
);

const navigation = [
  { label: "Overview", icon: Home },
  { label: "Devices", icon: Smartphone },
  { label: "Usage & reports", icon: Gauge },
  { label: "Alerts", icon: Bell },
  { label: "Networks", icon: Network },
  { label: "Developer Tools", icon: Laptop },
  { label: "Family", icon: Users },
  { label: "Business", icon: Users },
  { label: "Subscription", icon: Settings },
  { label: "Operations", icon: ShieldCheck },
  { label: "Team", icon: Users },
  { label: "Settings & privacy", icon: Settings },
  { label: "More modules", icon: Laptop },
] as const;
type Section = (typeof navigation)[number]["label"];

const deviceSections: ReadonlySet<Section> = new Set([
  "Overview",
  "Devices",
  "Usage & reports",
  "Alerts",
  "Networks",
  "Family",
]);

function sectionFromUrl(): Section {
  if (typeof window === "undefined") return "Overview";
  const view = new URLSearchParams(window.location.search).get("view");
  return navigation.find(({ label }) => label === view)?.label ?? "Overview";
}
export function DashboardShell() {
  const [session, setSession] = useState<{
    user?: User;
    ready: boolean;
    error?: unknown;
    notice?: string;
  }>({ ready: false });
  useEffect(() => {
    let active = true;
    api<User>("/auth/me")
      .then((user) => {
        if (active) {
          adoptActor(user.id);
          setSession({ ready: true, user });
        }
      })
      .catch((error) => {
        if (active) setSession({ ready: true, error });
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const expired = () =>
      setSession({
        ready: true,
        notice: "Your session ended. Sign in again to continue.",
      });
    window.addEventListener("netsentry:expired", expired);
    return () => window.removeEventListener("netsentry:expired", expired);
  }, []);
  useEffect(() => {
    return listenForSessionChanges((type) => {
      if (type === "ended") {
        adoptActor(undefined);
        setSession({ ready: true, notice: "You signed out in another tab." });
      }
      // A full document refresh clears every in-flight user/workspace response on identity changes.
      if (type === "changed") window.location.reload();
    });
  }, []);
  if (session.ready && !session.user)
    return (
      <AuthPanel
        onSignedIn={(user) => setSession({ ready: true, user })}
        notice={
          session.notice ??
          (session.error instanceof Error &&
          !("status" in session.error && session.error.status === 401)
            ? session.error.message
            : undefined)
        }
      />
    );
  if (!session.user) return <PageLoading />;
  return (
    <WorkspaceShell
      key={session.user.id}
      user={session.user}
      updateUser={(user) =>
        setSession((current) =>
          current.user?.id === user.id ? { ready: true, user } : current,
        )
      }
      accountDeleted={() => {
        announceSession("ended");
        setSession({ ready: true, notice: "Your account has been deleted." });
      }}
      onSignOut={async () => {
        const revoked = await signOut();
        setSession({
          ready: true,
          notice: revoked
            ? "You have signed out."
            : "Signed out of this browser. The server session could not be revoked; review your sessions after signing in.",
        });
      }}
    />
  );
}
function WorkspaceShell({
  user,
  updateUser,
  onSignOut,
  accountDeleted,
}: {
  user: User;
  updateUser: (user: User) => void;
  onSignOut: () => Promise<void>;
  accountDeleted: () => void;
}) {
  const workspaces = useResource<Workspace[]>("/workspaces", true);
  const [selectionError, setSelectionError] = useState<unknown>();
  const [switching, setSwitching] = useState(false);
  const switchPending = useRef(false);
  const [selected, setSelected] = useState<string>();
  const [section, setSection] = useState(sectionFromUrl);
  const [menu, setMenu] = useState(false);
  const workspace =
    workspaces.data?.find(
      (w) => w.id === (selected ?? user.preferences.activeWorkspaceId),
    ) ?? workspaces.data?.[0];
  const permission = useResource<Permissions>(
    workspace ? `/workspaces/${workspace.id}/permissions` : null,
    true,
  );
  const needsDevices = deviceSections.has(section);
  const devices = useResource<Device[]>(
    workspace && needsDevices ? `/workspaces/${workspace.id}/devices` : null,
    true,
  );
  const needsWorkspace =
    section !== "Settings & privacy" &&
    section !== "Operations" &&
    section !== "More modules";
  const context =
    workspace && permission.data && (!needsDevices || devices.data)
      ? {
          user,
          workspace,
          permissions: permission.data.permissions,
          devices: devices.data ?? [],
          reloadDevices: devices.reload,
        }
      : undefined;
  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        user.preferences.theme === "DARK" ||
        ((user.preferences.theme ?? "SYSTEM") === "SYSTEM" && media.matches)
          ? "dark"
          : "light";
      document.documentElement.dataset.reducedMotion = String(
        !!user.preferences.reducedMotion,
      );
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      delete document.documentElement.dataset.theme;
      delete document.documentElement.dataset.reducedMotion;
    };
  }, [user.preferences.theme, user.preferences.reducedMotion]);
  useEffect(() => {
    const back = () => {
      setSection(sectionFromUrl());
      setMenu(false);
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const sideRef = useRef<HTMLElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const previous = document.body.style.overflow;
    const trigger = openRef.current;
    document.body.style.overflow = "hidden";
    const nodes = sideRef.current?.querySelectorAll<HTMLElement>(
      "a,button:not([disabled]),select,input",
    );
    nodes?.[1]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
      if (event.key === "Tab" && nodes?.length) {
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handle);
      trigger?.focus();
    };
  }, [menu]);
  function choose(label: Section) {
    if (section !== label) {
      const url = new URL(window.location.href);
      url.pathname = "/app";
      url.searchParams.set("view", label);
      history.pushState(null, "", url.pathname + url.search + url.hash);
      setSection(label);
    }
    setMenu(false);
    requestAnimationFrame(() => contentRef.current?.focus());
    window.scrollTo({ top: 0 });
  }
  return (
    <div className="workspace-layout">
      <a className="skip-link" href="#dashboard-content">
        Skip to content
      </a>
      <aside
        role={menu ? "dialog" : undefined}
        aria-modal={menu ? true : undefined}
        ref={sideRef}
        className={`sidebar ${menu ? "open" : ""}`}
        aria-label="Workspace navigation"
      >
        <div className="sidebar-brand">
          <Link href="/app" className="brand">
            <ShieldCheck aria-hidden="true" /> NetSentry
          </Link>
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>
        <span className="eyebrow">YOUR WORKSPACE</span>
        <nav aria-label="Primary navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => choose(label)}
              aria-current={section === label ? "page" : undefined}
            >
              <Icon size={19} aria-hidden="true" />
              {label}
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="sidebar-profile">
          <span className="avatar">
            {user.displayName.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{user.displayName}</strong>
            <small>{user.email}</small>
          </div>
        </div>
        <ActionButton action={onSignOut}>Sign out</ActionButton>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="Dismiss navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace-main" inert={menu}>
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            ref={openRef}
            aria-label="Open navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <label className="workspace-select">
            <span className="sr-only">Active workspace</span>
            <select
              disabled={switching}
              aria-label="Active workspace"
              value={workspace?.id ?? ""}
              onChange={async (event) => {
                const id = event.target.value;
                if (switchPending.current) return;
                switchPending.current = true;
                setSwitching(true);
                setSelectionError(undefined);
                try {
                  await api(`/workspaces/${id}/select`, "POST", {});
                  setSelected(id);
                  updateUser(await api<User>("/auth/me"));
                } catch (error) {
                  setSelectionError(error);
                  workspaces.reload();
                } finally {
                  switchPending.current = false;
                  setSwitching(false);
                }
              }}
            >
              {workspaces.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.type.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <span className="topbar-note">
            {workspace?.timezone ?? "Workspace"}
          </span>
          <button
            className="icon-button"
            aria-label="Open notifications"
            onClick={() => choose("Alerts")}
          >
            <Bell size={20} />
          </button>
        </header>
        {!user.emailVerifiedAt && (
          <EmailVerificationStripe
            onChecked={(currentUser) => {
              updateUser(currentUser);
              if (currentUser.emailVerifiedAt)
                contentRef.current?.focus({ preventScroll: true });
            }}
          />
        )}
        <main
          ref={contentRef}
          id="dashboard-content"
          tabIndex={-1}
          className="page-content"
        >
          <div className="page-heading">
            <p className="eyebrow">
              {workspace
                ? `${workspace.type} / ${permission.data?.role ?? workspace.role}`
                : "NETSENTRY"}
            </p>
            <h1>{section}</h1>
            <button
              type="button"
              className="button"
              onClick={() => {
                window.dispatchEvent(new Event("netsentry:refresh"));
              }}
            >
              Refresh workspace
            </button>
            {section === "Overview" && (
              <p className="page-description">
                Your devices and the information they report, in one place.
              </p>
            )}
          </div>
          <ErrorNotice error={selectionError} />
          {section === "Operations" && (
            <div className="page-stack">
              <OperationsPanel />
            </div>
          )}
          {section === "Settings & privacy" && (
            <div className="page-stack" key={workspace?.id}>
              <SettingsPanel
                user={user}
                workspace={workspace}
                permissions={permission.data?.permissions}
                updateUser={updateUser}
                accountDeleted={accountDeleted}
              />
            </div>
          )}
          {needsWorkspace && (
            <ErrorNotice
              error={
                workspaces.error ??
                permission.error ??
                (needsDevices ? devices.error : undefined)
              }
            />
          )}
          {needsWorkspace &&
            (workspaces.loading ||
              permission.loading ||
              (needsDevices && devices.loading)) && <Loading />}
          {needsWorkspace && context ? (
            <div key={context.workspace.id} className="page-stack">
              {section === "Overview" && (
                <>
                  <div className="metric-grid overview-metrics">
                    <Card>
                      <span className="metric-label">Registered devices</span>
                      <strong className="metric-value">
                        {context.devices.length}
                      </strong>
                      <p>Inventory, not a live network scan</p>
                    </Card>
                    <Card>
                      <span className="metric-label">Consent enabled</span>
                      <strong className="metric-value">
                        {
                          context.devices.filter((d) => d.monitoringEnabled)
                            .length
                        }
                      </strong>
                      <p>Collection still requires supported permissions</p>
                    </Card>
                    <Card>
                      <span className="metric-label">
                        Last inventory refresh
                      </span>
                      <strong className="metric-time">
                        {formatTime(devices.updatedAt)}
                      </strong>
                      <p>Visible pages refresh every 30 seconds</p>
                    </Card>
                  </div>
                  <Card title="Your devices">
                    {!context.devices.length ? (
                      <Empty title="No registered devices yet">
                        Device pairing will be available through supported
                        native clients. No network scan is running.
                      </Empty>
                    ) : (
                      <ul className="item-list">
                        {context.devices.slice(0, 5).map((device) => (
                          <li key={device.id}>
                            <span className="list-icon">
                              <Smartphone size={21} />
                            </span>
                            <div>
                              <strong>{device.name}</strong>
                              <small>
                                {device.platform} · {device.state.toLowerCase()}{" "}
                                · last reported {formatTime(device.lastSeenAt)}
                              </small>
                            </div>
                            <span className="badge">
                              {device.permissionStatus}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="button-row align-end">
                      <button
                        type="button"
                        className="button accent"
                        onClick={() => choose("Devices")}
                      >
                        View device details
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </Card>
                  <Card title="Monitoring availability">
                    <p>
                      Usage appears when a supported collector has permission to
                      upload. Networks shows observations from approved
                      collectors. Developer Tools supports service control on
                      paired computers with an explicit grant and local consent.
                    </p>
                    <div className="button-row align-end">
                      <button
                        type="button"
                        className="button accent"
                        onClick={() => choose("Usage & reports")}
                      >
                        Explore reports
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="button accent"
                        onClick={() => choose("Alerts")}
                      >
                        Manage alerts
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </Card>
                </>
              )}
              {section !== "Overview" && (
                <ConnectedSection
                  section={section}
                  context={context}
                  workspacesChanged={workspaces.reload}
                />
              )}
            </div>
          ) : (
            needsWorkspace &&
            !workspaces.loading &&
            !workspaces.error &&
            !workspace && (
              <Empty title="No workspace available">
                Create or join a workspace after verifying your email.
              </Empty>
            )
          )}
          {section === "More modules" && (
            <div className="page-stack">
              <div className="module-grid">
                {[
                  ["Policies", "Rules and supported device enforcement."],
                  [
                    "Network Security",
                    "Advanced analysis beyond the inventory and health events in Networks.",
                  ],
                  [
                    "Insights",
                    "Digital wellbeing summaries based on authorized observations.",
                  ],
                ].map(([title, description]) => (
                  <Card key={title} title={title}>
                    <span className="badge">Planned</span>
                    <p>{description}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
function ConnectedSection({
  section,
  context,
  workspacesChanged,
}: {
  section: Section;
  context: PageContext;
  workspacesChanged: () => void;
}) {
  if (section === "Subscription") return <BillingPanel {...context} />;
  if (section === "Business") return <BusinessPanel {...context} />;
  if (section === "Family") return <FamilyPanel {...context} />;
  if (section === "Developer Tools") return <DeveloperPanel {...context} />;
  if (section === "Devices") return <DevicesPanel {...context} />;
  if (section === "Usage & reports") return <ReportsPanel {...context} />;
  if (section === "Networks") return <NetworksPanel {...context} />;
  if (section === "Alerts") return <AlertsPanel {...context} />;
  if (section === "Team")
    return (
      <TeamPanel context={context} workspacesChanged={workspacesChanged} />
    );
  return null;
}
