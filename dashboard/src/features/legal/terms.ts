export type TermsBlock =
  | { type: "paragraph" | "note"; text: string }
  | { type: "list"; items: string[] };
export type TermsSection = { id: string; title: string; blocks: TermsBlock[] };

// Approved draft copy. No agreement or acceptance is created by this page.
export const termsSections: TermsSection[] = [
  {
    id: "overview",
    title: "About these terms",
    blocks: [
      {
        type: "paragraph",
        text: "This draft describes the proposed terms for the NetSentry website, web workspace, and supported mobile, desktop and agent applications.",
      },
      {
        type: "paragraph",
        text: "The final version will identify the service operator, explain when the agreement applies, and describe how users will be informed of and accept the terms. This preview does not record agreement or acceptance.",
      },
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility and accounts",
    blocks: [
      {
        type: "paragraph",
        text: "Account access and workspace participation involve keeping sign-in details secure and using the appropriate account and workspace roles.",
      },
      {
        type: "paragraph",
        text: "Minimum age, guardian requirements, organization representation and regional eligibility rules will be specified in the final terms before the relevant services are released.",
      },
    ],
  },
  {
    id: "authority",
    title: "Permissions and authority",
    blocks: [
      {
        type: "paragraph",
        text: "Use NetSentry only with the authority and permissions appropriate to the device, information and action involved. Account access, pairing, collection, sharing and remote control are separate choices.",
      },
      {
        type: "list",
        items: [
          "Confirm your authority before connecting or managing a device.",
          "Respect the consent and sharing choices of other people.",
          "Review the exact target before requesting a supported control action.",
        ],
      },
      {
        type: "note",
        text: "Workspace membership or a subscription does not grant permission to monitor another person or control their computer.",
      },
    ],
  },
  {
    id: "use",
    title: "Acceptable use",
    blocks: [
      {
        type: "paragraph",
        text: "The proposed use rules prohibit unauthorized monitoring, attempts to bypass permissions, misuse of credentials and interference with the service or other users.",
      },
      {
        type: "paragraph",
        text: "Final terms will explain misuse handling and relevant review processes. Product capabilities should be used within their documented scope and with the required authorization.",
      },
    ],
  },
  {
    id: "availability",
    title: "Features and availability",
    blocks: [
      {
        type: "paragraph",
        text: "Features depend on operating systems, supported devices, agents, integrations and granted permissions. A missing report does not establish that no activity occurred, and a request being accepted does not prove that an action completed.",
      },
      {
        type: "paragraph",
        text: "NetSentry is in development. Release availability, support arrangements and any service commitments will be confirmed separately. Design previews and test data are not live monitoring results.",
      },
    ],
  },
  {
    id: "billing",
    title: "Plans and payments",
    blocks: [
      {
        type: "paragraph",
        text: "The Pricing page outlines proposed editions. Paid purchases are not currently available, and sandbox test amounts are not offered prices.",
      },
      {
        type: "paragraph",
        text: "Before paid plans launch, the applicable terms will describe charges, taxes, billing periods, renewals, trials if offered, cancellation and refund arrangements.",
      },
    ],
  },
  {
    id: "ownership",
    title: "Content and ownership",
    blocks: [
      {
        type: "paragraph",
        text: "The final terms will distinguish rights in the NetSentry software and branding from rights in information users provide or connect to the service.",
      },
      {
        type: "paragraph",
        text: "Any permissions needed to operate the service, software licence terms and treatment of feedback will be defined in the published version.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy and information",
    blocks: [
      {
        type: "paragraph",
        text: "The separate Privacy Policy explains the proposed information-handling notice and the details still being finalized. Product documentation describes available permissions, sharing, export and deletion workflows.",
      },
      {
        type: "paragraph",
        text: "Accepting terms must not be presented as a substitute for separate collection permissions, sharing choices or remote-control grants.",
      },
    ],
  },
  {
    id: "third-party",
    title: "Third-party services",
    blocks: [
      {
        type: "paragraph",
        text: "Supported workflows may depend on operating-system features, app distribution channels, routers or other integrations. Their availability and requirements can differ.",
      },
      {
        type: "paragraph",
        text: "The final terms will identify applicable third-party conditions and explain how they relate to the NetSentry service. No unsupported integration is promised by this draft.",
      },
    ],
  },
  {
    id: "ending",
    title: "Ending use of NetSentry",
    blocks: [
      {
        type: "paragraph",
        text: "Product controls include supported ways to revoke grants, leave workspaces and request account deletion. The effect of each action depends on its scope and the documented workflow.",
      },
      {
        type: "paragraph",
        text: "Final terms will explain account suspension, termination, notice, review, data access and any obligations that continue after use ends.",
      },
    ],
  },
  {
    id: "liability",
    title: "Responsibilities and disputes",
    blocks: [
      {
        type: "paragraph",
        text: "Warranty language, liability provisions, dispute procedures and governing law have not been finalized. These details require review for the released service and the regions where it will be offered.",
      },
      {
        type: "paragraph",
        text: "This preview does not introduce a liability cap, mandatory arbitration, waiver or restriction of statutory rights.",
      },
    ],
  },
  {
    id: "updates",
    title: "Updates and contact",
    blocks: [
      {
        type: "paragraph",
        text: "The published version will show an effective date and explain how changes are communicated. A verified channel for terms-related questions will also be provided.",
      },
      {
        type: "paragraph",
        text: "The current Contact page is a non-sending form preview. These draft terms remain subject to finalization before publication as an effective agreement.",
      },
    ],
  },
];
