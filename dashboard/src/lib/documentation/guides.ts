export type GuideBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: readonly string[] }
  | { type: "note"; title: string; text: string }
  | { type: "workspace-image" }
  | { type: "next"; slug: string; label: string };
export type Guide = {
  id: string;
  category: string;
  title: string;
  summary: string;
  sections: readonly {
    id: string;
    title: string;
    blocks: readonly GuideBlock[];
  }[];
};

export const guideCategories = [
  "Getting started",
  "Devices and permissions",
  "Reports and alerts",
  "Family and teams",
  "Developer tools",
  "Help and availability",
] as const;

export const guides: readonly Guide[] = [
  {
    id: "workspace",
    category: "Getting started",
    title: "Start with your workspace",
    summary:
      "Understand your account, choose a workspace and prepare your first supported device.",
    sections: [
      {
        id: "before",
        title: "Before you begin",
        blocks: [
          {
            type: "paragraph",
            text: "NetSentry brings supported device reports and developer tools into a workspace. Start with an account and the workspace where your devices and authorized people belong.",
          },
          {
            type: "note",
            title: "Product in development",
            text: "Native build, signing and physical-device checks are still in progress. Installation options will be published when release readiness is confirmed.",
          },
        ],
      },
      {
        id: "account",
        title: "1. Set up your account",
        blocks: [
          {
            type: "paragraph",
            text: "Use the web sign-in or registration flow. If you are registering, follow the verification instructions sent through the configured account email process. Signing in gives you account access; it does not start monitoring.",
          },
        ],
      },
      {
        id: "choose",
        title: "2. Choose your workspace",
        blocks: [
          {
            type: "paragraph",
            text: "Choose an available workspace or create one through the supported workspace flow. The active workspace sets the context for the devices, reports and people you can access.",
          },
          {
            type: "workspace-image",
          },
          {
            type: "paragraph",
            text: "An empty inventory is a valid starting state. Reports need a supported, authorized source to provide data.",
          },
        ],
      },
      {
        id: "permissions",
        title: "3. Review your device and permissions",
        blocks: [
          {
            type: "paragraph",
            text: "Choose the appropriate supported app or agent for your device. Review its availability, capabilities and required permissions before pairing or enabling collection.",
          },
          {
            type: "list",
            items: [
              "Pairing identifies the installation and workspace association.",
              "Collection needs the relevant supported permissions and consent.",
              "Sharing and remote-control grants are separate choices.",
            ],
          },
        ],
      },
      {
        id: "next",
        title: "4. Read your first available report",
        blocks: [
          {
            type: "paragraph",
            text: "When a supported source provides data, review the source, time coverage and any missing periods alongside the values. Unsupported or missing readings stay unavailable. Estimated values remain labelled.",
          },
          {
            type: "next",
            slug: "reports",
            label: "Understand reports and data quality",
          },
        ],
      },
    ],
  },
  {
    id: "account",
    category: "Getting started",
    title: "Account and sign-in basics",
    summary:
      "Learn how account access, verification and recovery fit together.",
    sections: [
      {
        id: "access",
        title: "Access your account",
        blocks: [
          {
            type: "paragraph",
            text: "Use the web sign-in or registration flow. Account access is separate from device collection, shared reporting and process control.",
          },
        ],
      },
      {
        id: "verification",
        title: "Verification and recovery",
        blocks: [
          {
            type: "paragraph",
            text: "Verification and password recovery use the configured account email workflow. Follow the link instructions and confirm the requested action. Keep account codes private.",
          },
        ],
      },
      {
        id: "sessions",
        title: "Review your sessions",
        blocks: [
          {
            type: "paragraph",
            text: "Use account settings to review signed-in sessions and sign out. If a session ends, sign in again before continuing with protected workspace actions.",
          },
        ],
      },
    ],
  },
  {
    id: "pairing",
    category: "Devices and permissions",
    title: "Understand device pairing",
    summary: "See what pairing connects and which choices come afterwards.",
    sections: [
      {
        id: "association",
        title: "What pairing means",
        blocks: [
          {
            type: "paragraph",
            text: "Pairing associates a supported installation with a device and workspace. It does not grant every permission or start every available module.",
          },
        ],
      },
      {
        id: "review",
        title: "Review the installation",
        blocks: [
          {
            type: "paragraph",
            text: "Confirm the intended workspace and device, review supported capabilities and follow the client’s explicit pairing steps. Native installation depends on release availability.",
          },
        ],
      },
      {
        id: "separate",
        title: "Keep choices separate",
        blocks: [
          {
            type: "paragraph",
            text: "Collection consent, family or business sharing, and remote-controller grants are separate from the installation identity.",
          },
        ],
      },
    ],
  },
  {
    id: "permissions",
    category: "Devices and permissions",
    title: "Permissions and collection choices",
    summary:
      "Understand what can be collected and how to pause or revoke access.",
    sections: [
      {
        id: "supported",
        title: "Start with supported sources",
        blocks: [
          {
            type: "paragraph",
            text: "Permissions and operating-system support determine which sources are available. Denied, revoked or unsupported access must remain visible.",
          },
        ],
      },
      {
        id: "choices",
        title: "Review collection and sharing",
        blocks: [
          {
            type: "paragraph",
            text: "Choose collection through the supported permission and consent flows. Sharing a report requires its own valid scope and consent.",
          },
        ],
      },
      {
        id: "pause",
        title: "Pause or revoke",
        blocks: [
          {
            type: "paragraph",
            text: "Use the appropriate device or privacy controls to pause collection or revoke access. Device-level effects depend on connectivity and platform behavior; browser status alone is not physical-device validation.",
          },
        ],
      },
    ],
  },
  {
    id: "reports",
    category: "Reports and alerts",
    title: "Understand reports and data quality",
    summary: "Read measured values, estimates, sources and coverage together.",
    sections: [
      {
        id: "sources",
        title: "Begin with the source",
        blocks: [
          {
            type: "paragraph",
            text: "Review which installation or supported collector reported a value, the metric and the reporting period.",
          },
        ],
      },
      {
        id: "quality",
        title: "Read the quality label",
        blocks: [
          {
            type: "paragraph",
            text: "Measured and estimated values remain distinct. Missing or unsupported measurements stay unavailable, rather than becoming zero.",
          },
        ],
      },
      {
        id: "coverage",
        title: "Check time coverage",
        blocks: [
          {
            type: "paragraph",
            text: "Look for gaps and collection intervals before comparing periods. Overlapping device or application windows do not necessarily represent unique-person screen time.",
          },
        ],
      },
    ],
  },
  {
    id: "alerts",
    category: "Reports and alerts",
    title: "Review alerts and quiet hours",
    summary: "Understand rules, acknowledgements and delivery availability.",
    sections: [
      {
        id: "rules",
        title: "Review the rule",
        blocks: [
          {
            type: "paragraph",
            text: "Alert rules define supported conditions, scope and thresholds. Review the relevant device or network and current permissions.",
          },
        ],
      },
      {
        id: "review",
        title: "Read and acknowledge",
        blocks: [
          {
            type: "paragraph",
            text: "Review severity, timing and the evidence provided by the supported source. An alert is information to review, rather than proof of protection or automatic enforcement.",
          },
        ],
      },
      {
        id: "delivery",
        title: "Understand delivery",
        blocks: [
          {
            type: "paragraph",
            text: "Quiet hours and delivery preferences apply to supported channels. Provider availability and setup determine whether email or native push can be delivered.",
          },
        ],
      },
    ],
  },
  {
    id: "sharing",
    category: "Family and teams",
    title: "Sharing, consent and roles",
    summary: "Learn who can see a report and what workspace membership means.",
    sections: [
      {
        id: "scope",
        title: "Membership sets a context",
        blocks: [
          {
            type: "paragraph",
            text: "Current membership and role permissions govern access within a workspace. A role does not automatically provide device-control authority.",
          },
        ],
      },
      {
        id: "consent",
        title: "Sharing requires a choice",
        blocks: [
          {
            type: "paragraph",
            text: "Family assignments and employee device sharing use explicit consent within the supported workflow. Assigned-device sharing and collection permission remain separate.",
          },
        ],
      },
      {
        id: "review",
        title: "Keep access current",
        blocks: [
          {
            type: "paragraph",
            text: "Changes to roles, assignments or consent can invalidate sharing. Review the current scope and use supported withdrawal or revocation controls.",
          },
        ],
      },
    ],
  },
  {
    id: "family",
    category: "Family and teams",
    title: "Family reports and time requests",
    summary:
      "Review shared wellbeing context and distinguish decisions from applied controls.",
    sections: [
      {
        id: "reports",
        title: "Review authorized reports",
        blocks: [
          {
            type: "paragraph",
            text: "Family views show supported shared reports within current profile grants, device assignments and consent.",
          },
        ],
      },
      {
        id: "requests",
        title: "Understand time requests",
        blocks: [
          {
            type: "paragraph",
            text: "Child time requests and guardian decisions are stored workflow decisions. They do not prove that a device restriction was applied.",
          },
        ],
      },
      {
        id: "support",
        title: "Check control support",
        blocks: [
          {
            type: "paragraph",
            text: "Current Android and router restriction adapters do not enforce device limits. Apple controls require separate eligibility, authorization and device validation.",
          },
        ],
      },
    ],
  },
  {
    id: "services",
    category: "Developer tools",
    title: "Inspect local services",
    summary:
      "Review services, projects and exact targets before choosing an action.",
    sections: [
      {
        id: "agent",
        title: "Start with the local agent",
        blocks: [
          {
            type: "paragraph",
            text: "The desktop interface connects to the local agent for supported developer-service workflows. macOS is the initial desktop target; native release checks remain pending.",
          },
        ],
      },
      {
        id: "inspect",
        title: "Inspect the service",
        blocks: [
          {
            type: "paragraph",
            text: "Review the project, runtime, process identity and listening ports provided by the supported source.",
          },
        ],
      },
      {
        id: "actions",
        title: "Review actions and outcomes",
        blocks: [
          {
            type: "paragraph",
            text: "Graceful stop and force-stop require separate confirmation. Remote requests also require pairing, explicit local consent and current controller grants. Accepted or pending does not prove a service stopped.",
          },
        ],
      },
    ],
  },
  {
    id: "missing",
    category: "Help and availability",
    title: "Why a report may be unavailable",
    summary: "Check sources, permissions, coverage and synchronization.",
    sections: [
      {
        id: "source",
        title: "Check the source",
        blocks: [
          {
            type: "paragraph",
            text: "Confirm a supported device or collector is associated with the intended workspace. An empty inventory does not mean a network scan is running.",
          },
        ],
      },
      {
        id: "permissions",
        title: "Review permissions and consent",
        blocks: [
          {
            type: "paragraph",
            text: "Denied or revoked permissions, paused collection, unsupported metrics and sharing changes can make data unavailable.",
          },
        ],
      },
      {
        id: "coverage",
        title: "Review coverage and freshness",
        blocks: [
          {
            type: "paragraph",
            text: "Check report timestamps, coverage and synchronization state. Offline or delayed data should stay visibly incomplete; do not interpret it as zero usage.",
          },
        ],
      },
    ],
  },
  {
    id: "availability",
    category: "Help and availability",
    title: "Platform support and availability",
    summary:
      "Review differences between web, Android, iOS, desktop and router sources.",
    sections: [
      {
        id: "release",
        title: "Understand release status",
        blocks: [
          {
            type: "paragraph",
            text: "NetSentry is in development. Native build, signing and physical-device validation are still in progress. Public download options are not yet published.",
          },
        ],
      },
      {
        id: "platforms",
        title: "Check platform differences",
        blocks: [
          {
            type: "paragraph",
            text: "Android collection requires supported sources and user-granted access. iOS does not generally expose device-wide mobile/Wi-Fi totals. Apple Screen Time features require separate eligibility and authorization.",
          },
        ],
      },
      {
        id: "hardware",
        title: "Review agent and router support",
        blocks: [
          {
            type: "paragraph",
            text: "Desktop and router workflows depend on the exact operating system, collector, adapter and hardware. Network discovery does not establish per-device traffic measurement or filtering support.",
          },
        ],
      },
    ],
  },
  {
    id: "privacy",
    category: "Help and availability",
    title: "Privacy, export and account controls",
    summary: "Find collection, sharing, export and deletion choices.",
    sections: [
      {
        id: "choices",
        title: "Review your choices",
        blocks: [
          {
            type: "paragraph",
            text: "Account access, collection, sharing and controller grants are separate. Review device and workspace privacy choices within your current permissions.",
          },
        ],
      },
      {
        id: "export",
        title: "Export your personal data",
        blocks: [
          {
            type: "paragraph",
            text: "Use the account’s supported personal export flow. Exports may contain private information; save them only to a destination you trust.",
          },
        ],
      },
      {
        id: "deletion",
        title: "Understand deletion scope",
        blocks: [
          {
            type: "paragraph",
            text: "Account and device deletion have explicit confirmation flows. Shared organization ownership may require transfer before account deletion. Review the presented scope before confirming.",
          },
        ],
      },
    ],
  },
];

export function findGuide(slug: string) {
  return guides.find((guide) => guide.id === slug);
}
