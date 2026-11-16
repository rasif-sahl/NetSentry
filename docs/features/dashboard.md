# Responsive web dashboard

Phase 4 replaces the preview interface with API-backed browser workflows. Next.js/React/TypeScript and Tailwind remain the web stack, with the existing lavender design language and system fonts. The Next.js server acts as a same-origin API gateway; the NestJS backend remains the authority for accounts and every domain permission.

## Connected screens

| Screen | Implemented behavior |
| --- | --- |
| Account pages | Register, sign in, restore/refresh, sign out, verify email, request/reset password |
| Overview | Registered-device and consent-setting counts, inventory fetch time, reported device timestamps, explicit monitoring availability |
| Devices | Search inventory, reported metadata/capabilities/setup reasons, rename, current disclosure/scope consent, pause/revoke/unenrol, data deletion/removal and consent history |
| Usage & reports | Local-date and metric/device/network/application filters; daily/weekly/monthly buckets, exact values, prior comparison, measured/estimated distinction, coverage/missing time, source collector/quality, historical gaps, proportional allocation and CSV |
| Alerts | Rules and edits, severity, thresholds/reported-device health, device/network scope, enabled state, quiet hours, acknowledgement, delivery/attempt states, in-app delivery and preferences |
| Networks | Manual labels and own-device association that pauses monitoring/requires consent again |
| Team | Members, verified-user workspace creation, recipient-bound invitations, one-time token sharing/hiding, acceptance/revocation, permitted role changes/removal/departure and shared ownership transfer |
| Settings & privacy | Profile, light/dark/system theme, reduced motion, session revocation, fresh-password personal export, ownership-safe account deletion, owner retention settings and audit-authorized monitoring diagnostics |
| More modules | Explicit planned states for Family, Policies, Organizations, Locations, Audit, Subscription, Developer Tools, Network Security and Insights |

Counts describe registration/consent, not network presence or protection. A healthy device field is labelled as a device report with its timestamp. No scan is simulated and no security score, threat-free claim, fabricated trend or fake native capability is displayed. Full Family/Business policy models, router discovery, service control and subscription billing remain their backend/platform phases.

## Access, freshness and interaction

The interface reads actual workspace permissions and device ownership to show relevant controls. Hidden controls do not replace backend checks. Read-only viewers can inspect allowed inventory but cannot read another subject's usage through the report UI/API. Shared report exports require their separate permission. Only the device owner grants consent and uses the dedicated personal-data erasure action; manager-authorized device removal also erases associated data under the existing lifecycle API, and only the workspace owner changes retention. Destructive controls ask for confirmation; account deletion additionally requires the current password and typed DELETE.

Workspace-specific components are reset when the workspace changes. Pending reads are aborted and late responses are ignored. Cross-tab sign-out clears private views; account changes reload the other tab's context. A server-side expected-user fence prevents a stale action from applying to a different account. Previously authorized profile responses cannot repopulate a signed-out or changed user.

Visible resources refresh every 30 seconds while online, on reconnection/visibility changes and on explicit refresh. Polling is not streaming, and browser fetch time is not observation time. Error states retain a previous response only with an explicit error and its previous refresh time; 401/403 clears protected data. Missing usage stays null rather than becoming zero. Exact numeric strings remain intact in tables; chart geometry uses visual ratios only. The chart displays the most recent 31 buckets and the table retains the full selected result.

Forms provide labelled controls, separate hint descriptions, busy/disabled states and recoverable error messages. Navigation supports browser history at section level. The narrow-screen drawer traps focus, closes with Escape and restores focus; the background is inert while it is open. A skip link, content focus, responsive tables, touch targets, color themes and OS/user reduced-motion preferences are implemented. This is browser validation, not a completed assistive-technology or physical-device audit.

## Session and deployment boundaries

Access/refresh credentials use HTTP-only SameSite=Strict cookies, Secure with __Host- names over HTTPS. Browser JavaScript receives public user data, not JWTs. Same-origin JSON mutations, a documented-route allowlist and a server-side identity fence constrain the gateway. The backend still verifies signatures, revocation, membership and resource scope. See `../../dashboard/README.md` for environment variables, size/time limits, multi-tab handling, rate-limit/ingress considerations and local checks. A lost one-use refresh response can require signing in again; old refresh credentials are not replayed to bypass revocation.

Native pairing is performed by native clients; the web dashboard never redeems enrolment into a browser-held device credential. SMTP delivery, FCM/APNs registration and physical push delivery remain external/native acceptance. Alerts require the Phase 3 maintenance process to evaluate/deliver; the UI does not install a scheduler. TLS/host/ingress deployment configuration, large archive delivery, load targets, broad browser/assistive-technology coverage and native/hardware acceptance remain explicit deployment or platform work.

The browser fixture server is separate from production startup. It uses synthetic data and real application/database behavior, replacing only its loopback-shared rate counter so a complete suite can authenticate repeatedly. No production rate policy or core authorization is bypassed. CI uses isolated PostgreSQL and desktop Chromium; local checks use the existing desktop Chrome. No mobile tooling is installed.
