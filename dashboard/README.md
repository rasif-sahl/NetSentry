# NetSentry public website and web dashboard

The responsive Next.js/React/TypeScript/Tailwind dashboard connects to the account, workspace, device and monitoring APIs delivered in Phases 2–3. It uses actual API responses; there are no simulated scans, sample security scores or hardcoded usage totals in the product interface.

## Local setup

With the existing backend environment/migrations configured and dashboard dependencies prepared:

```sh
cp dashboard/.env.example dashboard/.env.local
npm run dev:dashboard
```

Open `http://localhost:3001` for the product homepage and `http://localhost:3001/app` for the workspace. Set the private `NETSENTRY_API_URL` to the full backend API base, normally `http://127.0.0.1:3000/api/v1`, and `DASHBOARD_ORIGIN` to the exact browser origin. These values are server-only; no JWT signing or account-mail encryption secret belongs in the dashboard environment. Never put credentials in a `NEXT_PUBLIC_` variable.

`DASHBOARD_ORIGIN` is mandatory in production. Production dashboard/API origins require HTTPS, with HTTP exceptions only for local loopback testing. A changed deployment hostname requires the matching configured origin. Forwarding untrusted client IP headers is deliberately disabled; backend IP-based rate limits currently share the dashboard proxy address. Configure a reviewed trusted-ingress/rate policy before a multi-user production rollout. Browser fixtures replace only their isolated rate counter, not production authentication or authorization.

## Included flows

- Registration, sign-in/restoration/refresh/sign-out, email verification and password recovery.
- Workspace selection, creation, invitation acceptance/sharing/revocation, member management and ownership transfer for supported workspace roles.
- Reported device inventory, capabilities/permission/health, rename, explicit consent, pause/revocation/unenrolment and deletion.
- Day/week/month usage reports, comparison periods, exact measured/estimated values, coverage/gaps, source indicators and CSV download.
- Alert rules, quiet hours, severity, device/network scope, acknowledgement, delivery attempts, in-app notifications and preferences.
- Manual network labels and consent-resetting device association.
- Profile, light/dark/system appearance, reduced motion, sessions, personal export/account deletion, retention and safe operational diagnostics.
- Responsive keyboard navigation, section history/bookmarks, loading/empty/error/permission states and explicitly planned future modules.

Email links use `/verify-email#token=…` and `/reset-password#token=…`. The browser removes the fragment from the address bar and asks the user to confirm the action; it never consumes a verification link during prefetch/render. Code fields are masked. Real email requires the backend's configured delivery process; real push remains unavailable.

## Browser session boundary

The browser uses same-origin `/api/backend/*` routes. The Next.js server forwards only documented operations and rejects device-token routes and legacy registration. Login/registration/refresh responses expose the public user only; access/refresh tokens remain in HTTP-only, SameSite=Strict cookies. HTTPS uses Secure `__Host-` cookies. Cookies have backend-token expiry capped at 30 days. No bearer tokens are stored in browser local/session storage.

Mutations require an exact matching Origin and JSON content. An expected-account header fences authenticated mutations against account changes between tabs; this is a concurrency check, not authorization. The backend remains responsible for JWT signatures, current sessions, ownership, verification, workspace roles and consent. Cross-tab session changes clear the old UI, and late profile responses cannot recreate a signed-out user. Web Locks coordinate refresh/session changes where supported; BroadcastChannel coordinates tab identity changes. Refresh tokens are single-use: if navigation or connection loss discards a rotation response, sign in again rather than replaying the old credential. The server-side account fence still prevents wrong-account mutations if those browser APIs are unavailable.

All API responses are `no-store`. Requests are bounded to 64 KiB; responses/download envelopes are bounded to 16 MiB and upstream requests time out after 20 seconds. Large personal archives require a separate operator export path; this phase does not provide a background archive service. Errors expose safe backend messages and request references, not arbitrary provider/server payloads.

Visible data resources poll every 30 seconds while online and visible, and refresh on reconnection, visibility changes or explicit refresh. User/workspace changes discard old resources and abort reads. Fetch time is labelled separately from device report/synchronization time. A disconnected refresh can retain a clearly errored previous result; authorization failures clear it.

## Checks

```sh
npm --prefix dashboard run lint
npm --prefix dashboard run build
```

Webpack and Tailwind's standard PostCSS integration provide a working build path in environments where Turbopack worker ports are restricted. System fonts avoid build-time font downloads. `typecheck` runs Next's route generation and TypeScript separately when needed; the production build already checks types.

Browser integration tests require the already-built backend/dashboard, contracts/backend dependencies, and a dedicated empty PostgreSQL database whose name ends in `_test`:

