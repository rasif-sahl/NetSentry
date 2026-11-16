# Native Android personal application

Standalone Kotlin/Jetpack Compose source in root android/. The Flutter reference in mobile/ is preserved. Phase 8 adds account/session, workspace, phone enrolment/consent, OS network-statistics adapters, a bounded sync queue, usage/allowance/notification/privacy screens and remote developer-service requests.

The application is source implemented; Android/Compose compilation, APKs, signing and device behavior remain unverified. No Android Studio, mobile SDK, emulator, simulator or Xcode was installed. Standalone Kotlin/JDK checks are separate from an Android build.

## Source layout

| Directory | Responsibility |
| --- | --- |
| app/.../core | HTTPS address, time/window, generation/retry and remote-intent rules; no Android dependencies |
| app/.../data | Strict HTTP adapters, serialized account refresh, shared JSON wire builders, private repository and encrypted atomic storage |
| app/.../monitoring | Usage-access checks, NetworkStatsManager, metadata, explicit WorkManager scheduling |
| app/.../ui | Compose account, phone, usage, computers and privacy/settings flows |
| test | Synthetic JVM adapters, real HTTPS/API integration and Kotlin syntax checks |
| scripts | SDK-free checks using explicitly supplied JVM tools |

## Development checks without mobile tooling

Root `npm run check` includes validation of Kotlin-emitted synthetic wire fixtures. Prepare only existing contracts/backend Node dependencies as documented at root; it installs no native tools. For stronger checks supply a standalone Kotlin 2.1.20 compiler, JDK 17, org.json 20250107, OkHttp 4.12.0 and Okio JVM 3.6.0 jars:

```sh
JAVA_HOME=/absolute/path/to/jdk17 \
KOTLINC=/absolute/path/to/kotlinc/bin/kotlinc \
JSON_JAR=/absolute/path/to/json.jar \
OKHTTP_JAR=/absolute/path/to/okhttp.jar \
OKIO_JAR=/absolute/path/to/okio.jar npm run test:android-core
```

This compiles the actual platform-independent repository/HTTP/wire/policy code, runs behavioral tests and shared-schema checks, and parses every Kotlin source file. Parsing does not resolve Android/Compose APIs. No Android framework, UI renderer or Keystore is substituted and claimed verified.

After backend build, the same variables plus a disposable empty `TEST_DATABASE_URL` ending in `_test` and `TEST_DATABASE_SSL=false` enable `node android/scripts/check-live.mjs`. It uses the existing explicit synthetic fixture backend, ephemeral loopback TLS certificate/truststore and actual Kotlin HTTPS adapters. It deletes its fixture schema and temporary certificate material afterward. Readings and desktop observations are synthetic; remote requests are cancelled, never executed. Do not run alongside dashboard E2Es because both use the fixture API port 54110. The isolated Foundation workflow has a separate JVM-only job with checksum-pinned tooling and no Android setup.

## First use on a real phone, after tooling is explicitly prepared

1. Configure a reachable deployed HTTPS API URL ending in /api/v1. No production URL or credential is embedded. Invalid TLS and redirects fail closed; no cleartext development exception is configured. Sign in/register, then verify email with the emailed token before pairing/collection.
2. Select a workspace, read its enrolment disclosure, name and enrol this installation. Enrolment starts with collection off. Account and device credentials are separate.
3. Review usage access in Android Settings. Read monitoring-v3 and explicitly enable **network_usage**. Network-only enrolment never grants app usage. The separate app-usage-v1 checkbox adds app_usage with fresh consent. Permission checks and current server configuration still gate collection. Android declares special usage access; that declaration is not the user's grant.
4. Use the Phone tab to collect/sync or manage pause, consent revocation, unenrolment and erasure. Server mutations need connectivity; a local stop plus an error does not mean the server action succeeded. Fresh consent is required to restart after a stop. Revoked credentials require enrolment again.
5. Usage shows daily, Monday-based weekly and month-to-date reports in workspace time. Missing remains unknown and estimates are separate. Allowances choose estimated or measured totals explicitly; sources are never added together. In-app alerts require scheduled server maintenance. Push registration/providers are not implemented.
6. Computers shows consented project/runtime/port summaries, separate graceful/force confirmations, optional captured descendants, cancellation and audited outcomes. Named grants must be configured on the web and consent enabled on the paired desktop. Pending/accepted are unconfirmed. Commands never enter the measurement offline queue.

## Collection, privacy and limits

NetworkStatsManager queries device-wide mobile/Wi-Fi receive+transmit totals with a null subscriber ID. No phone-state permission, subscriber ID, SSID, location, contacts, messages or installed-app inventory is requested. Queries execute off the UI thread and handle absent/denied/failed readings as missing. OS bucket attribution is labelled estimated until actual device comparison establishes its limits. No billing-grade accuracy is claimed.

The API 35 baseline has no verified public global tethering state/client source here. Hotspot state, client identity/count and per-client traffic remain explicitly unavailable, with a wireless-settings link. No hidden API/reflection, privileged tether control or client inference from phone totals is used. A later API 36 implementation can assess the public tethering callback separately.

Collection is opt-in. WorkManager's 15-minute schedule is best effort, with no foreground service, exact alarm or automatic battery exemption. Local Android permission is checked before every pass. Offline collection uses the last acknowledged generation for at most 24 hours; online reconciliation discards stale-generation data rather than relabelling it. Revocation cannot be discovered while disconnected; the server rejects stale work on reconnection. Completed intervals lag two minutes, span at most 24 hours, and never start before consent. No pre-consent backfill is performed.

