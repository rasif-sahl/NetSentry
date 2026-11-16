# Physical-device acceptance and release handoff

Phase 15 is **in progress: prepared for testing, not accepted for release**. Native APK/IPA builds, signing, actual phone behavior, packaged Electron/secure storage, router hardware and production deployment/update acceptance are pending. Existing SDK-free tests and synthetic fixtures remain integration evidence only. Flutter stays in `mobile/` until the native replacement has passed acceptance and the user approves retirement.

No repository command here installs Android Studio, mobile SDKs, Xcode, simulators or emulators. Keep that constraint in place. A phone still needs a compiled, signed native application: use a separately prepared build host or a tester-supplied signed artifact when available. Do not infer native compilation from Kotlin parsing or host Swift tests.

## Test order

1. Record phone model/OS, desktop OS/architecture, exact router model/firmware where relevant, the source commit and actual artifacts. Use a dedicated test workspace with test accounts and controlled sample data. Choose a domain profile rather than implying every feature is supported.
2. Complete backend/deployment checks and native build/signing review. Never point a phone at loopback fixture API port 54110. Use a reachable verified HTTPS test API and actual configured mail verification; fixture actors/data are not real account or phone evidence.
3. Follow [Android](android-device-testing.md), [iOS](ios-device-testing.md), [desktop and remote control](desktop-and-remote-testing.md), and [router/operations](network-and-operations-testing.md). Keep default iOS and optional Screen Time acceptance separate. Test supported features and verify that unsupported fields/actions stay unavailable.
4. Record actual observations, failures and environment limits. Send a redacted defect report with gate ID, source/artifact hashes, model/OS, reproducible steps, expected/actual outcome and UTC time. Keep passwords, tokens, full project paths, device serials, router secrets and personal exports private. Correct defects on `develop`, rerun affected checks and create a fresh candidate record; never reuse an old passing record for changed artifacts.
5. Review evidence and scope before a release decision. There is no automatic publication, installer, background-service registration or Flutter deletion in this workflow.

## Evidence helper

`acceptance-plan.json` defines 33 gates and six profiles: `android`, `ios`, `ios-screen-time`, `desktop`, `network`, `all`. Every profile includes backend build/boundary/recovery/deployment checks. A profile covers only the explicitly listed gates; Android alone does not certify iOS, optional Screen Time, router hardware or desktop installers.

```sh
npm run check:release
npm run test:release
# Inspect selected existing paths only; exit 2 means prerequisites are missing.
node scripts/release/native-prerequisites.mjs android
node scripts/release/native-prerequisites.mjs ios
# After committing the candidate, create a NEW local record. The ignored directory
# must be created by the tester; files may instead live outside the repository.
mkdir -p release-evidence
node scripts/release/acceptance.mjs init android release-evidence/android-candidate.json
node scripts/release/acceptance.mjs fingerprint /private/build/app-debug.apk
node scripts/release/acceptance.mjs report release-evidence/android-candidate.json
```

`init` refuses a dirty tracked/untracked checkout and existing output files, binds the exact commit and plan digest, and marks every selected result **pending**. It passes no checks automatically. `native-prerequisites` reads explicitly selected existing paths (`JAVA_HOME`, `ANDROID_HOME`, `NETSENTRY_GRADLE_EXECUTABLE`, or `DEVELOPER_DIR`); absent selections do not prove software is uninstalled. Even present paths are not version/build/signing evidence. No executable is run by the inspector.

Edit the private candidate JSON only after collecting results. Each artifact slot is null until supplied as `{ "path": "/private/build/app-debug.apk", "sha256": "<64 lowercase hex>" }`. Fingerprint the exact APK/IPA, desktop archive, agent executable or server manifest used during testing. A server manifest is a private reviewed JSON file containing backend/dashboard commit and image digests, migration set and nonsecret environment description, not an `.env` dump. The optional Screen Time app has its own artifact slot.

A passing result needs this structure (placeholder values are intentionally invalid):

```json
{
  "id": "android.account",
  "status": "passed",
  "evidence": {
    "stage": "physical",
    "sourceCommit": "<exact 40-character candidate commit>",
    "artifactHashes": {
      "android-app": "<exact candidate APK digest>",
      "server-manifest": "<exact server manifest digest>"
    },
    "environment": "Phone model, Android version/build, API environment and workspace alias",
    "tester": "Tester alias",
    "observedAt": "2026-11-16T08:00:00Z",
    "synthetic": false,
    "result": "Actual steps, expected/observed behavior, measured coverage and limitations",
    "attachments": [{ "path": "account-test-notes.txt", "sha256": "<digest of redacted notes>" }]
  }
}
```

Use the exact stage/artifact IDs from the plan. Pending/blocked/failed rows keep `evidence: null`; keep associated defect notes alongside the private record. There is no `not_applicable` bypass: choose the correct narrower profile and explicitly limit advertised support. A test environment with synthetic readings can satisfy an integration gate, never a physical/deployment/distribution gate. Field `synthetic: false` is a human statement, not independently verified truth.

`report` rehashes artifacts and attachments, rejects missing/duplicate/foreign gates, changed plans, mismatched commits/digests, wrong stages, future timestamps and synthetic physical claims. Exit 2 means incomplete evidence; exit 1 means invalid evidence; exit 0 means structurally complete human-supplied evidence. It **always** returns `releaseAuthorized: false`. It does not verify signatures, ownership, tester truthfulness, native APIs or hardware, execute artifacts or authorize publication. Independently review actual records and OS signatures. Protect the private record and files; hashes establish consistency, not authenticity.

## Release decisions and support claims

Keep source, portable builds, integration tests, signed native builds, real-device observations and deployment checks distinct. No phone/router/firmware is certified yet. Do not advertise usage accuracy, continuous background execution, hotspot/client attribution, applied parental controls, Apple approval, push delivery, paid purchases or installer/update support from source/fixture checks. Retain unavailable states until the corresponding evidence exists. Distribution privacy/store policies and payment decisions remain separately reviewed launch gates.

The operator release decision should name the exact commit, profile, artifacts, supported environment combinations, known limitations, reviewer, evidence location and explicit approval date. Do not mark Phase 15 complete until the required native/hardware acceptance and correction cycle is finished.
