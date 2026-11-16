# macOS packaging and updates

Initial target: macOS arm64, with x64 source configuration requiring its own matching native agent and acceptance. No signing identity, Apple team or update host has been supplied. The checked-in policy keeps updates disabled. A local preview is not a signed/notarized distribution product.

## Local preview

Build the agent with the existing Go/host compiler and desktop with Node 24. Select an existing pinned Electron 45.3.2 distribution and matching native Mach-O agent. Dependency preparation remains `npm --prefix desktop ci --ignore-scripts`; it does not download Electron. A separately requested desktop runtime download is allowed for packaging, never a mobile SDK installation.

```sh
# From repository root; set these to existing files, without shell expansion from API input.
export NETSENTRY_PACKAGE_AGENT=/absolute/path/to/netsentry-agent
export NETSENTRY_ELECTRON_DIST=/absolute/path/to/electron/dist
npm --prefix desktop run package:preview
```

The preview produces `artifacts/desktop/preview/arm64/mac-arm64/NetSentry.app` on the initial target. It includes local renderer CSS/JS, production update dependencies, the matching agent, disabled public policy and update-cache settings. It uses Electron's default icon pending branding. It creates no LaunchAgent or system service. Unsigned previews cannot execute the bundled credential helper or activate updates. Source development overrides remain available only in unpackaged development builds.

The generated preview is for bundle/UI inspection. Production signatures, Gatekeeper/notarization, Keychain and a real in-place update remain unverified. This task did not install or open the preview as a production application.

## Signed local distribution build

Use a separately prepared macOS signing host and approved Developer ID certificate. Keep private credentials outside Git. `package:release` refuses missing identity/team/notarization configuration before packaging. No paid account or signing credential is created by the repository.

1. Copy `update-policy.json` to private release configuration. Keep exactly its fields. Supply the approved ten-character team ID, positive monotonically increasing release number and `NETSENTRY_RELEASE_POLICY` path. Keep `enabled: false` if no update host/root is approved.
2. Set `CSC_NAME` to the reviewed Developer ID identity and `APPLE_KEYCHAIN_PROFILE` to an existing notarization profile. Select existing Electron/agent artifacts and `DESKTOP_ARCH=arm64` or `x64`. Verify all inputs and source version before building.
3. Run `npm --prefix desktop run package:release`. It uses electron-builder 26.18.0, fixed app ID `com.netsentry.desktop`, matching signed bundled agent, hardened runtime, signature verification and notarization, and produces DMG plus update ZIP. Release fuses disable run-as-Node/environment/inspector overrides and require the sealed ASAR. The app/agent signatures must satisfy the configured team. Missing/mismatched trust fails the build.
4. Independently inspect app and agent signatures, notarization/stapling and Gatekeeper behavior on a clean supported Mac. Review install/upgrade/uninstall and state preservation before distribution. No publishing is configured; builder always uses `publish: never`.

The agent is initialized and run separately in the foreground as described in its README. Packaging does not grant local/remote shutdown or monitoring consent and does not start an agent automatically. Background preference remains consent only; actual LaunchAgent registration/removal is still a separate pending feature. Removing the app does not erase agent credentials or release journal: unpair/revoke and erase data explicitly when that is intended.

## Signed update feed

Desktop update metadata is a separate protocol from Phase 14's Go binary package verifier. It uses a canonical JSON manifest wrapped in base64 plus an Ed25519 signature. It binds app ID, macOS architecture (`arm64`/`x64`), increasing release, semantic version, issue/expiry (maximum seven days), ZIP basename/size and SHA-512. ZIPs are limited to 1 GiB. The existing Go binary manifest format is unchanged.

Before activating updates, provide an approved HTTPS base URL ending in `/`, with no credentials/query/fragment, and an offline-controlled Ed25519 keypair. Put only the raw 32-byte public key (base64) in the private release policy; its public fields are embedded in the signed app. No development environment variable or renderer input can replace the installed policy. Confirm the policy's public key matches the signing tool's reported key. Apple team changes/key rotation require a separately reviewed transition release or installer.

```sh
# Produce a signed, notarized ZIP first. Keep the private Ed25519 PEM outside Git,
# mode 0600; this tool creates no persistent key or signing account.
export DESKTOP_UPDATE_PRIVATE_KEY_FILE=/private/release/offline-update-key.pem
node desktop/scripts/sign-desktop-update.mjs \
  /private/release/NetSentry-0.2.0-arm64.zip \
  /private/release/desktop-update-arm64.json arm64 2 0.2.0
```

Upload the ZIP under its exact basename and publish `desktop-update-arm64.json` last on the approved HTTPS base. This is an explicit operator step, not performed here. Use independent per-architecture feeds/counters. The signing helper refuses overwrites. Native macOS code signing remains required even with a valid Ed25519 signature.

## User flow and recovery

The app offers status/check, explicit download and separately confirmed restart/install. No startup polling, automatic downloading or install-on-quit is enabled. Feed reads have bounded size/time, verified HTTPS and no redirects; artifact requests are restricted to the configured HTTPS origin. The custom provider uses only verified metadata and never fetches unsigned `latest*.yml`. Download hash checks bind the signed ZIP; macOS Squirrel handles signed application replacement/relaunch. Release logs and renderer errors exclude provider details and local secrets.

The private `NetSentry/desktop/updates` journal records the highest verified release/hash and checked/downloaded/install-requested state. It survives app replacement/uninstall. Lower releases, reused counters with different metadata, corrupt journals and stale metadata fail closed. A fresh signed manifest with a higher release can refresh expired metadata while keeping the candidate version; never silently lower the counter.

Before install, stop the separate foreground agent. The app rejects any agent socket (including stale sockets) and acquires the same `runtime.lock` through the signature-verified bundled `hold-update-lock` helper, covering agents without IPC. The helper reads no credentials, holds the existing lock while stdin is open and releases on EOF. The controller checks the lease before handoff and keeps it until app exit or update failure. Do not manually start/init another agent during replacement. No agent is automatically restarted; consent and private state remain separate from app installation.

Native failure releases the lease and shows a generic error. On restart, the journal distinguishes an observed installed version from an interrupted request; recovery requires another explicit check/download, never an automatic retry. This is not a proven health rollback: actual signed Squirrel replacement, power-loss behavior and recovery need acceptance. Recovery to earlier code must be a newly reviewed/signed higher-version, higher-counter release; automatic downgrade is disabled.

If a `.new` journal file or corrupt state remains after a crash, preserve it and the last accepted receipt for operator review. Do not delete high-water state merely to accept an older release. Protect user data/cache directories; local hashes do not defend against a malicious administrator or compromised signing/build account.

## Checks

`npm run build:desktop`, `npm run test:desktop-updates` and `npm run test:desktop-appearance` cover compilation, signed-protocol/controller boundaries and Chromium UI. Set `TEST_AGENT_BINARY` to the existing newly built test agent for the actual cross-process lock check. Synthetic ZIP/port fixtures never establish native signing or installation.

References: [stable macOS updater behavior](https://www.electronjs.org/docs/latest/api/auto-updater), [electron-builder auto updates](https://www.electron.build/docs/features/auto-update/). The installed stable versions are 26.18.0/6.8.11; unreleased v27 signed-YAML guidance is not used. Our mandatory signed JSON provider supplies the metadata authentication missing from that stable generic feed.
