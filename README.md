# NetSentry

NetSentry is being built for device/network monitoring, family digital wellbeing, business network management and developer service monitoring. Features are enabled only when the platform, permissions and integrations support them.

## Applications and shared components

| Directory | Technology | Current role |
| --- | --- | --- |
| `backend/` | NestJS, TypeScript, PostgreSQL/TypeORM | Account, workspace, enrolment, health/consent and privacy APIs |
| `dashboard/` | Next.js, React, TypeScript, Tailwind CSS | Connected account/workspace, monitoring, team and privacy UI; later domains are explicitly planned |
| `android/` | Kotlin, Jetpack Compose | Personal-client source, secure sessions, consented usage/sync and remote commands; native build/device checks pending |
| `ios/` | Swift, SwiftUI | Account/report/family and confirmed desktop-control source; optional Apple control extensions; native build/device gates pending |
| `desktop/` | Electron, React, TypeScript, Vite | Agent pairing/status/preferences plus macOS discovery and separate local/remote consent |
| `agent/` | Go | Shared foundation plus owned macOS TCP service discovery/project mapping and authorized local/remote controls |
| `contracts/` | JSON Schema and synthetic fixtures | Versioned API/measurement/capability/IPC contracts and synthetic fixtures |
| `docs/` | Markdown | Architecture, backlog and verification records |
| `infra/` | Infrastructure configuration, introduced as needed | Setup boundaries; no services provisioned yet |
| `mobile/` | Flutter/Dart | Preserved reference application; not the target mobile stack |

New native projects do not use the Flutter-owned `mobile/android/` or `mobile/ios/` folders.

## Development constraint

Do not install Android Studio, Android/iOS emulators or simulators, mobile SDKs, Xcode or other mobile platform tooling during this stage. Develop native source and contracts now; the user will perform physical-device tests later. Do not claim native compilation/device verification until those checks actually run. The repository commands below do not provision mobile tools or launch mobile runtimes.

No command automatically starts monitoring, installs a persistent agent, stops processes, provisions cloud resources or changes database schemas in Phase 0.

## Local commands

Use an existing Node.js 24 toolchain. Applications keep independent package files/lockfiles; the root package has no dependencies and is not an npm workspace that installs every application together.

```sh
npm run check
npm run check:scaffolds
npm run check:contracts
npm run test:contracts
npm run build:backend
npm run test:backend
npm run dev:backend
npm run dev:dashboard
npm run check:desktop
npm run build:desktop
```

The contracts checks require `npm --prefix contracts ci --ignore-scripts` when preparing a fresh checkout. `npm run check` checks scaffolds/contracts, runs contract/backend units, lints the dashboard, and builds backend/desktop/dashboard; it does not install dependencies or mobile tools.

Backend commands require its existing dependencies; server/integration tests require the configured PostgreSQL environment. `dev:dashboard` uses port 3001 to match the existing API CORS example. Desktop checks require its prepared dependencies. If preparing them later, use `npm --prefix desktop ci --ignore-scripts` to avoid running dependency installers. Electron's runtime binary is intentionally not installed by this command; see `desktop/README.md` before desktop launch. Standard first-use backend/dashboard dependency installation is separate and is not performed by root commands.

Agent commands require an existing Go 1.23+ toolchain. Native build/signing commands are deliberately absent from the root scripts. See individual component READMEs for prerequisites and pending checks.

## Planning and verification

- [Complete development plan](DEVELOPMENT_PLAN.md)
- [Phase 0 architecture decisions](docs/architecture/phase-0-decisions.md)
- [Phase 1 verification](docs/validation/phase-1.md)
- [Phase 2 verification](docs/validation/phase-2.md)
- [Phase 3 verification](docs/validation/phase-3.md)
- [Phase 4 verification](docs/validation/phase-4.md)
- [Phase 5 verification](docs/validation/phase-5.md)
- [Phase 6 verification](docs/validation/phase-6.md)
- [Phase 7 verification](docs/validation/phase-7.md)
- [Phase 8 verification and device handoff](docs/validation/phase-8.md)
- [Phase 9 verification and device handoff](docs/validation/phase-9.md)
- [Advanced Android application monitoring](docs/architecture/android-application-monitoring.md)
- [Android personal-client design](docs/architecture/android-personal-client.md)
- [Remote service commands](docs/architecture/remote-service-commands.md)
- [Local developer service controls](docs/architecture/local-service-controls.md)
- [Agent runtime and pairing](agent/README.md)
- [Agent package/service decision](docs/architecture/agent-distribution.md)
- [Responsive web dashboard](docs/features/dashboard.md)
- [Measurements, reports and notifications](docs/features/monitoring.md)
- [Account verification and recovery](docs/features/accounts.md)
- [Workspace collaboration](docs/features/workspaces.md)
- [Device lifecycle and consent](docs/features/devices.md)
- [Account export and deletion](docs/features/privacy.md)
- [Agent and authenticated IPC design](docs/architecture/agent-protocol.md)
- [Workspace permission boundaries](docs/architecture/workspace-permissions.md)
- [Privacy and data lifecycle](docs/architecture/data-and-privacy.md)
- [Platform feasibility and hardware gates](docs/architecture/platform-feasibility.md)
- [Deployment foundation](infra/deployment.md)
- [Implementation backlog](docs/backlog.md)
- [Phase 0 verification and physical-device checklist](docs/validation/phase-0.md)

