import type { ReactNode } from "react";

const brandLogo = new URL(
  "../../../assets/brand/netsentry-logo.svg",
  import.meta.url,
).href;

const brandMark = new URL(
  "../../../assets/brand/netsentry-mark.svg",
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
export type SectionPage = (typeof navigation)[number]["pages"][number]["id"];
export type PageId = SectionPage | "service-review";

export function sectionPage(page: PageId): SectionPage {
  return page === "service-review" ? "services" : page;
}
export function currentPage(): PageId {
  const value = location.hash.slice(1);
  if (value === "service-review") return value;
  return navigation.some((group) =>
    group.pages.some((page) => page.id === value),
  )
    ? (value as PageId)
    : "status";
}
export function NavigationIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    refresh: <path d="M20 7v5h-5m-11 5v-5h5M5.5 9a7 7 0 0 1 11.7-3L20 12M4 12l2.8 6a7 7 0 0 0 11.7-3" />,
    filters: <path d="M4 6h16M4 12h16M4 18h16M9 4v4m6 2v4m-5 2v4" />,
    pairing: <path d="M10 13a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2m2 6a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2" />,
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
export function Sidebar({ page }: { page: SectionPage }) {
  return (
    <aside className="desktop-sidebar">
      <a className="desktop-brand" href="#status" aria-label="NetSentry home">
        <img src={brandLogo} alt="" width={223} height={64} />
        <img src={brandMark} alt="" width={44} height={44} />
      </a>
      <nav aria-label="Desktop navigation" className="grid gap-1.5">
        {navigation.map((group) => {
          const active = group.pages.some((child) => child.id === page);
          return (
            <a
              key={group.label}
              className="desktop-main-link"
              href={`#${group.pages[0].id}`}
              aria-current={active ? "true" : undefined}
              title={group.label}
            >
              <NavigationIcon name={group.icon} />
              <span>{group.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

export function SectionLinks({ page }: { page: SectionPage }) {
  const group = navigation.find(({ pages }) => pages.some((item) => item.id === page));
  if (!group) return null;
  return (
    <nav className="desktop-section-links" aria-label={`${group.label} sections`}>
      {group.pages.map((item) => (
        <a key={item.id} href={`#${item.id}`} aria-current={item.id === page ? "page" : undefined}>
          {item.label}
        </a>
      ))}
    </nav>
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
