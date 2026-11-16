# Desktop packaging and update verification

Scope: initial macOS packaging and an explicit signed desktop update flow. The user confirmed no Developer ID/team or HTTPS update host is available. Production updates remain disabled. No signing account, private production key or hosting service was created.

## Implemented source

- Pinned electron-builder 26.18.0 and electron-updater 6.8.11, with explicit production runtime dependencies. Preview packaging uses an existing pinned Electron distribution and matching Mach-O agent. Release configuration produces DMG/ZIP, requires signing identity/team/notarization, verifies app/agent signatures and enables release-only Electron integrity/inspection fuses. All builder publication is disabled.
- Main verifies signed app/bundled-agent trust before packaged credential-helper execution. Unsigned previews refuse that execution. Packaged applications ignore development executable/state overrides. Runtime and renderer permissions/CSP remain restrictive.
- The update UI exposes status/check, separate download and restart/install. Native confirmation defaults to Cancel. No automatic checks/downloads or install-on-quit occur. Disabled installations do not contact a host.
- The custom provider verifies exact Ed25519 signed JSON metadata rather than trusting unsigned YAML. Metadata binds app, architecture, increasing release, version, issue/expiry and ZIP size/SHA-512. Network reads are bounded; downloads are restricted to the configured HTTPS origin and have a cancellation deadline. Downloaded file hashes are rechecked before installation. macOS Squirrel supplies signed application replacement/relaunch.
- A private persistent journal rejects rollback, changed-content counter reuse and corrupt/stale evidence. Interruption recovery reports the observed version and requires explicit recheck/download; native failure returns an error and releases the lease. No automatic health downgrade is implemented.
- The Go `hold-update-lock` helper acquires the existing runtime lock without reading credentials or starting monitoring. A running agent, including `--no-local`, excludes that lease. Main verifies the helper signature, rejects stale/current sockets, holds and checks the lease for handoff, and releases it on failure/app exit. No unknown PID is signalled and no background service is registered.

## Available verification

- Actual **unsigned macOS arm64 preview bundle built** with pinned Electron 45.3.2 and the existing host tools. The desktop-only runtime was explicitly downloaded for this packaging task; no mobile SDK or Xcode installation occurred. Preview path: `artifacts/desktop/preview/arm64/mac-arm64/NetSentry.app` (ignored generated output).
- Bundle inspection verifies compiled main/preload/renderer entries match current build output, the bundled agent hash matches the newly built native agent, the public policy is disabled/empty-team, updater runtime files are present and build-only electron-builder is excluded from ASAR. This is package inspection, not a signed install or native update acceptance result. The preview was not installed or launched as a production app.
- **Ten update/packaging tests pass**, including signature tamper/wrong root/target/path/time; policy configuration; persistent rollback/reuse/corruption/symlink refusal; disabled zero-fetch behavior; explicit confirmation/cancellation; socket blocking; changed cache/download failure; guarded packaging; exact custom-provider resolution; interrupted/native-error recovery; actual Go process lock exclusion/release; offline signing-CLI/verifier interoperability and overwrite refusal. ZIP bytes/ports and signing keys in tests are synthetic/ephemeral, not valid application distributions or production credentials.
- Existing Go tests pass. A native agent was rebuilt with the existing Go/host compiler. Existing authenticated Node–Go IPC checks pass after the CLI addition.
- Desktop TypeScript/main and Vite renderer builds pass. Chromium appearance/control checks pass with the update card's disabled state, along with themes, cards, focus, dialogs and narrow layouts. Agent/UI fixtures submit no stop action.
- Root scaffold/release/infra/contract/native-source/backend/web checks pass, including 70 backend tests and 21 contract tests. Hosted CI runs the new updater suite against a freshly built agent in its desktop job.

No mobile SDK, Android Studio, Xcode, simulator or emulator was installed. No real update host, production signing/notarization, mail message, payment, agent monitoring or LaunchAgent/system-service installation was performed. Flutter remains unchanged.

## Remaining acceptance and scope

Production signing identity/team, notarization profile, public update host/root policy and reviewed release artifacts are required before activation. Test actual Developer ID trust, clean-Mac Gatekeeper, Keychain continuity, signed app/agent runtime, DMG installation/uninstall, real signed ZIP replacement/relaunch and interrupted/power-loss recovery on each supported environment. A preview, synthetic controller test or journal does not establish those outcomes.

Background-service registration/removal, automatic agent start/restart and health-based rollback remain separate pending work. The current agent remains explicitly initialized/run in the foreground; local background preference alone installs nothing. Preview branding currently uses Electron's default icon. Windows/Linux distributions are not implemented by this macOS increment.

Follow [the packaging/update runbook](../../desktop/packaging/README.md). Preserve release high-water state across upgrades/recovery and retain Phase 15 physical/native gates until actual evidence exists.
