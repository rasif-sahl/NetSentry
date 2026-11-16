# Phase 4 verification record

Dates: 2026-11-15–2026-11-16. Development used `develop` directly and separate human-readable feature commits pushed to `origin/develop`.

## Delivered source

The responsive dashboard now connects account/workspace, device, usage/report/export, alert, network-label, team, profile, session, privacy and settings flows to the Phase 2–3 APIs. Preview arrays, simulated scanning, security scores and protection claims were removed. Unimplemented domains use explicit planned states.

The browser gateway uses documented-route filtering, same-origin JSON mutations, HTTP-only cookies, backend authorization and a stale-actor fence. Credentials never enter JavaScript-visible storage. Cross-tab changes discard old views; delayed profile responses cannot recreate an old user. User/workspace read changes are aborted and protected data clears on authorization failure.

| Commit | Feature |
| --- | --- |
| f49a79b | Bring real sign-in and workspace sessions to the dashboard |
| 13a1b09 | Show reported devices and usage instead of preview numbers |
| 9959fc5 | Make alerts and notification preferences usable in the dashboard |
| 47deac1 | Let teams create workspaces and manage shared access |
| 970b809 | Put profile, privacy and account controls in the dashboard |
| 1b67b47 | Keep account changes from leaking stale data across browser tabs |
| b21e754 | Wait for both tabs before testing shared cookie expiry |

See `../features/dashboard.md` for exact UI scope and `../../dashboard/README.md` for setup and limits.

## Local results

- `npm run check` passed: scaffold checks, seven shared fixtures/64 API operations, nine contract regressions, backend compilation and 39 tests across 11 suites, desktop type/production build, dashboard lint and dashboard production build/type validation.
- Separate dashboard type checks and lint passed without warnings.
- All 19 Playwright end-to-end scenarios passed against the production dashboard, actual NestJS API and disposable PostgreSQL 14.20. The corrected concurrent-expiry scenario also passed ten consecutive repeated runs.
- Browser tests used the already-installed desktop Google Chrome. The narrow layout resizes that desktop browser to 390×844; it does not provision or emulate a mobile operating system.
- Desktop network-label and narrow dark-theme layouts were visually inspected. The narrow layout has no page-level horizontal overflow; drawer focus/Escape restoration and browser back navigation passed.
- Webpack with Tailwind's standard PostCSS integration replaced the Turbopack loader path after local worker-port failures. System fonts remove build-time external font fetches. Dependency preparation uses ignored install scripts.
- Builds and browser tests are run sequentially: rebuilding a production directory while its test server is serving it invalidates Next.js manifests. The final browser pass ran after the complete workspace build and passed.

The browser scenarios exercise:

1. Sign-in, HTTP-only/SameSite cookie storage, restoration and sign-out.
2. Cross-origin mutation rejection and blocked browser device-credential routes.
3. Failed credentials and useful error feedback.
4. Real inventory, search, reported OS restriction/capability reasons and rename.
5. Exact measured/estimated values, source versions, CSV download and cleared workspace switches.
6. Viewer restrictions and actual denial of another device's report.
7. Recoverable report connection errors.
8. Explicit manual network labels and creation.
9. Delivered notifications, acknowledgement, threshold/quiet-hour rule create/edit and preferences.
10. Concurrent access-cookie expiry/refresh across fully loaded tabs.
11. Recipient-bound invitation acceptance, role change and immediate removal denial.
12. Verified-user workspace creation/timezone/selection.
13. Persisted profile/appearance/reduced-motion, retention, session revocation, personal export and shared-owner deletion refusal.
14. Verification/reset fragment handling, one-time code consumption and login after password recovery.
15. Registration and password-confirmed account deletion, including cookie removal.
16. Disclosure acceptance, consent, pause, revocation and device-data erasure.
17. Narrow-window keyboard navigation, future-module states, browser history and no page overflow.
18. A delayed authorized response held until another tab signs out, followed by a different account login with no stale-user restoration or mixed reports.
19. A stale expected-actor mutation rejected without applying profile changes, and oversized request rejection.

The fixture server is a separate loopback-only test script. It refuses populated databases, waits for complete seed readiness, uses synthetic accounts/capabilities/usage and removes its application schema on shutdown. Only its rate counter is replaced because repeated tests share loopback IPs. Production throttling, authentication, ownership and domain guards are unchanged. No real email, push call, network scan, native collector or process-control operation ran. The temporary local PostgreSQL service was shut down after verification.

## Hosted verification

The Foundation workflow now has a fourth `dashboard` job in addition to contracts/backend, desktop and Go agent checks. It builds the actual web/backend source, prepares desktop Chromium in the isolated runner and runs browser flows against disposable PostgreSQL 17. Failure traces/screenshots contain synthetic fixtures and have seven-day artifact retention. No workflow step installs a mobile platform or deploys the application.

The first five feature commits passed their hosted checks; dashboard browser verification was added with 9959fc5. Run 43723671062 exposed a test precondition race: cookies were removed while the second tab was still fetching initial data, followed by navigation during one-use rotation. The test now waits for both tabs to finish loading before expiring cookies. Final source run [43785567115](https://github.com/rasif-sahl/NetSentry/actions/runs/43785567115), at b21e754, passed all four jobs, including all nineteen browser scenarios on PostgreSQL 17 and desktop Chromium.

## Deferred acceptance and deployment

- Lost one-use refresh responses can require signing in again. Refresh tokens are not replayed to weaken backend revocation.
- Actual native pairing, collection, secure native storage, background/permission behavior and physical-device tests remain in their platform phases. Android/iOS/Flutter/Go source was preserved.
- No Android Studio, Android/iOS SDK, emulator, simulator or Xcode was installed. Only web development/test dependencies were added locally; local browser tests reused desktop Chrome.
- Real email delivery still requires configured SMTP; real Android/iOS push requires token/provider/native implementation and physical acceptance. Test messages remain queued only in disposable fixtures.
- Alert evaluation/delivery/cleanup must be scheduled through the Phase 3 maintenance process; a web screen does not install or run it.
- Production needs reviewed HTTPS origins/ingress, rate policy, monitoring/backups, load checks and larger archive handling. The current gateway limits requests to 64 KiB and response envelopes to 16 MiB with a 20-second upstream timeout. IP-based backend rate limits currently aggregate at the dashboard proxy address.
- Chromium/Chrome integration and the inspected desktop/narrow layouts passed. Broader Safari/Firefox, tablet/assistive-technology and physical-device acceptance remain follow-ups; no comprehensive accessibility certification is claimed.
- Full network/router discovery, policy enforcement, Family/Business profiles, subscriptions, audits and developer server control remain their agreed phases and are shown as planned.