Source implementation, verified build, integration verification and physical-device verification are tracked separately. Email sorting is deferred.

## Database and API integration checks

Use a dedicated empty PostgreSQL database ending in `_test`, supplied through `TEST_DATABASE_URL`. See `backend/.env.test.example`. Do not use a real application database.

```sh
npm run test:database
npm run test:api
```

The database check verifies clean migration, rollback, constraints, schema drift refusal and existing-data adoption. The API check validates actual operation responses against OpenAPI and exercises session, workspace, device-ownership and viewer-permission boundaries. Both use only fixture data and remove their fixture schema afterward. Neither provisions a database server.

The Foundation checks workflow uses isolated PostgreSQL on GitHub Actions, checks backend/contracts/desktop, and builds/runs the Go agent foundation on a CI Go toolchain. It has no mobile setup/build/simulator steps and does not deploy the application. Native builds and real-device tests remain deferred.

## Phase 2 setup

Before starting the backend, set an independent base64-encoded 32-byte `ACCOUNT_MAIL_ENCRYPTION_KEY` in its private environment. Run explicit migrations after backing up existing data; use the checked baseline-adoption path only for the old synchronized schema. Existing users/devices are never silently verified or enabled.

Account mail is queued encrypted. Real delivery requires configured SMTP credentials and explicitly enabled delivery; client verification/reset screens come later. `npm --prefix backend run mail:deliver` processes delivery batches, and `npm --prefix backend run accounts:cleanup` purges expired tokens/messages without SMTP. No real email is sent by the integration tests.

Direct device registration is disabled in favor of one-time enrolment. Device credentials differ from user sessions; consent, revocation and configuration generations constrain later collection. Current device reports are authenticated metadata, not actual native monitoring measurements.

## Phase 3 setup

Review and apply explicit migrations before using the measurement APIs. The final Phase 3 migration pauses old monitoring grants and advances configuration generations; accept the current monitoring disclosure before uploading. No collector is enabled by migration.

Measurement batches, usage reports/CSV, retention, manual network labels, alert rules, in-app notification delivery and operational diagnostics are implemented in the backend. Run `npm --prefix backend run monitoring:work -- WORKSPACE_UUID` for one bounded maintenance pass per workspace; deployment scheduling remains to be configured. Push providers remain unavailable. See [monitoring behavior and limits](docs/features/monitoring.md).

## Phase 4 dashboard

Configure the dashboard's server-only API base and exact browser origin using `dashboard/.env.example`, then run `npm run dev:dashboard` (port 3001). Real account/workspace, device, report, alert, team, profile and privacy flows now replace the preview data. Future modules are explicitly marked planned. See [dashboard setup and browser checks](dashboard/README.md).

`npm run test:dashboard` runs desktop-browser flows against a disposable PostgreSQL fixture server after backend/dashboard builds. An existing desktop Chrome may be selected with `PLAYWRIGHT_CHROME_EXECUTABLE`; CI prepares desktop Chromium only. Native SDKs, emulators and real-device acceptance remain deferred.

## Phase 5 agent integration checks

Build the Go executable separately as described in [agent/README.md](agent/README.md). Set `TEST_AGENT_BINARY` to its absolute path when running `npm run test:api` to include the actual Go process/backend outage and revocation scenario. After desktop build, `TEST_AGENT_BINARY=/absolute/path/to/netsentry-agent npm run test:desktop-agent` checks Node–Go IPC without installing or launching Electron. These checks use temporary, private, loopback-only fixture credentials. They do not install a persistent service or verify native Keychain/Electron acceptance.

