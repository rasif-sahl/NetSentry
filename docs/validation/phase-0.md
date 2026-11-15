# Phase 0 verification

## Environment and boundaries

The initial environment contains Node.js 24.21.0, npm 11.19.0 and Apple Command Line Tools at `/Library/Developer/CommandLineTools`. Go and Gradle were not found on PATH. A launcher such as `/usr/bin/xcodebuild` is not proof of a complete iOS SDK/build environment.

No Android Studio, emulator, simulator, mobile SDK, Xcode, Gradle distribution, persistent agent or cloud environment is installed by this phase. The existing Flutter application remains unchanged. Desktop dependencies are prepared with npm install scripts disabled; the Electron runtime binary is not downloaded.

## Verification status

| Component | Check | Status |
| --- | --- | --- |
| Repository/contracts | Root structural/fixture checker | Passed |
| Desktop | TypeScript check, main/preload compilation and Vite production build | Passed |
| Backend | Existing build and unit suite | Passed; 3 suites and 3 tests |
| iOS metadata | `plutil` project/plist validation, reference consistency and scheme XML parsing | Passed; not an iOS build |
| Android metadata | Manifest/resources XML and Gradle source review | Passed structural checks; not an Android build |
| Go agent | Build/vet/runtime contract output | Pending: Go toolchain unavailable |
| Native apps | Compilation, signing, installation and runtime | Pending: tooling deferred by request |
| Desktop native shell | Actual Electron window/preload behavior | Pending: Electron binary deliberately not installed |
| Actual monitoring/router data | Collectors/integrations | Not implemented in Phase 0 |

The tracked Flutter files have no changes. Electron dependency preparation was checked to contain neither a downloaded runtime directory nor its runtime path marker. No PostgreSQL integration/e2e tests were run because Phase 0 changes no backend behavior or database schema.

These checks do not claim that native apps compile or that mobile monitoring works. Structural checks are deliberately distinct from native build verification.

## Later physical-device checklist

- Prepare compatible native build/signing tooling only when requested; use actual Android/iPhone hardware rather than emulators/simulators.
- Validate app installation, application IDs, account flows, pairing, session recovery and logout. Use a different development Android application ID when retaining Flutter on the same phone.
- Test permissions denied/granted/revoked, monitoring pause, battery restrictions, background execution, reboot and offline recovery.
- Verify mobile/Wi-Fi usage and screen-time measurement accuracy, missing-data indicators and notifications.
- Test mobile stop requests against actual paired desktop services across another network, including expired/revoked/offline cases.
- Test Family enforcement only with supported mechanisms and required authorizations; distinguish requested policy from verified enforcement.
- Verify supported router/firmware combinations on authorized hardware.
- Resolve findings, rerun affected checks, then record build/integration/hardware acceptance independently before release.
