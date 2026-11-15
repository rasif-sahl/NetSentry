# NetSentry

NetSentry is being built for device/network monitoring, family digital wellbeing, business network management and developer service monitoring. Features are enabled only when the platform, permissions and integrations support them.

## Applications and shared components

| Directory | Technology | Current role |
| --- | --- | --- |
| `backend/` | NestJS, TypeScript, PostgreSQL/TypeORM | Existing account/workspace/device API foundation |
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
npm run check:scaffolds
npm run build:backend
npm run test:backend
npm run dev:backend
npm run dev:dashboard
npm run check:desktop
npm run build:desktop
```

Backend commands require its existing dependencies; server/integration tests require the configured PostgreSQL environment. `dev:dashboard` uses port 3001 to match the existing API CORS example. Desktop checks require its prepared dependencies. If preparing them later, use `npm --prefix desktop ci --ignore-scripts` to avoid running dependency installers. Electron's runtime binary is intentionally not installed by this command; see `desktop/README.md` before desktop launch. Standard first-use backend/dashboard dependency installation is separate and is not performed by root commands.

Agent commands require an existing Go 1.23+ toolchain. Native build/signing commands are deliberately absent from the root scripts. See individual component READMEs for prerequisites and pending checks.

## Planning and verification

- [Complete development plan](DEVELOPMENT_PLAN.md)
- [Phase 0 architecture decisions](docs/architecture/phase-0-decisions.md)
- [Implementation backlog](docs/backlog.md)
- [Phase 0 verification and physical-device checklist](docs/validation/phase-0.md)

Source implementation, verified build, integration verification and physical-device verification are tracked separately. Email sorting is deferred.
