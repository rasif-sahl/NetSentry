# Phase 7 verification record

Date: 16 November 2026. Implemented directly on develop, with separate backend, Go, desktop, web and shared-contract commits pushed to origin/develop.

## Delivered source

Explicit paired-computer sharing/controller policies, bounded service synchronization, expiring identity-bound commands, one-use execution authorization, idempotency, cancellation, audit and lifecycle/privacy cleanup are implemented in NestJS/PostgreSQL. Go delivers commands through outbound connections, persists uncertain receipts before execution, rechecks native identity and macOS wall-clock deadlines, and reports confirmed outcomes. React desktop provides separate sharing/shutdown consent; the web provides paired inventory, controller grants, confirmation and command history. Shared OpenAPI/mobile flow contracts prepare Kotlin/Swift clients.

Optional long-running reminders are deferred pending operational soak and notification design. Native mobile screens are subsequent phases, not delivered or validated here.

## Local verification

- Root `npm run check` passed: scaffolds, eleven generic fixtures, 86 API operations, backend build and 39 tests across eleven suites, desktop types/production build, dashboard lint and production build. Backend lint passed. The final shared-contract suite passes thirteen tests, including remote input rejection of arbitrary PID/shell fields.
- Isolated PostgreSQL 14.20 clean migration, rollback, adoption, schema-drift and cascade checks passed with ten migrations. Actual API checks covered policy/role isolation, duplicate requests, leases, cancellation, expiry, audit, outcomes, export and erasure.
- Actual NestJS/PostgreSQL → outbound Go → native controlled Node listener shutdown → confirmed API outcome passed twice on macOS 27.0.1 arm64. An unrelated listener stayed alive. Offline cancellation and expiry survived reconnection without shutdown. This uses private temporary loopback credentials and real controlled processes, not production monitoring data.
- Existing Go 1.27.4 toolchain: race-enabled suite and native build passed, including observation isolation, durable receipts, consent/pause/revocation and final wall-clock guard. Existing local process/socket/child/replacement regressions remain covered.
- Actual authenticated Node–Go setup and developer IPC integration passed. Its backend is an explicit configuration fixture, separately from the real API pipeline above.
- All twenty browser scenarios passed against isolated PostgreSQL, including remote pending/cancelled presentation and read-only viewers. Web service data is an explicitly synthetic publisher; this browser test does not claim a native shutdown. The report test now sums legitimate local-day buckets across midnight. Responsive checks wait for layout after viewport resize.
- Desktop Chrome fixture checks passed independent default-off consent, disclosure, saving, sharing withdrawal and 640px overflow checks. Native Electron was not launched. Screenshots were inspected separately from native process checks.

## Hosted checks

The Foundation checks workflow verifies backend/contracts with PostgreSQL, desktop, dashboard browser flows, and Ubuntu/macOS agent jobs. The macOS agent job exercises actual controlled native services; Linux reports native controls unavailable. Real backend/native remote shutdown was verified locally on macOS; hosted Linux API tests exercise the synthetic remote state machine and existing real Go pairing lifecycle. Final workflow outcome is recorded in the task handoff.

## Commit breakdown

| Commit | Feature/platform |
| --- | --- |
| 88412a8 | Explicit computer grants, expiring commands, audit/privacy and API contracts |
| 6fc5490 | Outbound Go delivery, receipts, consent and IPC v4 |
| c6bb813 | macOS wall-clock check at signal boundary |
| d69a903 | Desktop sharing and remote shutdown consent |
| a2b1f25 | Web inventory, controller grants, confirmations and outcomes |

## Pending acceptance and operation

Native Electron/preload plus Keychain in a signed package, Windows/Linux native adapters, real phones, different networks, sleep/suspend behavior, long operational soak, distribution/update/background installation and mobile notifications remain pending. A receipt reporting unknown is not confirmed shutdown. Sleeping and offline cannot be reliably distinguished and no wake feature is provided. Production operators must apply migrations and schedule bounded retention passes; no deployment or persistent service was installed.

No Android Studio, mobile SDK, emulator, simulator or Xcode was installed. android/, ios/ and the existing Flutter reference mobile/ are unchanged. See [remote architecture](../architecture/remote-service-commands.md) and [native mobile flow](../../contracts/REMOTE_MOBILE_FLOW.md).
