# Phase 8 verification and device handoff

Date: 16 November 2026. Work is directly on develop, with plain-language feature/platform commits pushed to origin/develop. No mobile SDK, Android Studio, Gradle distribution, emulator, simulator or Xcode was installed or invoked. Temporary standalone Kotlin 2.1.20 and Temurin JDK 17 tooling supports JVM-only checks.

## Source delivered

Kotlin/Compose account registration/sign-in/verification/recovery, workspace selection, separate user/device credentials, Keystore-backed encrypted atomic state, explicit phone enrolment and network consent, capability/health metadata, pause/revoke/erase/remove, usage/battery settings guidance, permission-gated aggregate mobile/Wi-Fi queries, bounded offline synchronization, report periods/coverage, quality-specific allowances/in-app notifications, privacy export/deletion and paired-computer remote request/cancel/outcome screens.

Backend thresholds add explicit optional quality selection with measured default; estimated rules remain separate and snapshots retain their quality. Web editors/display preserve the selection. No migration is needed because config/snapshot use existing JSON stores. OpenAPI is 1.8.0 with 86 operations. Native iOS and Flutter source remain unchanged.

## Available verification

- Standalone JDK/Kotlin compiles actual platform-independent Policy, Wire, Api and Repository source and runs 22 behavioral checks. Coverage includes independent consent, generation/time/queue bounds, offline capture, exact payload replay after lost acknowledgement, permission withdrawal, device/session revocation, refresh rotation, remote freshness/grants and no offline command queue.
- Kotlin PSI parses all ten app Kotlin source files. Syntax parsing is **not** Android/Compose type checking or an APK build. Shared AJV checks validate actual Kotlin-emitted synthetic measurement/capability/remote payloads.
- Actual Kotlin HTTPS adapters run through an ephemeral trusted loopback certificate to actual NestJS/PostgreSQL. Account/workspace, enrolment, consent, estimated upload/report, allowance creation, remote pending/cancelled outcomes, erasure and sign-out pass. The OS source and desktop publisher are explicit synthetic adapters. A synthetic clock offset exercises the accounting delay without pre-consent timestamps; this does not test phone clocks or native collection.
- Actual backend API/PostgreSQL integration passes estimate opt-in/default measured isolation, no mixed-source sum, labelled exact value, repeated evaluation deduplication, in-app delivery and derivative erasure, alongside existing lifecycle/privacy/remote/native macOS regressions.
- Root checks pass shared schemas/fixtures, 13 contract regressions, backend build and 39 tests across eleven suites, desktop types/build and web lint/production build. Browser regressions and hosted final outcomes are recorded in the task handoff.
- Hosted Foundation checks add a standalone JVM/source/API job. It installs no Android tooling, invokes no Gradle/native build and uses no emulator. Existing macOS native agent checks remain separate from Android acceptance.

## Physical-device acceptance — all pending

1. Prepare authorized JDK/Gradle/Android SDK tooling separately. Resolve dependency pins, generate/verify the wrapper, run native lint and compile/package. Confirm minimum API 26 and current target compatibility. Debug package suffix must allow Flutter side-by-side installation.
2. Review signing/target-store requirements, keep credentials outside Git and verify release artifacts. No release is signed, distributed or store-certified here.
3. Test registration, verification, reset, expired/revoked sessions, refresh response loss, account/workspace switching and cross-account data clearing. Inspect logs, crash diagnostics, screenshots, backups and export destinations for secrets. Test Keystore loss/invalidated keys and explicit local recovery.
4. Test enrolment/re-enrolment, user/device credential isolation, current disclosure, role/membership loss, local and server pause/revoke, offline erasure/reconnect and generation changes. No pre-consent backfill or stale resurrection should occur.
5. Compare mobile/Wi-Fi totals against Android Settings on multiple real Android/OEM versions, including dual SIM/eSIM, no SIM, VPN, roaming, resets, reboot, zero usage, denied/revoked usage access and transient OS query failure. No accuracy is claimed until this passes. Hotspot/client information must remain unavailable on the current baseline.
6. Verify day/week/month timezone and DST boundaries, exclusive end dates, estimates versus measured/null, allowance quality labels, threshold maintenance/deduplication/acknowledgement and quiet-hour/delivery behavior. Push must remain unavailable.
7. Test offline queues, airplane mode, delayed acknowledgements, 429/5xx, eight attempts/manual retry, capacity/age expiry, clock rollback, process death, restart, force-stop, reboot, doze/battery restrictions and 24-hour cached authorization. Verify missing windows are not invented as zeros.
8. Test Compose small/large screens, rotation, keyboard, scrolling, TalkBack, contrast and focus/dialog recovery. Native UI was not rendered in this phase.
9. Pair an authorized actual desktop and test phone → HTTPS API → outbound agent shutdown across intended networks, separate force confirmation/children, unrelated-process preservation, stale targets, grant withdrawal, cancel/start races, sleep/offline expiry, supervisor replacement and unknown/late outcomes. JVM request/cancel integration does not satisfy this phone test.

Optional long-running developer reminders, screen/app usage, advanced insights, push delivery and wider desktop platform controls remain their later phases. Deployment must apply existing migrations and schedule monitoring/agent retention workers; no deployment or daemon was installed. See [Android setup](../../android/README.md), [architecture](../architecture/android-personal-client.md) and [remote mobile contract](../../contracts/REMOTE_MOBILE_FLOW.md).
