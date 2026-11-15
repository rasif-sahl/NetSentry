# Phase 1 verification

Verification date: 15 November 2026. Work is committed directly on `develop` with separate feature commits and pushed to `origin/develop`.

## Implemented foundations

- Database environment validation, safe migration defaults, verified production PostgreSQL TLS, explicit CLI commands and shared entity/migration configuration.
- Initial identity/workspace/device migration, checked adoption for synchronization-created schemas, and isolated database lifecycle verification.
- Explicit nullable text types and normalized JSON defaults, correcting issues surfaced by real PostgreSQL startup/schema checks.
- OpenAPI v1 for 12 product operations, JSON Schemas for future capability/measurement/permission/command/local-IPC contracts, synthetic fixtures and semantic validation checks.
- Server-generated request correlation, structured errors without internal/query-string leakage, versioned health liveness route and a shared HTTP bootstrap.
- Authentication dependency exports corrected so protected workspace routes can start.
- Workspace-scoped permission foundation; VIEWER device access is read-only, and service viewing/control are distinct gates.
- Agent/IPC, privacy/retention/audit, platform feasibility, packaging/deployment designs; no real command execution or monitoring ingestion is introduced.
- Repeatable root checks and an isolated GitHub Actions workflow without mobile tooling or production deployment.

## Local verification results

| Check | Result |
| --- | --- |
| `npm run check:scaffolds` | Passed |
| Contract schema/fixture checks | Passed; 6 synthetic fixtures and compiled API components for 12 operations |
| Contract regression tests | Passed; 8 tests |
| Backend build | Passed |
| Backend unit tests | Passed; 6 suites, 27 tests |
| Backend type-aware lint | Passed |
| Disposable PostgreSQL lifecycle check | Passed; clean migration, schema agreement, uniqueness/cascades, rollback, drift refusal and existing-row preservation during adoption |
| Live API against disposable PostgreSQL | Passed; actual OpenAPI response schemas, validation, request IDs, workspace isolation, device ownership, refresh rotation, session revocation, viewer read-only behavior and membership removal |
| Desktop TypeScript/main/preload/Vite build | Passed |
| Workflow YAML and no-mobile-step review | Passed |
| Native Android, iOS and Flutter source comparison | Unchanged from Phase 0 |
| Local Go build/run | Pending; Go is not installed on this development machine |
| Native compilation/signing/device tests | Deferred by request; no tooling installed |
| Real routers, collectors, policy enforcement and agent IPC | Not implemented/verified in Phase 1 |

The test cluster uses already-installed PostgreSQL in a separate temporary data/socket directory on loopback port 55439. It is not a project/production database. Tests refuse nonempty application schemas and use only fixture accounts/data; fixture application tables are removed by rollback. The temporary PostgreSQL service has been shut down after verification.

The original starter e2e test was replaced by the guarded, schema-validated live API check; `test:e2e` now invokes that check. Native metadata validation from Phase 0 is not relabelled as native compilation.

## Hosted verification

The [Foundation checks run 43706023476](https://github.com/rasif-sahl/NetSentry/actions/runs/43706023476), for code commit `62e501f`, passed all three jobs:

- Backend/contracts: clean dependency preparation, schemas, unit checks, migration lifecycle and actual API/schema/permission tests against disposable PostgreSQL.
- Desktop: TypeScript/main/preload/Vite build with install scripts disabled and no Electron runtime download.
- Agent: Go formatting, vet, build, package checks and validation of actual executable output against the disabled-module schema.

Go is verified on hosted CI; it remains uninstalled locally. No mobile build/install steps or production deployment are configured. This hosted result verifies foundation code, not native/device behavior or future IPC/monitoring implementations.

## Deferred implementation and acceptance

Phase 1 establishes foundations and architecture, not completed monitoring features. Account verification/recovery/invitations, full device lifecycle/consent persistence, retention workers, audit storage, native API clients, IPC transport authentication, router adapters and service execution remain with their feature phases. All conditional Android/iOS/router behavior stays unavailable until implemented and verified on actual authorized devices/hardware.

Before implementing local IPC, finalize handshake wire schemas and cross-language vectors against the recorded challenge-response design. Before monitoring collection, choose explicit retention defaults/capacity targets and implement consent/revocation boundaries. Before native distribution, prepare compatible build/signing tools only when requested and validate physical-device/entitlement behavior.
