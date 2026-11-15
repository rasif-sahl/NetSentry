# NetSentry

NetSentry is being built for device/network monitoring, family digital wellbeing, business network management and developer service monitoring. Features are enabled only when the platform, permissions and integrations support them.

## Applications and shared components

| Directory | Technology | Current role |
| --- | --- | --- |
| `backend/` | NestJS, TypeScript, PostgreSQL/TypeORM | Account, workspace, enrolment, health/consent and privacy APIs |
| `dashboard/` | Next.js, React, TypeScript, Tailwind CSS | Existing web interface; preview monitoring values remain until integration |
| `android/` | Kotlin, Jetpack Compose | New independent native source/build scaffold |
| `ios/` | Swift, SwiftUI | New independent native source/Xcode project scaffold |
| `desktop/` | Electron, React, TypeScript, Vite | New desktop interface and isolated native shell |
| `agent/` | Go | Shared core and independent network/developer module boundaries |
| `contracts/` | JSON Schema and synthetic fixtures | Initial versioned capability-report contract |
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

The contracts checks require `npm --prefix contracts ci --ignore-scripts` when preparing a fresh checkout. `npm run check` checks scaffolds/contracts, runs contract/backend units, and builds backend/desktop; it does not install dependencies or mobile tools.

Backend commands require its existing dependencies; server/integration tests require the configured PostgreSQL environment. `dev:dashboard` uses port 3001 to match the existing API CORS example. Desktop checks require its prepared dependencies. If preparing them later, use `npm --prefix desktop ci --ignore-scripts` to avoid running dependency installers. Electron's runtime binary is intentionally not installed by this command; see `desktop/README.md` before desktop launch. Standard first-use backend/dashboard dependency installation is separate and is not performed by root commands.

Agent commands require an existing Go 1.23+ toolchain. Native build/signing commands are deliberately absent from the root scripts. See individual component READMEs for prerequisites and pending checks.

## Planning and verification

- [Complete development plan](DEVELOPMENT_PLAN.md)
- [Phase 0 architecture decisions](docs/architecture/phase-0-decisions.md)
- [Phase 1 verification](docs/validation/phase-1.md)
- [Phase 2 verification](docs/validation/phase-2.md)
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

The Foundation checks workflow uses isolated PostgreSQL on GitHub Actions, checks backend/contracts/desktop, and builds/runs the Go scaffold on a CI Go toolchain. It has no mobile setup/build/simulator steps and does not deploy the application. Native builds and real-device tests remain deferred.

## Phase 2 setup

Before starting the backend, set an independent base64-encoded 32-byte `ACCOUNT_MAIL_ENCRYPTION_KEY` in its private environment. Run explicit migrations after backing up existing data; use the checked baseline-adoption path only for the old synchronized schema. Existing users/devices are never silently verified or enabled.

Account mail is queued encrypted. Real delivery requires configured SMTP credentials and explicitly enabled delivery; client verification/reset screens come later. `npm --prefix backend run mail:deliver` processes delivery batches, and `npm --prefix backend run accounts:cleanup` purges expired tokens/messages without SMTP. No real email is sent by the integration tests.

Direct device registration is disabled in favor of one-time enrolment. Device credentials differ from user sessions; consent, revocation and configuration generations constrain later collection. Current device reports are authenticated metadata, not actual native monitoring measurements.
