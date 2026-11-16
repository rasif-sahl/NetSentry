# Native iOS application

Swift/SwiftUI source for iOS 17, Swift language mode 5, bundle identifier `com.netsentry.app`. The Flutter-owned `mobile/ios/` remains untouched. No mobile SDK, Xcode, simulator or emulator is installed by this project.

The client includes accounts/recovery/verification, device-only Keychain sessions, workspace selection, explicit IOS enrolment, conservative metadata/capabilities, server reports with quality/gaps, in-app alerts/rules, family sharing/requests, privacy controls/export, settings and confirmed desktop stops. These are source implementations, not a signed iOS build. Read [architecture and limitations](../docs/architecture/ios-client.md) and [validation](../docs/validation/phase-12.md).

## Existing host checks

With existing Node 24/contracts dependencies and Apple Command Line Tools:

```sh
npm run check:ios
npm run test:ios-core
```

`check:ios` validates references, target/privacy boundaries and plists, then parses all Swift files with the feature flag on/off on macOS. This does not resolve/type-check SwiftUI or iOS frameworks. `test:ios-core` compiles and runs the actual portable Foundation repository on the macOS host, then validates its emitted wire payloads against shared contracts. No native app or extension build runs. It requires an already-installed compiler/macOS host SDK; `SWIFTC` and `SWIFT_HOST_SDK` can select existing paths. It does not download tools. Keychain source can be host-type-checked separately; tests use a memory vault and do not write real account credentials.

`npm run test:ios-live` requires a dedicated **empty** PostgreSQL database whose name ends in `_test`, the existing built backend and `TEST_DATABASE_URL` (`TEST_DATABASE_SSL=false` only for an isolated local database). It starts the real fixture API and an ephemeral HTTPS proxy. A test-only delegate trusts only the generated CA for that session while checking certificate/hostname validity. It does not alter system trust. All actors, devices, observations and commands are synthetic; no Apple APIs, real usage collection or process shutdown occur. The harness removes fixtures/schema and temporary TLS material on normal completion. Do not run multiple fixture harnesses on port 54110 concurrently.

## Targets and later physical-device handoff

`NetSentry` is the default app scheme. Family Controls is disabled; no permission request or schedule starts automatically. `NetSentryScreenTime` is a separately gated app target with four embedded extension targets: ActivityMonitor, ActivityReport, ShieldConfiguration, ShieldAction. The optional target defines `NETSENTRY_SCREEN_TIME`. Neither scheme has an assigned signing team or active entitlements. `scripts/make-project.py` reproduces source references, targets, plists and schemes without invoking Apple tooling.

When explicitly authorized to prepare physical-device testing later:

1. Use an already available compatible Xcode/iOS SDK or arrange tooling separately with the user. Open `NetSentry.xcodeproj`; build the default scheme for a connected iPhone/iPad first. Resolve iOS type/API errors and project packaging findings before claiming a build.
2. Assign real team, unique app/extension identifiers and profiles. If Flutter is co-installed, use an approved distinct development bundle identifier and matching extension prefixes. TestFlight/App Store builds need distribution certificates, profiles, archives and App Store Connect configuration. None are provisioned here.
3. For the optional scheme, request Apple's Family Controls distribution approval for the app and **each extension**. Configure an approved App Group for the app and monitor, with identical `NETSENTRY_APP_GROUP` build settings and actual target-specific entitlements. Report/shield source shares no files and does not need that group. Tailor the unreferenced `.example` templates; their presence grants nothing. Configure `CODE_SIGN_ENTITLEMENTS` per approved target only then.
4. Confirm all four extension products are embedded/signed; their identifiers/profiles match the app. Confirm the report extension uses its Swift `@main` entry without a principal-class key. Test the real authorization sheet and opaque picker for individual and correctly authorized child accounts.
5. Test nonrepeating scheduled and threshold controls, current permission revocation, selection replacement, time changes/DST, app backgrounding/force-quit, reboot/lock, corrupt shared files and end callbacks. Confirm cleanup after sign-out, workspace/account changes, family withdrawal and failed server requests. Source expiry validation does not guarantee OS callbacks or automatic shield removal. Use Apple's system revocation/recovery if local cleanup fails.
6. Stop controls and erase selections **before** replacing an enabled build with the default disabled scheme, changing App Groups, uninstalling or changing signing identities. The disabled build attempts clearing its own named store, but cannot promise access to a differently provisioned group's old files.
7. Verify report privacy: no usage report data leaves its extension or appears in App Group/API traffic. Verify combined/empty scopes are labeled correctly. Verify server family policy approval is not presented as an applied iOS restriction.
8. Verify VoiceOver, Dynamic Type, light/dark/reduced motion, rotation, iPad layout, keyboard focus and destructive confirmations on real devices. Review failed/resumed auth, certificate rejection, uncertain remote commands and account export handling.
9. Configure APNs provider/device registration and validate delivery separately before enabling push. This source requests no push entitlement or permission and sends no report data via notifications.

No simulator is required. Native build, provisioning, distribution and this hardware checklist are pending release gates.

Phase 13 adds a Business employee view with explicit, generation-bound organization sharing acceptance and withdrawal. Organization administration is in the web dashboard. The Foundation repository clears Business views on scope loss/logout; sharing does not enable monitoring or authorize Apple controls. Portable Swift and isolated HTTPS checks exercise these flows with synthetic accounts. Native SwiftUI type checking, package signing and physical-device acceptance remain pending. No Apple tooling was installed.

Phase 14 adds a read-only SwiftUI Subscription tab with entitlement status and limits. No native or external purchase flow is enabled. Host Foundation/HTTPS checks and syntax parsing do not establish an iOS/SwiftUI build or device acceptance.