Phase 6 developer integration can be checked after building Go and desktop with `TEST_AGENT_BINARY=/absolute/path/to/netsentry-agent npm --prefix desktop run test:developer`. It starts controlled sample services on supported macOS, verifies local gates/outcomes and cleans them up. Linux verifies an unavailable native adapter. It uses an explicit loopback backend fixture and never installs a persistent service.

Phase 7 adds explicit sharing/controller grants, outbound remote commands and confirmed web outcomes. After applying the tenth migration, schedule bounded `agents:cleanup` maintenance. On macOS, `TEST_AGENT_BINARY` also enables the real API-to-native remote shutdown check in `test:api`; other platforms report that native scenario pending. See the Phase 7 verification record for fixture/device distinctions.

## Phase 8 Android source checks

Android personal-client source is implemented; native compilation and phone validation remain pending. `npm run check:android` validates synthetic Kotlin-emitted wire fixtures. `npm run test:android-core` uses explicitly supplied standalone JDK/Kotlin/JSON tooling to compile actual portable client code and parse native source, without Android SDKs or emulators. See [Android setup and signing handoff](android/README.md). Allowance alerts now explicitly select measured or estimated quality; existing rules default to measured.

Phase 9 adds separately consented Android event-history source, per-app/category reporting and corrections, deterministic descriptive insights and missing-usage alerts. Apply the eleventh explicit migration and schedule monitoring retention/evaluation. SDK-free Kotlin tests now also exercise detailed usage and one-shot HTTPS mutations; native compilation and real-phone accuracy/background/UI checks remain pending.

Phase 10 adds explicitly named network collection, passive IPv4 inventory/history, independent desktop consent, encrypted router setup, WAN counter history/coverage and network event review. Apply migration twelve, set an independent `ROUTER_CREDENTIAL_ENCRYPTION_KEY` and schedule the network worker per workspace. The OpenWrt ubus adapter is a fixture-tested protocol candidate; no physical router/firmware is certified. See [validation and pending hardware checks](docs/validation/phase-10.md) and [network architecture/setup](docs/architecture/network-monitoring.md).

Phase 11 adds explicit family guardian grants, revision-bound child/device sharing consent, policy schedules and exceptions, child requests/guardian decisions, scoped weekly app/category observations, and web/Android family views. Apply migration thirteen and schedule `family:work`. Current Android/router adapters do not execute restrictions; applied receipts are rejected. Native builds, notifications and provisioned enforcement remain pending/unavailable. See [family validation](docs/validation/phase-11.md).

Phase 12 adds the SwiftUI iOS client and an optional, explicitly authorized local Screen Time source path. `npm run check:ios` parses source/targets/privacy boundaries with existing host tooling; `npm run test:ios-core` compiles the Foundation repository and validates emitted contracts. `npm run test:ios-live` exercises the actual Swift HTTPS adapter against a disposable Nest/PostgreSQL fixture environment. These are host/source/integration checks, not an iOS build. Apple report data stays within its report extension. Signing, Apple approval, native type checks/builds, APNs and physical acceptance remain pending; see [iOS setup and handoff](ios/README.md).

Phase 13 adds Business organizations, location/network/department structure, employee enrolment and explicit sharing, company custody, reporting checks, scoped organization reports, network alert assignment, audit exports, remote unenrolment and offboarding. Apply migrations fourteen/fifteen and schedule `business:work` separately; no production environment is modified automatically. Android/SwiftUI employee views are source/host-integration checked, with native packaging and physical acceptance pending. See [Business ownership and access boundaries](docs/architecture/business-organizations.md) and [verification](docs/validation/phase-13.md).

## Phase 15 acceptance handoff

[Physical-device workflow](docs/release/README.md) includes Android/iOS build handoffs, controlled cross-network shutdown tests, router/deployment/recovery checks and a [support evidence matrix](docs/release/supported-environments.md). `npm run check:release` and `npm run test:release` validate the evidence helper; they do not pass physical tests. Native builds/signing/device acceptance remain pending. No mobile tooling is installed and Flutter remains preserved.

Phase 16 first increment adds Android/account and desktop/local themes plus opt-in alert email preferences with delivery hard-disabled. The web dashboard uses Tailwind CSS 4 alongside custom CSS; desktop now also uses Tailwind CSS 4, Android uses Compose and iOS SwiftUI. See [Phase 16 evidence and boundaries](docs/validation/phase-16.md). Other optional extensions and Phase 15 hardware acceptance remain separate.