The encrypted queue holds at most 48 batches for seven days, with fixed batch/event UUIDs, eight upload attempts, bounded exponential delay/jitter and bounded integer Retry-After guidance. Exhausted uploads need explicit retry; capacity pauses new collection without overwriting oldest pending work. Expired/backlogged windows remain missing. Pause/revocation/erasure/sign-out clears local queued data; no remote command is replayed offline.

One process-scoped repository serializes foreground/worker operations and refresh rotation. Tokens, binding and queue persist together in an AES-256-GCM atomic file under noBackupFilesDir; keys live in Android Keystore. Invalidated/missing keys fail closed and offer explicit local clear. Sensitive input is not saved in Compose saved state; screenshots are blocked. Export requires the current password and an explicit document destination. Copies the user saves and server backups have separate retention. Local clear/sign-out does not substitute for server device revocation/deletion.

## Build and signing handoff — pending

Pinned source baseline: API 26 minimum, compile/target API 35, AGP 8.9.2, Gradle 8.11.1, Kotlin/Compose compiler 2.1.20, JDK 17. Dependencies add lifecycle 2.9.0, coroutines 1.10.2 and WorkManager 2.10.1 alongside the existing Compose pins. These pins have not been resolved by an Android build here and are not a store eligibility claim.

When mobile tools are explicitly authorized/prepared, use Gradle 8.11.1 to generate and verify its wrapper/distribution checksum, resolve these dependencies, then run `:app:lintDebug :app:assembleDebug` before device installation. There is no wrapper binary or SDK provisioning script in this repository. Debug uses `com.netsentry.app.native.dev`, allowing side-by-side testing with Flutter. Release remains `com.netsentry.app`; do not replace the Flutter reference before native acceptance.

Release signing remains intentionally unconfigured. Keep keystore/passwords outside Git, configure signing through protected local/CI secrets, verify the signing certificate and APK/AAB, review current target/store policy requirements, then test on actual devices. Never commit a signing key or assume a paid account exists. Follow [Phase 8 device checklist](../docs/validation/phase-8.md).

## Phase 9 application monitoring

The Apps tab adds event-derived screen/foreground intervals, first/last observed use, observed foreground-entry counts, per-device/app/category reports, comparisons, trends, filtered CSV, locally permitted icons and quality-labelled policy progress. Enable the separate app-usage-v1 choice on Phone; network consent alone cannot upload detailed history. Counts are warm/foreground entries under a documented debounce/context rule, not verified cold launches. Missing context stays unknown. Native OS accuracy is unverified.

Observed-package metadata uses permitted PackageManager access only. Unknown remains unknown, OS category scores are heuristic, owner corrections/custom categories are explicit, and icons/activity identities are never uploaded. Screen time is a union, not the sum of concurrent app foreground. Late night is 22:00–06:00 in workspace time. Detailed queries span at most six hours; historical capture looks back at most 24 hours. Raw timeline views are bounded to seven-day reports; aggregate reports survive raw retention.

The shared queue now also enforces a one-megabyte JSON budget and drains up to four batches per pass. Permission withdrawal persists a health-only acknowledgement until reconnection without restarting collection. Separate alerts distinguish no heartbeat, no accepted usage report and revoked permission. Starting the API does not schedule evaluation/delivery. OkHttp 4.12.0 uses verified TLS, no redirects/connection recovery and one-shot mutation bodies; standalone HTTPS checks cover PATCH and response-loss policy.

Apply the eleventh backend migration. Catalogs are bounded to 256 apps/twenty custom categories; current catalog data remains until erasure. Raw event windows follow raw retention and daily summaries aggregate retention. Device/account erasure includes all new stores. See [advanced design](../docs/architecture/android-application-monitoring.md) and [Phase 9 device checklist](../docs/validation/phase-9.md). The native version is 0.9.0; Android dependency resolution, APK builds and all device behavior remain pending.

Phase 11 adds Family views, device-owner sharing consent/withdrawal, observed summaries and child time requests/guardian decisions. `FamilyWire` can emit only unsupported/not-requested receipts and rejects stale generations or claimed applied authority. Policy sync does not restart collection; credential revocation still clears pairing. Consumer Android does not gain device-owner/delegate authority from usage access. SDK-free checks are separate from native compilation, Compose type checking, notifications and real phone behavior; all those remain pending.

Phase 13 adds a Business employee view and account-scoped sharing acceptance/withdrawal against the displayed assignment revision and device generation. Organization administration stays in the web dashboard. Employee/network-administrator refresh avoids the unavailable Developer Tools route; server roles still authorize every request. Sharing does not start monitoring or grant UsageStats access. Existing standalone JVM checks cover Business scope/consent/data clearing, and HTTPS integration uses synthetic organization fixtures. Native Compose compilation, physical BYOD acceptance, offline revocation delivery and actual device collection remain pending; no Android tooling was installed.

Phase 14 adds a read-only Subscription tab for selected-workspace entitlement status and limits. It does not initiate native or external purchases or grant monitoring permissions. SDK-free repository/HTTPS checks are separate from pending Android/Compose builds and physical-device acceptance.

Phase 15 adds [the physical-device build/test handoff](../docs/release/android-device-testing.md), candidate-bound evidence and a read-only existing-tool prerequisite inspector. No APK or Android native build is claimed; use an independently prepared build host while this repository retains its no-install constraint.