```sh
npm run build:backend
npm run build:dashboard
TEST_DATABASE_URL=postgresql://localhost/netsentry_web_test \
PLAYWRIGHT_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
npm run test:dashboard
```

The optional executable variable selects an existing desktop Chrome. CI prepares desktop Chromium in its isolated runner. No Android/iOS SDK, emulator or simulator is used. Narrow/tablet checks resize a desktop browser window; they are not physical-device acceptance.

The test server binds only loopback ports 54110/54111, refuses populated databases, seeds clearly synthetic accounts/capabilities/usage, waits for complete fixture readiness and removes the fixture schema on graceful shutdown. `.test/fixtures.json`, screenshots, browser downloads and traces are ignored artifacts. Never use real user accounts or production database URLs. Run builds before browser tests, not concurrently with the production server serving that build output.

See `../docs/features/dashboard.md` and `../docs/validation/phase-4.md` for behavior, boundaries and verification.

## Phase 7 Developer Tools

Connected paired-computer inventory, owner-managed controller grants, separately confirmed graceful/force requests, cancellation and audited outcomes use the real API. Pending/accepted never mean confirmed shutdown. The browser regression publisher is explicitly synthetic; native execution is verified separately. See [verification](../docs/validation/phase-7.md).

Phase 10 Networks now separates manual labels from monitored networks. It supports named private subnets, collector grants, encrypted router setup/test state, uncertain inventory/history, labels/association hooks, WAN coverage/history, event review and compatibility feedback. Viewer actions remain read-only; no router secret is returned by read APIs. Synthetic browser fixtures do not certify hardware. See [network validation](../docs/validation/phase-10.md).

Phase 11 Family navigation uses real scoped API profiles, consent, policies, schedules, child requests/guardian decisions, reports/feedback and action history. Viewers have no child-profile access; guardian membership alone grants none. Saved restrictions remain unsupported intent, with no applied claim. Browser fixtures never execute restrictions. See [family validation](../docs/validation/phase-11.md).

Phase 16 adds account email opt-in and an email rule channel with visible delivery-disabled states. The dashboard uses Tailwind CSS 4 via PostCSS and `@theme` tokens alongside custom CSS. No alert-email transport is enabled.

## Public product homepage

The approved storytelling homepage uses Tailwind CSS 4 and local product UI assets. Dashboard, Android, iOS and desktop showcases stay upright and aligned; previews can be enlarged and desktop screens can be switched. Captions identify empty/synthetic states and native release limitations. The homepage makes no monitoring API requests. Sign in opens `/app`; verification/reset URLs are unchanged, and old `/?view=…` workspace bookmarks redirect with their queries intact.

Run `npm --prefix dashboard run test:homepage` after building to check the public page without a test database. Set `PLAYWRIGHT_CHROME_EXECUTABLE` to an existing browser when needed. See [public website architecture](../docs/architecture/public-website.md) and [validation](../docs/validation/public-homepage.md). Documentation, legal, contact, pricing and download pages remain separate work.

## Product Overview

Open `/product` for the approved product feature page, also linked from the homepage. It explains devices, reports/alerts, family/team sharing, developer tools, application roles and privacy. The responsive feature explorer supports pointer and keyboard navigation. Screens stay upright, buttons have no arrows, and availability/preview captions distinguish designs from released apps or live reports.

Run `npm --prefix dashboard run test:public` after building for the homepage and product-page browser checks without a database. `test:homepage` remains an alias for the same public suite. These checks cover cross-page navigation, responsive layouts, tab keyboard behavior, screenshot assets and platform availability disclosure. See [Product Overview validation](../docs/validation/product-overview.md).

## Applications guide

Open `/applications`, linked from the homepage and Product Overview, to compare the web, Android, iOS and desktop apps. The guide implements the approved simple design with straight screens, enlarged previews, a desktop screen switcher, an accessible app-role comparison, setup guidance and availability FAQs. Native screenshots remain labelled design reconstructions; downloads are not advertised before native release validation.

`npm --prefix dashboard run test:public` now checks all three public pages, including navigation, preview dialogs, keyboard focus, mobile comparison scrolling and responsive layouts. See [Applications page validation](../docs/validation/applications-page.md).

## Solutions guide

Open `/solutions` for the approved personal, family, team and developer use-case page. The guide uses straight screenshots, conceptual family/team diagrams, links to relevant applications and explicit consent/platform boundaries. It is linked from public navigation and the homepage's “Who it’s for” footer.

`npm --prefix dashboard run test:public` checks all four public pages, including Solutions section links, previews, responsive navigation and availability disclosures. See [Solutions page validation](../docs/validation/solutions-page.md).
