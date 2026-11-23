export const workspaceSections = {
  "": "Overview",
  devices: "Devices",
  "usage-reports": "Usage & reports",
  alerts: "Alerts",
  networks: "Networks",
  "developer-tools": "Developer Tools",
  family: "Family",
  business: "Business",
  subscription: "Subscription",
  operations: "Operations",
  team: "Team",
  settings: "Settings & privacy",
  "more-modules": "More modules",
} as const;

export type WorkspaceSlug = keyof typeof workspaceSections;
export type WorkspaceSection = (typeof workspaceSections)[WorkspaceSlug];

type WorkspaceTab = { id: string; label: string };

const tabs: Partial<Record<WorkspaceSlug, readonly WorkspaceTab[]>> = {
  alerts: [
    { id: "notifications", label: "Notifications" },
    { id: "rules", label: "Rules" },
    { id: "history", label: "History" },
    { id: "preferences", label: "Preferences" },
  ],
  networks: [
    { id: "labels", label: "Labels" },
    { id: "monitoring", label: "Monitoring" },
  ],
  team: [
    { id: "members", label: "Members" },
    { id: "workspaces", label: "Workspaces" },
  ],
  settings: [
    { id: "profile", label: "Profile" },
    { id: "notifications", label: "Notifications" },
    { id: "sessions", label: "Sessions" },
    { id: "privacy", label: "Privacy" },
    { id: "workspace", label: "Workspace" },
  ],
  business: [
    { id: "organization", label: "Organization" },
    { id: "people", label: "People" },
    { id: "reports", label: "Reports" },
    { id: "activity", label: "Activity" },
  ],
  subscription: [
    { id: "plan", label: "Plan" },
    { id: "history", label: "Payment history" },
  ],
  operations: [
    { id: "health", label: "Health" },
    { id: "administration", label: "Administration" },
    { id: "audit", label: "Audit" },
  ],
  family: [
    { id: "profiles", label: "Profiles" },
    { id: "sharing", label: "Sharing" },
  ],
  "developer-tools": [
    { id: "computers", label: "Computers" },
    { id: "sharing", label: "Sharing" },
  ],
};

export function workspaceTabs(slug: WorkspaceSlug) {
  return tabs[slug] ?? [];
}

export function isWorkspaceSlug(slug: string): slug is WorkspaceSlug {
  return Object.hasOwn(workspaceSections, slug);
}

export function workspaceHref(slug: WorkspaceSlug, tab?: string) {
  if (!slug) return "/app";
  return tab && tab !== workspaceTabs(slug)[0]?.id
    ? `/app/${slug}/${tab}`
    : `/app/${slug}`;
}

export function legacyWorkspaceHref(view: string) {
  const normalized = view.trim().toLowerCase();
  for (const slug of Object.keys(workspaceSections)) {
    if (
      isWorkspaceSlug(slug) &&
      (slug === normalized ||
        workspaceSections[slug].toLowerCase() === normalized)
    )
      return workspaceHref(slug);
  }
  return "/app";
}
