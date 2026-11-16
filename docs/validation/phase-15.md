# Phase 15 preparation and validation record

Status: **in progress — physical-device/release acceptance pending**. This phase's preparation is implemented; it is not a completed native/hardware release. No actual phone/router result, signed APK/IPA, packaged Electron acceptance or production deployment was supplied during preparation. Device model/OS and router firmware remain unspecified until the tester records them.

## Implemented preparation

- A versioned acceptance plan defines 33 gates and six scoped profiles. Candidate records bind an exact committed source revision, plan hash, artifact hashes and redacted attachments. Every gate starts pending. Passed results require the correct stage, commit, artifact binding, tester/environment, past UTC observation and attached notes; synthetic claims cannot satisfy physical/deployment/distribution gates. Unknown/duplicate/missing gates and changed evidence reject.
- The helper reports evidence completeness only and always returns `releaseAuthorized: false`. It cannot establish tester truthfulness, verify native APIs/hardware or authorize publication. It never executes artifacts, installs tools or contacts a provider.
- Read-only Android/iOS prerequisite inspection checks selected existing paths without invoking native tools or triggering installation. Missing selected paths leave build/signing/device status pending. Path presence alone never passes a build.
- Android and iOS guides provide separately prepared build-host options, artifact/signing records, actual-device scenarios, accessibility/privacy checks, defect reports and the correction cycle. Separate remote/desktop, router/operations and supported-environment guides preserve conditional feature boundaries.
- iOS Debug app/extension identifiers now consistently use `com.netsentry.app.native.dev` through `NETSENTRY_BUNDLE_PREFIX`; Release retains `com.netsentry.app`. This avoids replacing the Flutter reference during development. Project generation remains reproducible without Apple tooling, and no signing team or entitlement is activated. Actual provisioning/co-installation is still a physical build gate.
- `mobile/` is preserved. No Flutter retirement, provider setup, production grant/deployment, persistent service, signing key or installer/update mechanism is created.

## Available checks

- Root `npm run check` passes: new plan/evidence tests, deployment source and package-verifier tests, 162 API operations, 14 synthetic fixtures, 20 contract tests, Android contract/source checks, iOS project/plist/syntax checks, backend build and 69 tests across 16 suites, desktop TypeScript/renderer build, dashboard lint and production build.
- Eight focused release-helper tests cover pending initialization/profile scope, omitted/duplicate/foreign/status/plan rejection, commit/stage/hash/attachment/time mismatch, synthetic physical rejection, changed files, symlink/empty/non-file rejection, completeness without authorization, missing native prerequisites and present-paths-without-build claims. Their artifact/evidence bytes are deliberately synthetic; no test result here is a phone observation.
- Existing host Swift Foundation core compilation/tests pass. The 27 Swift files parse in both feature modes. iOS project checks additionally verify Debug/Release prefix consistency for all six targets and absence of provisioned signing authority. No SwiftUI/iOS type checking is claimed.
- Existing-path inspectors return `prerequisites_missing` and keep native builds/signing/device checks pending in this workspace. Android build-host paths were not selected; Xcode/iPhoneOS build paths are unavailable. The inspector installs/runs no native tool.
- The unchanged native/network/backend integration suites remain in hosted CI; historical Phase 14 evidence is separately recorded. A rerun with synthetic fixtures remains integration evidence, not Phase 15 physical acceptance.

No Android Studio, mobile SDK, Xcode, simulator or emulator was installed. No APK/IPA was produced. No phone/router scan, real message, live charge, background service or production schema change was performed.

## Required next evidence

Use [the handoff](../release/README.md) and choose the relevant profile. Obtain a signed candidate on an independently prepared build host while retaining the current no-install constraint. Record the exact device/OS, source and artifact, test actual behavior, and return redacted defects for fixes on `develop`.

Native compile/signing, actual Android/iPhone permissions/lifecycle/accuracy/erasure, phone-to-desktop control on another network, optional Apple approval/extension/privacy manifest, exact router/firmware behavior, packaged Electron/Keychain, real deployment/recovery/performance targets and installer/update recovery remain pending. Unsupported monitoring, push, policy and paid-purchase capabilities remain unavailable. Restrict release claims to accepted combinations; do not bypass failed/unimplemented gates by marking them not applicable.

Phase 15 completes only after the required device/hardware/native/distribution acceptance and correction cycle have evidence. Flutter retirement remains a separate user decision after acceptance.
