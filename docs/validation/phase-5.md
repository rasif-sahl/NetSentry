# Phase 5 verification record

Date: 16 November 2026. Work uses `develop` directly, with separate plain-language feature/platform commits pushed to `origin/develop`.

## Delivered source

The shared Go agent now enrols with a separate workspace/installation identity, stores scoped credentials, connects outbound, reports heartbeats/capability diagnostics, persists bounded diagnostic batches through outages, handles generation changes/revocation, and separates local module preference from workspace authorization. It exposes authenticated per-user Unix IPC to Electron main. The desktop UI can pair, read status and change local module/background preferences. Both modules' actual collectors remain unavailable; service discovery, process shutdown and remote command delivery belong to Phases 6–7.

Backend APIs include software-agent disclosures, single-use ten-minute enrolment codes, identity/credential rotation, workspace listing, module/background authorization, heartbeat/configuration, idempotent diagnostic synchronization, revocation, export and erasure. Membership loss revokes agent access. An explicit bounded cleanup job removes expired codes and diagnostic events older than seven days. Browser gateway routes cannot redeem enrolment codes or use opaque agent credentials.

An offline Ed25519 package verifier checks signed metadata, platform/architecture, monotonic-release minimum, freshness, exact size and SHA-256. It does not download, install or execute artifacts. The per-user service/installer plan is documented; no persistent host service was installed.

## Feature and platform commits

| Commit | Change |
| --- | --- |
| `161b5f0` | Backend agent identity, enrolment, permissions and revocation |
| `f9874b6` | Real process recovery and diagnostic retention checks |
| `f6ded9b` | Shared Go runtime and macOS secure IPC/credential-store source |
| `75949ee` | Windows credential-store source and explicit unsupported-runtime boundaries |
| `1f9396a` | Electron/React pairing, status and local settings |
| `5f749a7` | Ubuntu/macOS builds and actual cross-component CI checks |
| `58ece4f` | Immediate deletion of owned pairing details during erasure |

## Verified locally

- `npm run check`: scaffolds, nine shared synthetic fixtures, 74 API operations, nine original contract regressions, backend compile and all 39 tests/11 suites, desktop type/production build, dashboard lint and production build/type checks.
- The added desktop setup contract regression passed separately (ten contract tests total). Backend type-aware lint passed.
- All 19 existing dashboard Playwright regressions passed against the production web build, real fixture API/PostgreSQL and already-installed desktop Google Chrome. No browser/mobile runtime was installed locally.
- Clean migration/rollback/schema drift/cascade and existing-data adoption checks passed against disposable local PostgreSQL 14.20, including all nine migrations. Agent cleanup counts and repeatability passed in the live API suite.
- Full live API suite passed, including agent identity/binding/replay, separate credentials, membership/module boundaries, concurrent event deduplication, generation invalidation, retention, revocation and erasure/privacy behavior.
- The **actual compiled Go process** paired against the actual NestJS/PostgreSQL API, sent heartbeat/diagnostics, survived a process restart with its outage queue, replayed the same durable event ID after recovery, reconciled changed configuration and erased credentials/buffer after revocation. A temporary loopback proxy simulated outages. All data was isolated test fixtures.
- Go formatting, vet, race-enabled tests and native macOS arm64 build passed. Tests cover private permissions/symlinks, strict JSON, initialization and process locks, buffer size/expiry/restart/idempotency, retry bounds, module isolation, configuration/revocation, HMAC proof/replay/malformed frames, TLS/redirect boundaries and signed-package tamper/target/expiry/rollback rejection.
- A desktop-renderer fixture check in existing desktop Chrome passed unavailable/connected states, pairing and checkbox changes, and 640px layout without horizontal overflow. The screenshot was visually inspected; this is not native Electron acceptance.
- Node–Go integration passed using a real foreground process and Unix socket, shared HMAC vectors, private inherited credential pipe, status/preferences, settings persistence, wrong-secret denial, socket-permission/symlink denial and duplicate-start protection.
- Windows amd64 cross-compilation passed; this does not verify Windows runtime operation. No Windows ACL/named-pipe implementation is advertised.

The Go toolchain was downloaded from the official Go distribution to `/tmp`, SHA-256 checked and used without a global installation: Go 1.27.4, darwin/arm64, archive SHA-256 `91a44a2b8a716600ad94a4f143e156116620db8828086a6e3602291be9bd0bb4`. macOS Keychain source compiled using the existing Command Line Tools/macOS SDK. Tests used memory or explicit private development credential stores; they did not write production Keychain credentials.

The [hosted Phase 5 workflow for 5f749a7](https://github.com/rasif-sahl/NetSentry/actions/runs/43798660135) passed all five jobs: backend/contracts with PostgreSQL 17 and actual Go process checks, desktop build and Node–Go IPC, Ubuntu Go, macOS Go, and dashboard browser checks. Both Go jobs run race-enabled tests and defensive Windows/macOS cross-builds. A final privacy regression additionally verifies erasure deletes pending enrolment-code details rather than waiting for retention cleanup.

## Acceptance matrix and remaining gates

| Area | Source/build | Integration/runtime | Acceptance pending |
| --- | --- | --- | --- |
| Shared outbound core | macOS arm64 built, race tested | Real Go/NestJS/PostgreSQL with loopback fixture data | Production HTTPS deployment and operational soak |
| macOS credential store | Native Security.framework code compiles | Development store exercised only | Keychain permission/denial/lock/restart with packaged signed app |
| macOS local IPC | Go and Electron main client compile | Actual Node–Go Unix sockets and inherited pipe exercised | Native Electron window/bridge on packaged signed app |
| Linux agent | Portable source and hosted checks configured | Development-only loopback storage/Unix socket tests | Production OS secret store, supported hosts and service supervision |
| Windows agent | Credential Manager source and fail-closed stubs cross-build | Unsupported private state/lock/pipe startup | User ACLs, named pipe, credential-store runtime and service registration |
| Signed packages | Verifier and adversarial tests | Synthetic signed artifacts only | Signing provider/pinned distribution keys, code signing/notarization, installer high-water mark/atomic replacement/rollback |
| Background operation | Explicit local + remote consent and runtime gating | Foreground development processes only | Opt-in installer, login/exit/revocation behavior and uninstall |
| Native mobile | Unchanged | Not run | Existing native build and physical-device gates remain |

No Android Studio, Android/iOS SDKs, emulator, simulator or Xcode was installed. Flutter `mobile/` remains unchanged. No real network/process collectors, service shutdown, command delivery, production signing or background installation is claimed.
