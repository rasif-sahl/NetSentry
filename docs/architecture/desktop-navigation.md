# Desktop navigation and page design

The desktop renderer uses the approved floating, rounded sidebar with five main groups and 14 focused destinations. Its lavender/white light appearance and semantic dark palette use locally compiled Tailwind CSS and runtime tokens. Switch controls and accessible Light/Dark/System choices use the same approved card treatment. No remote fonts, scripts, icon library or new runtime permissions are added.

| Group | Destinations |
| --- | --- |
| Overview | Computer status; Pairing & identity; Module preferences |
| Developer Tools | Service inventory; Project groups; Local shutdown permissions; Action history |
| Sharing | Remote service access; Network observation sharing |
| Background Service | Service status; Run at login |
| Settings | Appearance; Desktop updates; Diagnostics & recovery |

`Navigation.tsx` owns route names and local hash IDs. Sidebar anchors, quick links and breadcrumbs identify the active destination. Same-document hash navigation supports browser/renderer Back and reload/deep links. Unknown hashes fall back to Computer status. The main heading receives focus after navigation; a keyboard skip link targets the main content without replacing the active route. Narrow windows stack the navigation above the content and contain service-table horizontal scrolling.

## State and permission boundaries

- App-level appearance state remains mounted across page changes, including OS/system theme, cross-window synchronization and blocked-storage fallback. Only the existing non-sensitive local appearance preference is stored. Route hashes contain fixed page IDs only.
- Page-local forms, disclosures and service selections unmount on route changes. Installation, pairing, backend connection or module-preference changes also reset the scoped page. Enrolment codes are masked and cleared on navigation/submission, not persisted in URLs or storage.
- Agent status reads are fenced against stale responses. Unavailable reads clear prior status and gated views. The overview shows reported agent/configuration state and verified background registration state; unavailable data remains unknown. Enabling a configured module does not certify collection or grant shutdown authority.
- Service inventory shows actual agent responses in a table. Review service opens the captured identity/details; graceful and force-stop retain separate dialogs, freshness checks and child choices. The existing main/agent validation and outcome semantics remain in force. Project correction has its own page and still requires fresh observations. Action history remains an explicit read, not proof of shutdown until an actual outcome is reported.
- Local shutdown permission is read from a refreshed inventory and edited separately. Navigation never enables local control, sharing, monitoring or background registration.
- Background registration is on Run at login; verified status/start/removal is on Service status. Native confirmations, signed-app checks, workspace eligibility and update interlocks stay in the existing main-process services.
- Sharing pages retain their distinct disclosures and supported-platform gates. Unpaired/disabled states link to setup instead of rendering blank pages. No proposal sample services or monitoring totals are included in the live renderer.
- The Electron security boundary is unchanged: same-origin bundled renderer, isolated preload bridge, allowlisted IPC, no Node integration, restrictive CSP and denied external navigation/window creation.

See [verification](../validation/desktop-navigation.md) for renderer checks and pending native acceptance. The original HTML proposal remains a design reference rather than a production data source.
