"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  Activity,
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
import { AlertsPanel } from "./alerts-panel";
import { DevicesPanel } from "./devices-panel";
import { NetworksPanel } from "./networks-panel";
import { ReportsPanel } from "./reports-panel";
import { api, signOut } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Device, Permissions, User, Workspace } from "@/lib/types";
import { AuthPanel, type AuthMode } from "../account/auth-panel";
import {
  ActionButton,
  Card,
  Empty,
  ErrorNotice,
  Loading,
  Notice,
  formatTime,
} from "../ui/common";
const navigation = [
  { label: "Overview", icon: Home },
  { label: "Devices", icon: Smartphone },
  { label: "Usage & reports", icon: Gauge },
  { label: "Alerts", icon: Bell },
  { label: "Networks", icon: Network },
  { label: "Team", icon: Users },
  { label: "Settings & privacy", icon: Settings },
  { label: "More modules", icon: Laptop },
];
export function DashboardShell({ initialMode }: { initialMode?: AuthMode }) {
  const router = useRouter();
  const [session, setSession] = useState<{
    user?: User;
    ready: boolean;
    error?: unknown;
    notice?: string;
  }>({ ready: false });
  useEffect(() => {
    if (initialMode) return;
    let active = true;
    api<User>("/auth/me")
      .then((user) => {
        if (active) setSession({ ready: true, user });
      })
      .catch((error) => {
        if (active) setSession({ ready: true, error });
      });
    return () => {
      active = false;
    };
  }, [initialMode]);
  useEffect(() => {
    const expired = () =>
      setSession({
        ready: true,
        notice: "Your session ended. Sign in again to continue.",
      });
    window.addEventListener("netsentry:expired", expired);
    return () => window.removeEventListener("netsentry:expired", expired);
  }, []);
  if (initialMode || (session.ready && !session.user))
    return (
      <AuthPanel
        initialMode={initialMode}
        onSignedIn={(user) => {
          if (initialMode) router.push("/");
          else setSession({ ready: true, user });
        }}
        notice={
          session.notice ??
          (session.error instanceof Error &&
          !("status" in session.error && session.error.status === 401)
            ? session.error.message
            : undefined)
        }
      />
    );
  if (!session.user)
    return (
      <main className="boot">
        <Link className="brand" href="/">
          ◈ NetSentry
        </Link>
        <Loading />
      </main>
    );
  return (
    <WorkspaceShell
      key={session.user.id}
      user={session.user}
      updateUser={(user) => setSession({ ready: true, user })}
      accountDeleted={() =>
        setSession({ ready: true, notice: "Your account has been deleted." })
      }
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
export type PageContext = {
  user: User;
  workspace: Workspace;
  permissions: string[];
  devices: Device[];
  reloadDevices: () => void;
  updateUser: (user: User) => void;
  accountDeleted: () => void;
};
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
  const [section, setSection] = useState("Overview");
  const [menu, setMenu] = useState(false);
  const workspace =
    workspaces.data?.find(
      (w) => w.id === (selected ?? user.preferences.activeWorkspaceId),
    ) ?? workspaces.data?.[0];
  const permission = useResource<Permissions>(
    workspace ? `/workspaces/${workspace.id}/permissions` : null,
    true,
  );
  const devices = useResource<Device[]>(
    workspace ? `/workspaces/${workspace.id}/devices` : null,
    true,
  );
  const context =
    workspace && permission.data && devices.data
      ? {
          user,
          workspace,
          permissions: permission.data.permissions,
          devices: devices.data,
          reloadDevices: devices.reload,
          updateUser,
          accountDeleted,
        }
      : undefined;
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
  const future = [
    "Family",
    "Policies",
    "Organizations",
    "Locations",
    "Audit",
    "Subscription",
    "Developer Tools",
  ];
  function choose(label: string) {
    setSection(label);
    setMenu(false);
    window.scrollTo({ top: 0 });
  }
  return (
    <div className="workspace-layout">
      <a className="skip-link" href="#dashboard-content">
        Skip to content
      </a>
      <aside
        ref={sideRef}
        className={`sidebar ${menu ? "open" : ""}`}
        aria-label="Workspace navigation"
      >
        <div className="sidebar-brand">
          <Link href="/" className="brand">
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
                  updateUser({
                    ...user,
                    preferences: { ...user.preferences, activeWorkspaceId: id },
                  });
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
        <main id="dashboard-content" tabIndex={-1} className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {workspace
                  ? `${workspace.type} / ${permission.data?.role ?? workspace.role}`
                  : "NETSENTRY"}
              </p>
              <h1>{section}</h1>
              <p>
                {section === "Overview"
                  ? "Your devices and the information they report, in one place."
                  : "Manage your workspace with verified permissions and available data."}
              </p>
            </div>
            <button
              className="button"
              onClick={() => {
                workspaces.reload();
                permission.reload();
                devices.reload();
              }}
            >
              Refresh workspace
            </button>
          </div>
          {!user.emailVerifiedAt && (
            <Notice>
              Verify your email to manage workspace access and monitoring.{" "}
              <ActionButton
                action={async () => {
                  await api("/auth/verification/request", "POST", {});
                }}
              >
                Request verification email
              </ActionButton>{" "}
              <button
                className="text-button"
                onClick={async () => updateUser(await api<User>("/auth/me"))}
              >
                I have verified my email
              </button>
            </Notice>
          )}
          <ErrorNotice
            error={
              selectionError ??
              workspaces.error ??
              permission.error ??
              devices.error
            }
          />
          {(workspaces.loading || permission.loading || devices.loading) && (
            <Loading />
          )}
          {context ? (
            <div key={workspace!.id} className="page-stack">
              {section === "Overview" && (
                <>
                  <div className="metric-grid">
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
                    <button
                      className="text-button"
                      onClick={() => choose("Devices")}
                    >
                      View device details →
                    </button>
                  </Card>
                  <Card title="Monitoring availability">
                    <p>
                      Usage appears when an authorized, supported collector
                      uploads observations. Network discovery, threat detection
                      and desktop service control arrive in later phases.
                    </p>
                    <div className="button-row">
                      <button
                        className="button"
                        onClick={() => choose("Usage & reports")}
                      >
                        <Activity size={16} /> Explore reports
                      </button>
                      <button
                        className="button"
                        onClick={() => choose("Alerts")}
                      >
                        Manage alerts
                      </button>
                    </div>
                  </Card>
                </>
              )}
              {section !== "Overview" && section !== "More modules" && (
                <ConnectedSection
                  section={section}
                  context={context}
                  workspacesChanged={workspaces.reload}
                  signedOut={onSignOut}
                />
              )}
              {section === "More modules" && (
                <>
                  <Notice>
                    These modules are planned. No monitoring, blocking, billing
                    or remote service control is active here.
                  </Notice>
                  <div className="module-grid">
                    {future.map((label) => (
                      <Card key={label} title={label}>
                        <span className="badge">Planned</span>
                        <p>
                          {
                            {
                              Family:
                                "Profiles and supported digital wellbeing controls.",
                              Policies:
                                "Rules and supported device enforcement.",
                              Organizations:
                                "Business structure and organization management.",
                              Locations:
                                "Site-level organization and network views.",
                              Audit: "Full workspace action history.",
                              Subscription:
                                "Editions, entitlements and billing.",
                              "Developer Tools":
                                "Paired computer services, project association and authorized stop actions.",
                            }[label]
                          }
                        </p>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            !workspaces.loading &&
            !workspaces.error &&
            !workspace && (
              <Empty title="No workspace available">
                Create or join a workspace after verifying your email.
              </Empty>
            )
          )}
        </main>
      </div>
    </div>
  );
}
function ConnectedSection({
  section,
  context,
}: {
  section: string;
  context: PageContext;
  workspacesChanged: () => void;
  signedOut: () => Promise<void>;
}) {
  if (section === "Devices") return <DevicesPanel {...context} />;
  if (section === "Usage & reports") return <ReportsPanel {...context} />;
  if (section === "Networks") return <NetworksPanel {...context} />;
  if (section === "Alerts") return <AlertsPanel {...context} />;
  return (
    <Card title={section}>
      <Empty title="This section is being connected">
        The account and monitoring views are available.
      </Empty>
    </Card>
  );
}
