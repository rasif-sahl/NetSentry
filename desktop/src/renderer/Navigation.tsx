import type { ReactNode } from "react";

const brandLogo = new URL(
  "../../../assets/brand/netsentry-logo.svg",
  import.meta.url,
).href;

export const navigation = [
  {
    label: "Overview",
    icon: "overview",
    pages: [
      {
        id: "status",
        label: "Computer status",
        description:
          "Your computer, local agent and enabled modules at a glance.",
      },
      {
        id: "pairing",
        label: "Pairing & identity",
        description:
          "Connect this installation to a workspace using a single-use code.",
      },
      {
        id: "modules",
        label: "Module preferences",
        description: "Choose which modules may operate on this computer.",
      },
    ],
  },
  {
    label: "Developer Tools",
    icon: "developer",
    pages: [
      {
        id: "services",
        label: "Service inventory",
        description:
          "Inspect local services by project, runtime, PID or listening port.",
      },
      {
        id: "projects",
        label: "Project groups",
        description:
          "Review project associations and correct inferred labels locally.",
      },
      {
        id: "control",
        label: "Local shutdown permissions",
        description:
          "Control whether separately confirmed local stop actions are available.",
      },
      {
        id: "history",
        label: "Action history",
        description:
          "Review recorded outcomes before retrying an uncertain local action.",
      },
    ],
  },
  {
    label: "Sharing",
    icon: "sharing",
    pages: [
      {
        id: "remote",
        label: "Remote service access",
        description:
          "Choose what this computer shares and which remote actions it permits.",
      },
      {
        id: "network",
        label: "Network observation sharing",
        description:
          "Link observations to one named network with separate consent.",
      },
    ],
  },
  {
    label: "Background Service",
    icon: "background",
    pages: [
      {
        id: "background",
        label: "Service status",
        description:
          "Review the per-user background service and its current state.",
      },
      {
        id: "login",
        label: "Run at login",
        description:
          "Choose whether the registered service starts when you sign in.",
      },
    ],
  },
  {
    label: "Settings",
    icon: "settings",
    pages: [
      {
        id: "appearance",
        label: "Appearance",
        description:
          "Make this desktop feel at home. Saved locally on this computer.",
      },
      {
        id: "updates",
        label: "Desktop updates",
        description:
          "Review update availability and confirm downloads and installation.",
      },
      {
        id: "diagnostics",
        label: "Diagnostics & recovery",
        description:
          "Inspect current state, recover a stale socket and export redacted results.",
      },
    ],
  },
] as const;
export type PageId = (typeof navigation)[number]["pages"][number]["id"];
export function currentPage(): PageId {
  const value = location.hash.slice(1);
  return navigation.some((group) =>
    group.pages.some((page) => page.id === value),
  )
    ? (value as PageId)
    : "status";
}
export function NavigationIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    overview: <path d="m3 10 9-7 9 7v10H5V10m4 10v-7h6v7" />,
    developer: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M12 17v4m-5 0h10" />
      </>
    ),
    sharing: (
      <>
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="5" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m9 10 6-4m-6 8 6 4" />
      </>
    ),
    background: <path d="M12 3v9m-6-7a9 9 0 1 0 12 0" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m9 3-1 3-3 1-2 5 2 4 3 2 1 3h6l1-3 3-2 2-4-2-5-3-1-1-3Z" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.overview}
    </svg>
  );
}
export function Sidebar({
  page,
  connected,
}: {
  page: PageId;
  connected: boolean;
}) {
  return (
    <aside className="desktop-sidebar">
      <a className="desktop-brand" href="#status">
        <img src={brandLogo} alt="NetSentry" width={223} height={64} />
      </a>
      <p className="desktop-eyebrow">DESKTOP WORKSPACE</p>
      <nav aria-label="Desktop navigation">
        {navigation.map((group) => {
          const active = group.pages.some((child) => child.id === page);
          return (
            <div className="desktop-nav-group" key={group.label}>
              <a
                className={`desktop-main-link ${active ? "selected" : ""}`}
                href={`#${group.pages[0].id}`}
                aria-expanded={active}
              >
                <NavigationIcon name={group.icon} />
                <span>{group.label}</span>
                <span className="desktop-nav-arrow" aria-hidden="true">
                  {active ? "⌃" : "⌄"}
                </span>
              </a>
              {active && (
                <div className="desktop-sub-links">
                  {group.pages.map((child) => (
                    <a
                      key={child.id}
                      href={`#${child.id}`}
                      aria-current={child.id === page ? "page" : undefined}
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="desktop-sidebar-footer">
        <strong>
          <span aria-hidden="true">●</span>{" "}
          {connected ? "Local agent connected" : "Agent unavailable"}
        </strong>
        <span>Desktop workspace</span>
        <span>Monitoring and control require consent.</span>
      </div>
    </aside>
  );
}
export function PageCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="desktop-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function Unavailable({ children }: { children: ReactNode }) {
  return (
    <section className="desktop-card">
      <h2>Setup required</h2>
      <p>{children}</p>
      <div className="desktop-actions">
        <a className="desktop-button secondary" href="#pairing">
          Review pairing
        </a>
        <a className="desktop-button secondary" href="#modules">
          Module preferences
        </a>
      </div>
    </section>
  );
}
