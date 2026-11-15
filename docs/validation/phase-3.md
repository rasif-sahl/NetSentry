# Phase 3 verification record

Date: 2026-11-15. Work was performed directly on `develop`, in separate feature commits, and pushed to `origin/develop`.

## Implemented source

- Device-authenticated, atomic measurement/gap batches with source, consent, capability, generation and retention checks; exact deduplication and overlap protection.
- Exact micro-unit local-day aggregation, proportional split indicators and DST-aware day/week/month reports, prior-period comparisons, separate measured/estimated values, missing coverage and historical gap declarations.
- Scoped report/CSV export APIs, personal monitoring export, bounded retention policies with effective dates, independent cleanup and manual network labels/assignment.
- Measured threshold and reported-device health rules, severity, device/network scope, acknowledgement, quiet hours, in-app notifications, durable attempt history, bounded retries and current preferences/permissions.
- Explicitly unavailable Android/iOS push adapters, safe diagnostics and a one-pass operator command for evaluation, delivery and retention.
- Raw/derived-data and contributing-alert deletion wired into device/account lifecycle. Removed/downgraded members lose their queued rules/alerts.
- Three new explicit migrations: measurement pipeline, alert delivery, retained interval indexes. The last migration pauses existing monitoring settings and requires the current monitoring-v3 disclosure. Minimal synchronization metadata retention is disclosed separately from raw observations.

Feature commits:

| Commit | Change |
| --- | --- |
| f667d21 | Collect usage batches without counting uploads twice |
| 3e878d2 | Show usage history with honest gaps and retention controls |
| 3dbd78e | Add quiet-hour alerts and dependable in-app notifications |
| 4875a95 | Keep expired uploads from being counted again |

## Local verification

- `npm run check` passed: scaffold checks, shared contracts, nine contract tests, backend build, 39 backend unit tests across 11 suites, desktop type checks and production build.
- Backend type-aware lint passed without warnings.
- Seven synthetic fixtures and all 64 OpenAPI operations compiled/validated. OpenAPI is pre-release version 1.3.0.
- Disposable PostgreSQL 14.20 migration checks passed: schema agreement, all-eight-migration round trips, uniqueness/cascades, drift refusal, legacy baseline adoption, populated receipt-index backfill and renewed-consent migration behavior.
- Live loopback API integration checks passed, with actual responses validated against operation/status schemas.
- Ingestion checks cover duplicate/concurrent replays, changed content, overlapping intervals, unauthorized source, UTC midnight splits, explicit gaps, injected aggregation failure/atomic rollback, recovery, stale generations, credential invalidation and data erasure.
- Reports cover day/week/month totals, sources, missing values, invalid dates, CSV, tenant/device isolation, and spring/autumn 23/25-hour days in America/New_York.
- Retention checks cover independent raw expiry, retained aggregates, prevention of recounting after raw cleanup, injected failure/rollback, failed-job diagnostics and subsequent recovery. The actual operator command is invoked as a child process and verified for nonzero failure status and a successful subsequent pass.
- Alert checks cover measured-only thresholds, concurrent evaluation, acknowledgement/deduplication, overnight/DST quiet hours, unavailable push providers, stable delivery idempotency keys, transient recovery, the five-attempt ceiling, changed preferences, health triggers, network scope and membership downgrade cleanup.
- Personal exports are checked with populated monitoring rows and exclude synchronization hashes and credentials. Device erasure removes contributing shared alerts as well as device rules/data. Existing account export/deletion and credential invalidation checks still pass.

All database/API checks used disposable databases ending in `_test` on an already-installed local PostgreSQL server, with synthetic accounts/capability reports/usage. No project/production data was migrated. Tests remove their fixture schemas. The temporary local PostgreSQL service is shut down after verification.

## Hosted verification

The four implementation commits passed GitHub's Foundation checks. The final implementation run [43716596744](https://github.com/rasif-sahl/NetSentry/actions/runs/43716596744), at 4875a95, passed all three jobs: contracts/backend with PostgreSQL 17 and live API/migration checks, desktop compilation, and Go formatting/vet/test/build plus capability-output validation. The final documentation/maintenance-command check commit also triggers the same workflow.

No deployment, external email, push provider request, router scan or service-control command was performed. Local Go verification was supplied by CI's existing Go setup; no new local toolchain was installed.

## Remaining platform and deployment acceptance

- Native measurement collectors, truthful capability detection, secure storage, bounded persistent local queues and device-side revocation/deletion enforcement remain in the Android/iOS/agent phases.
- Dashboard and native report/notification screens remain their UI phases. A delivered in-app row is backend availability, not a completed mobile UI.
- Android/iOS push adapters report unavailable. Secure token registration, configured FCM/APNs providers, provider idempotency and actual-device delivery acceptance are pending.
- Deployment must schedule recurring one-pass jobs per workspace, monitor failures/backlogs, repeat bounded cleanup passes, and define backup expiry. No scheduler or daemon is installed by this phase.
- Manual network labels do not implement discovery, router authentication or verified traffic attribution. Router/Go-agent measurements cannot use the mobile credential path.
- Edition-specific retention entitlements and full platform administration remain later phases; current retention limits are infrastructure bounds.
- Android, iOS, Flutter and Go scaffold source were preserved. No Android Studio, mobile SDK, emulator, simulator or Xcode was installed. Physical-device checks remain pending as requested.
