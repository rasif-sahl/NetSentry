export type PolicyBlock =
  | { type: "paragraph" | "note"; text: string }
  | { type: "list"; items: { lead: string; text: string }[] };
export type PolicySection = {
  id: string;
  title: string;
  blocks: PolicyBlock[];
};

// Approved draft copy, not an effective policy or legal compliance assertion.
export const policySections: PolicySection[] = [
  {
    id: "overview",
    title: "About this policy",
    blocks: [
      {
        type: "paragraph",
        text: "This draft covers the NetSentry website, web workspace, and supported mobile, desktop and agent applications. The information involved depends on the features you use, the devices you connect and the permissions you grant.",
      },
      {
        type: "paragraph",
        text: "The final policy will identify the entity responsible for processing your information and explain any differences between personal, family and organization-managed workspaces.",
      },
    ],
  },
  {
    id: "information",
    title: "Information involved",
    blocks: [
      {
        type: "paragraph",
        text: "Depending on your use of NetSentry, the relevant categories may include:",
      },
      {
        type: "list",
        items: [
          {
            lead: "Account information:",
            text: "sign-in details, profile information and workspace membership.",
          },
          {
            lead: "Connected-device information:",
            text: "device identity, platform, capabilities and connection status.",
          },
          {
            lead: "Reports you enable:",
            text: "supported application, usage, network or developer-service information.",
          },
          {
            lead: "Choices and activity:",
            text: "permissions, sharing settings, requests and action records.",
          },
        ],
      },
      {
        type: "note",
        text: "Connecting an account or joining a workspace does not, by itself, grant device collection or remote-control permission.",
      },
    ],
  },
  {
    id: "use",
    title: "How information is used",
    blocks: [
      {
        type: "paragraph",
        text: "The proposed purposes include providing account access, connecting authorized devices, presenting available reports, applying sharing choices and supporting product operations.",
      },
      {
        type: "paragraph",
        text: "The final policy will map these purposes to the information processed and the applicable legal grounds. Features that require separate permission or consent remain subject to those choices.",
      },
    ],
  },
  {
    id: "sharing",
    title: "Sharing and access",
    blocks: [
      {
        type: "paragraph",
        text: "Workspace access depends on roles, membership and explicit sharing grants. Family or team membership should not be understood as unrestricted access to another person’s information.",
      },
      {
        type: "paragraph",
        text: "The final policy will describe service-provider access, other recipients and any circumstances requiring disclosure. Provider identities and international-transfer details are still to be confirmed.",
      },
    ],
  },
  {
    id: "permissions",
    title: "Devices and permissions",
    blocks: [
      {
        type: "paragraph",
        text: "Collection depends on the operating system, supported sources and permissions you enable. Pairing, collection, sharing and remote-control grants are separate parts of the product.",
      },
      {
        type: "paragraph",
        text: "The final policy will explain family and child-account handling, the responsibilities of workspace administrators, and any age or regional requirements before those services are released.",
      },
    ],
  },
  {
    id: "retention",
    title: "Storage and retention",
    blocks: [
      {
        type: "paragraph",
        text: "Retention can differ between account records, detailed measurements, summaries and operational records. The final policy will publish the relevant periods or the criteria used to determine them.",
      },
      {
        type: "paragraph",
        text: "Hosting locations, backup retention and deletion timelines must also be confirmed. Test-plan limits are not a published retention commitment.",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    blocks: [
      {
        type: "paragraph",
        text: "The final policy will describe the technical and organizational measures applicable to the released service, including access controls and protection of account and device credentials.",
      },
      {
        type: "paragraph",
        text: "This draft does not make a security certification or guarantee. Release verification and operational practices must support the final wording.",
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    blocks: [
      {
        type: "paragraph",
        text: "The website and applications may use cookies or local storage for sessions and product settings. The final notice will identify what is used, its purpose and duration, and the available controls.",
      },
      {
        type: "paragraph",
        text: "Any analytics, optional tracking or third-party technologies must be inventoried before the final policy is published.",
      },
    ],
  },
  {
    id: "choices",
    title: "Your choices and requests",
    blocks: [
      {
        type: "paragraph",
        text: "The product includes workflows for managing supported permissions, sharing, account export and deletion. Availability and the steps involved are explained in the product documentation.",
      },
      {
        type: "list",
        items: [
          {
            lead: "",
            text: "Review and change supported collection permissions.",
          },
          {
            lead: "",
            text: "Manage sharing grants and workspace participation.",
          },
          {
            lead: "",
            text: "Use available account export and deletion controls.",
          },
        ],
      },
      {
        type: "paragraph",
        text: "The final policy will explain applicable privacy rights, request verification, contact methods and any regional complaint routes.",
      },
    ],
  },
  {
    id: "updates",
    title: "Updates and contact",
    blocks: [
      {
        type: "paragraph",
        text: "A published version will show an effective date and explain how material changes are communicated. The draft status will be removed only when the policy details are finalized.",
      },
      {
        type: "paragraph",
        text: "A verified privacy contact and request channel will be listed here. The current Contact page is a non-sending form preview.",
      },
    ],
  },
];
