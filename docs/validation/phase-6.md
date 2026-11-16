# Phase 6 verification record

Date: 16 November 2026. Work is directly on develop with plain-language platform/feature commits, pushed to origin/develop.

## Delivered

A native macOS Go adapter discovers owned TCP listeners with executable/runtime, PID/parent, addresses/ports, start/duration and observation freshness. The agent infers uncertain project associations, persists local manual group corrections, filters/paginates inventory and retains bounded local action receipts. Local graceful shutdown and separate force-stop verify process/socket identity, optionally handle captured descendants and check actual outcomes. Remote/mobile command delivery remains Phase 7.

React/TypeScript desktop UI uses the authenticated main-only bridge for discovery, grouped service cards, search, local control opt-in, project correction/reset, stale-state disabling, distinct confirmation dialogs and action history. No generic PID/signal/path/shell API is exposed.

## Local checks

- Full `npm run check` passed: scaffold checks, ten shared fixtures/74 API operations, eleven contract regressions, backend compilation and all 39 tests across 11 suites, desktop type/production builds, dashboard lint and production build.
- Go vet, race-enabled tests and native macOS arm64 build passed using the existing temporary Go 1.27.4 toolchain and already-installed Command Line Tools. No new SDK/IDE/runtime was installed. Host: macOS 27.0.1 arm64.
- Actual controlled Node and Python listeners were discovered and stopped natively. An unrelated listener remained alive. A Node fixture ignoring SIGTERM remained running until a separate SIGKILL action. An actual supervisor replaced a stopped child on the same port; replacement was reported and left untouched.
- Native tests verified wrong process incarnation rejection, actual same-process socket close/rebind rejection and IPv6 loopback address/port reporting. Fake-adapter tests separately covered stale observations, PID/executable changes, exits, denial, child-tree changes/order, duplicate/conflicting actions, manual associations, interrupted journals, bounded history frames/retention and transient inspection failure during exit. Synthetic cases are not claims of forced OS PID reuse on hardware.
- Actual Node–Go authenticated Unix IPC integration passed: wire schema validation, independent local/workspace gates, discovery/project corrections, graceful/still-running/force outcomes, duplicate receipts, unrelated-process preservation, network-only denial, and revocation erasure. Its backend is an explicit loopback configuration fixture, not the production authorization service.
- The existing Phase 5 Node–Go setup bridge regressions passed. Existing real Go/NestJS/PostgreSQL pairing/configuration/generation/revocation compatibility is also exercised by hosted backend checks.
- Desktop renderer fixture checks in existing Google Chrome passed local-control default-off, project correction/reset, force/graceful confirmation, Escape, still-running outcome/history, history pagination/long labels and 640px layout without horizontal overflow. Screenshots were visually inspected. Fixtures were isolated UI data; native Electron was not launched.

## Hosted checks

The [workflow for desktop feature commit 4c4eed7](https://github.com/rasif-sahl/NetSentry/actions/runs/43803081823) passed all five jobs: backend/contracts with PostgreSQL, desktop, Ubuntu agent, macOS agent and dashboard browser regressions. Both agent jobs now compile desktop source and run developer IPC checks; macOS exercises actual controlled services, while Linux verifies explicit unavailability. Go race tests and Windows/macOS-without-cgo cross-builds are included.

The earlier hosted macOS Python test exposed an inspection/exit timing race. The verifier now retries transient uncertainty and distinguishes permission/inspection failure from a confirmed exit; the corrected run passed. Windows cross-compilation does not establish Windows runtime support.

## Commit breakdown

| Commit | Feature/platform |
| --- | --- |
| bc5e0c8 | macOS identity-bound process/socket adapter; unsupported-platform guard |
| 6b2778a | Fresh observations, project inference/corrections, child handling and local receipts/contracts |
| 7dc713b | Separate local consent, fresh workspace authorization, protocol and revocation gates |
| f31a75e | macOS exit-race correction and IPv6 coverage |
| 4c4eed7 | Desktop service workflow and platform integration checks |
| 1766ed2 | Bounded history pages, active retention and consent-reset checks |

## Remaining acceptance

- Native Electron window/preload plus native Keychain with a packaged signed app remains pending. Source builds, real Node–Go IPC and browser fixture rendering are verified separately.
- Initial acceptance covers the tested macOS host and hosted image, not every macOS version. The published kernel identity ABI/dynamic signal symbol requires continuing OS-version validation. Permission-denial tests are synthetic; no privilege escalation is implemented.
- Windows/Linux native process discovery/control, Windows ACL/named-pipe completion, signed distribution, installation/background login behavior, long operational soak and wider runtime/container support remain later work.
- Replacement detection is a bounded observation window, not lasting suppression of a supervisor. Child handling covers captured identities only; new descendants are not silently targeted.
- No remote command API, service upload, mobile stop UI or real-device mobile validation is claimed. No mobile SDK, Android Studio, emulator, simulator or Xcode was installed. android/, ios/ and the Flutter reference mobile/ remain unchanged.

See [local control architecture](../architecture/local-service-controls.md), [agent setup](../../agent/README.md) and [desktop setup](../../desktop/README.md) for limits and operation.
