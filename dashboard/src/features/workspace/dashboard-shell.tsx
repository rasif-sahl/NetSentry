"use client";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import {
  isWorkspaceSlug,
  networkDetailId,
  workspaceHref,
  workspaceSections,
  workspaceTabs,
  type WorkspaceSection,
  type WorkspaceSlug,
} from "./routes";
import {
  ArrowRight,
  Bell,
  RefreshCw,
  Smartphone,
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
  Card,
  Empty,
  ErrorNotice,
  Loading,
  formatTime,
} from "@/shared/ui/common";
import { PageLoading } from "@/shared/ui/loading";
import { EmailVerificationStripe } from "./email-verification-stripe";
import { DashboardNavigation } from "./dashboard-navigation";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { WorkspaceList } from "@/features/team/workspace-list";
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

const deviceSections: ReadonlySet<WorkspaceSection> = new Set([
  "Overview",
  "Usage & reports",
  "Alerts",
  "Networks",
  "Family",
]);

export function DashboardShell({ children }: { children: ReactNode }) {
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
    >
      {children}
    </WorkspaceShell>
  );
}
function WorkspaceShell({
  children,
  user,
  updateUser,
  onSignOut,
  accountDeleted,
}: {
  children: ReactNode;
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
  const [businessLocation, setBusinessLocation] = useState<{
    workspaceId: string;
    locationId: string;
  }>();
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split("/").slice(2);
  const [slug = "", activeTab] = segments;
  const isNetworkDetail = !!networkDetailId(segments);
  const section = isWorkspaceSlug(slug) ? workspaceSections[slug] : undefined;
  const workspace =
    workspaces.data?.find(
      (w) => w.id === (selected ?? user.preferences.activeWorkspaceId),
    ) ?? workspaces.data?.[0];
  async function selectWorkspace(id: string) {
    if (switchPending.current || workspace?.id === id) return;
    switchPending.current = true;
    setSwitching(true);
    setSelectionError(undefined);
    try {
      await api(`/workspaces/${id}/select`, "POST", {});
      setSelected(id);
      setBusinessLocation(undefined);
      updateUser(await api<User>("/auth/me"));
    } catch (error) {
      setSelectionError(error);
      workspaces.reload();
    } finally {
      switchPending.current = false;
      setSwitching(false);
    }
  }
  const permission = useResource<Permissions>(
    workspace ? `/workspaces/${workspace.id}/permissions` : null,
    true,
  );
  const needsDevices = section !== undefined && deviceSections.has(section);
  const devices = useResource<Device[]>(
    workspace && needsDevices ? `/workspaces/${workspace.id}/devices` : null,
    true,
  );
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
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const frame = requestAnimationFrame(() =>
      contentRef.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  function choose(slug: WorkspaceSlug) {
    router.push(workspaceHref(slug));
  }
  return (
    <div className="min-h-dvh min-[700px]:grid min-[700px]:grid-cols-[4.5rem_minmax(0,1fr)] min-[1100px]:grid-cols-[15rem_minmax(0,1fr)]">
      <a className="skip-link" href="#dashboard-content">
        Skip to content
      </a>
      <DashboardNavigation
        active={isWorkspaceSlug(slug) ? slug : undefined}
        workspaceType={workspace?.type}
        user={user}
        onSignOut={onSignOut}
      />
      <div className="min-w-0 max-[700px]:pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
        <header className="topbar">
          <Link href="/app" className="brand topbar-brand shrink-0" aria-label="NetSentry home">
            <Image src="/brand/netsentry-logo.svg" alt="NetSentry" width={223} height={64} className="max-w-23 min-[700px]:max-w-32" />
          </Link>
          <WorkspaceSwitcher
            workspace={workspace}
            workspaces={workspaces.data}
            switching={switching}
            onSelect={selectWorkspace}
          />
          <span className="topbar-note">
            {workspace?.timezone ?? "Workspace"}
          </span>
          <button
            className="icon-button max-[700px]:hidden!"
            aria-label="Open notifications"
            onClick={() => choose("alerts")}
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
          {!isNetworkDetail && (
            <div className="page-heading">
              <p className="eyebrow">
                {workspace
                  ? `${workspace.type} / ${permission.data?.role ?? workspace.role}`
                  : "NETSENTRY"}
              </p>
              <h1>{section ?? "Workspace"}</h1>
              <button
                type="button"
                className="button"
                aria-label="Refresh workspace"
                onClick={() => {
                  window.dispatchEvent(new Event("netsentry:refresh"));
                }}
              >
                <span className="refresh-label">Refresh workspace</span>
                <RefreshCw
                  className="refresh-icon"
                  size={18}
                  aria-hidden="true"
                />
              </button>
              {section === "Overview" && (
                <p className="page-description">
                  Your devices and the information they report, in one place.
                </p>
              )}
            </div>
          )}
          <ErrorNotice error={selectionError} />
          {!isNetworkDetail && isWorkspaceSlug(slug) && (
            <WorkspaceTabs slug={slug} tab={activeTab} />
          )}
          <WorkspaceContext.Provider
            value={{
              user,
              workspace,
              permission,
              devices,
              workspaces,
              selectWorkspace,
              switching,
              context,
              needsDevices,
              updateUser,
              accountDeleted,
              choose,
              location:
                businessLocation?.workspaceId === workspace?.id
                  ? (businessLocation?.locationId ?? "")
                  : "",
              changeLocation: (locationId) => {
                if (workspace)
                  setBusinessLocation({
                    workspaceId: workspace.id,
                    locationId,
                  });
              },
            }}
          >
            {children}
          </WorkspaceContext.Provider>
        </main>
      </div>
    </div>
  );
}
type WorkspaceContextValue = {
  user: User;
  workspace?: Workspace;
  permission: ReturnType<typeof useResource<Permissions>>;
  devices: ReturnType<typeof useResource<Device[]>>;
  workspaces: ReturnType<typeof useResource<Workspace[]>>;
  selectWorkspace: (id: string) => Promise<void>;
  switching: boolean;
  context?: PageContext;
  needsDevices: boolean;
  updateUser: (user: User) => void;
  accountDeleted: () => void;
  choose: (slug: WorkspaceSlug) => void;
  location: string;
  changeLocation: (locationId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function WorkspaceTabs({ slug, tab }: { slug: WorkspaceSlug; tab?: string }) {
  const router = useRouter();
  const tabs = workspaceTabs(slug);
  const selected = tab ?? tabs[0]?.id;
  if (!tabs.length) return null;

  const sectionLabel = `${workspaceSections[slug]} sections`;
  return (
    <nav aria-label={sectionLabel} className="mb-4">
      <label className="field min-[620px]:hidden">
        Section
        <select
          aria-label={sectionLabel}
          value={selected}
          onChange={(event) => router.push(workspaceHref(slug, event.target.value))}
        >
          {tabs.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <div className="hidden flex-wrap items-end gap-x-1 border-b border-border min-[620px]:flex">
        {tabs.map(({ id, label }) => (
          <Link
            key={id}
            href={workspaceHref(slug, id)}
            aria-current={selected === id ? "page" : undefined}
            className="inline-flex min-h-11 items-center border-b-3 border-transparent px-3 text-sm whitespace-nowrap text-text-secondary! hover:bg-surface-lavender focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary aria-[current=page]:border-primary aria-[current=page]:font-bold aria-[current=page]:text-text!"
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function WorkspacePage({
  slug,
  tab,
  networkId,
}: {
  slug: WorkspaceSlug;
  tab?: string;
  networkId?: string;
}) {
  const state = useContext(WorkspaceContext);
  if (!state) throw new Error("Workspace page requires its layout.");
  const {
    user,
    workspace,
    permission,
    devices,
    workspaces,
    selectWorkspace,
    switching,
    context,
    needsDevices,
    updateUser,
    accountDeleted,
    choose,
    location,
    changeLocation,
  } = state;
  const section = workspaceSections[slug];
  const selectedTab = tab ?? "";
  const needsWorkspace =
    section !== "Settings & privacy" &&
    section !== "Operations" &&
    section !== "More modules";
  return (
    <>
      {section === "Operations" && (
        <div className="page-stack">
          <OperationsPanel tab={selectedTab} />
        </div>
      )}
      {section === "Settings & privacy" && (
        <div className="page-stack" key={workspace?.id}>
          <SettingsPanel
            tab={selectedTab}
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
      {section === "Team" &&
        selectedTab === "workspaces" &&
        workspaces.data && (
          <WorkspaceList
            workspaces={workspaces.data}
            activeId={workspace?.id}
            switching={switching}
            onSelect={selectWorkspace}
            onChanged={workspaces.reload}
          />
        )}
      {needsWorkspace && context ? (
        <div key={context.workspace.id} className="page-stack">
          {section === "Overview" && (
            <>
              <div className="overview-metrics grid grid-cols-2 gap-3 min-[700px]:grid-cols-3 min-[700px]:gap-4">
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
                    {context.devices.filter((d) => d.monitoringEnabled).length}
                  </strong>
                  <p>Collection still requires supported permissions</p>
                </Card>
                <Card className="min-w-0 max-[700px]:col-span-2">
                  <span className="metric-label">Last inventory refresh</span>
                  <strong className="metric-time">
                    {formatTime(devices.updatedAt)}
                  </strong>
                  <p>Visible pages refresh every 30 seconds</p>
                </Card>
              </div>
              <Card title="Your devices">
                {!context.devices.length ? (
                  <Empty title="No registered devices yet">
                    Device pairing will be available through supported native
                    clients. No network scan is running.
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
                            {device.platform} · {device.state.toLowerCase()} ·
                            last reported {formatTime(device.lastSeenAt)}
                          </small>
                        </div>
                        <span className="badge">{device.permissionStatus}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="button-row align-end">
                  <button
                    type="button"
                    className="button accent"
                    onClick={() => choose("devices")}
                  >
                    View device details
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </Card>
              <Card title="Monitoring availability">
                <p>
                  Usage appears when a supported collector has permission to
                  upload. Networks shows observations from approved collectors.
                  Developer Tools supports service control on paired computers
                  with an explicit grant and local consent.
                </p>
                <div className="button-row align-end">
                  <button
                    type="button"
                    className="button accent"
                    onClick={() => choose("usage-reports")}
                  >
                    Explore reports
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="button accent"
                    onClick={() => choose("alerts")}
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
              tab={selectedTab}
              networkId={networkId}
              context={context}
              location={location}
              changeLocation={changeLocation}
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
    </>
  );
}

function ConnectedSection({
  section,
  tab,
  networkId,
  context,
  workspacesChanged,
  location,
  changeLocation,
}: {
  section: WorkspaceSection;
  tab: string;
  networkId?: string;
  context: PageContext;
  workspacesChanged: () => void;
  location: string;
  changeLocation: (locationId: string) => void;
}) {
  if (section === "Subscription")
    return <BillingPanel {...context} tab={tab} />;
  if (section === "Business")
    return (
      <BusinessPanel
        {...context}
        tab={tab}
        location={location}
        changeLocation={changeLocation}
      />
    );
  if (section === "Family") return <FamilyPanel {...context} tab={tab} />;
  if (section === "Developer Tools")
    return <DeveloperPanel {...context} tab={tab} />;
  if (section === "Devices") return <DevicesPanel {...context} />;
  if (section === "Usage & reports") return <ReportsPanel {...context} />;
  if (section === "Networks")
    return <NetworksPanel {...context} tab={tab} networkId={networkId} />;
  if (section === "Alerts") return <AlertsPanel {...context} tab={tab} />;
  if (section === "Team")
    return (
      <TeamPanel
        context={context}
        workspacesChanged={workspacesChanged}
        tab={tab}
      />
    );
  return null;
}
