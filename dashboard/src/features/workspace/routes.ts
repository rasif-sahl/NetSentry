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

export function isWorkspaceSlug(slug: string): slug is WorkspaceSlug {
  return Object.hasOwn(workspaceSections, slug);
}

export function workspaceHref(slug: WorkspaceSlug) {
  return slug ? `/app/${slug}` : "/app";
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
