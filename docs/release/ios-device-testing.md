# iPhone and optional Screen Time handoff

Current status: SwiftUI source, host Foundation checks and synthetic HTTPS integration exist. iOS framework type checking, signed native apps, provisioning and device execution remain pending. This phase installs no Xcode, mobile SDK or simulator. Use an independently prepared Mac/build host or a tester-supplied signed build; existing Command Line Tools cannot produce this native application by themselves.

## Default app candidate

Start with `NetSentry` scheme, which excludes optional Screen Time authorization and extensions. The generated Debug bundle prefix is `com.netsentry.app.native.dev`; Release stays `com.netsentry.app`. `NETSENTRY_BUNDLE_PREFIX` consistently prefixes app and extension bundle identifiers. A team may need a different registered development prefix; override it consistently across targets on the build host and record the resolved identifiers. No team, certificate or entitlement is provisioned here. Debug and Release keychain access/provisioning must be reviewed independently.

On a separately prepared Mac with a compatible **existing** Xcode/iPhoneOS SDK, assign the tester's signing team and profiles, register/prepare the physical device as required and use that phone as the run destination. Example manual build, not executed here:

```sh
xcodebuild -project ios/NetSentry.xcodeproj -scheme NetSentry \
  -configuration Debug -destination 'platform=iOS,id=DEVICE_UDID' \
  -derivedDataPath /private/build/NetSentryDerivedData \
  DEVELOPMENT_TEAM=APPROVED_TEAM_ID build
```

Do not add automatic provisioning/account updates to a script. Resolve native API/project errors first, then record the actual build log, commit, Xcode/SDK, iPhone OS/model, resolved bundle ID, signer/profile and SHA-256 of the exported signed candidate archive/IPA. Use the existing build host's Xcode installation or approved distribution tooling to install/run on the actual registered phone. This handoff does not create an IPA, TestFlight account or App Store submission. See [Apple's physical-device build/run guide](https://developer.apple.com/documentation/xcode/building-and-running-an-app) and [Developer Mode guide](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).

The repository has no reviewed `PrivacyInfo.xcprivacy` manifest yet. Review actual collected data and required-reason APIs, add accurate manifest resources to all applicable targets/dependencies, inspect the final archive and complete distribution privacy declarations before claiming that gate. Do not add an empty manifest that falsely claims no account/device data exists. See [Apple's manifest guide](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk) and [data-use declaration guide](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests).

## Default iOS acceptance

Use the `ios` profile with the exact default-app artifact and server manifest. Test VoiceOver, Dynamic Type, rotation, small phone/iPad where advertised, loading/error/empty states and document-export destinations alongside each applicable gate.

| Gate | Steps | Expected observation |
| --- | --- | --- |
| `ios.account` | Verify accounts/enrolment; switch workspace/account during requests; lock/unlock/relaunch; sign out while offline; inspect Keychain failure handling | Protected data is scoped and cleared, session renewal is safe, no plaintext fallback or automatic monitoring |
| `ios.capabilities` | Read empty/gapped reports and capability states; background/foreground app; inspect stale computers | Device-wide network/Screen Time upload remains unsupported; missing data is not zero, periodic refresh happens only in the visible view |
| `ios.privacy` | Accept/withdraw device sharing; change role/revision; export, erase, unenrol; repeat offline and with denial | Owner acceptance is explicit, server failures remain visible, local access/selection cleanup is verified without claiming unreceived remote changes |
| `ios.notifications` | Evaluate configured rules and inspect in-app preferences/acknowledgement | In-app behavior is verified; APNs registration/provider is unconfigured and must remain unavailable |
| `ios.remote` | Follow the cross-network phone-to-controlled-process checklist | Fresh exact intent, separate force confirmation, uncertain-result recovery, no automatic offline replay |
| `ios.distribution` | Inspect signing/profiles, privacy manifest and final archive; install/upgrade; review distribution and native payment requirements | Evidence names actual channel/artifact and approved identifiers; source does not establish store approval |

## Optional local Screen Time acceptance

Only use `ios-screen-time` when a separately signed `NetSentryScreenTime` app exists. It includes both default iOS gates and four additional gates; it does not reuse the default app artifact as optional-feature evidence. All four extension identifiers inherit the selected bundle prefix: `.ActivityMonitor`, `.ActivityReport`, `.ShieldConfiguration`, `.ShieldAction`.

- `screen-time.provisioning`: obtain applicable app/extension Family Controls approval, actual target-specific profiles/entitlements and an approved App Group. Verify all four extensions are embedded and signed, target membership is correct and app/monitor use the approved group. The example entitlement/config files grant nothing. Check [Apple Family Controls entitlement guidance](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement).
- `screen-time.enforcement`: test explicit individual and valid Family Sharing child authorization, opaque selection, schedule and threshold timing, actual shield appearance and supported local override/recovery. A NetSentry guardian role is not Apple child authorization. Web request approval alone must not silently unblock iOS.
- `screen-time.cleanup`: observe actual shield removal at expiry and after revocation, selection replacement, workspace/account change, sign-out, device lock/reboot and time discontinuity. Exercise unavailable/corrupt App Group state and failed/offline server withdrawal. A local lease check does not prove an OS callback ran or shields were removed. If cleanup cannot be confirmed, keep the gate failed and use Apple's authorized system recovery.
- `screen-time.isolation`: inspect the real report's authorized device/time scope, empty-data handling, opaque tokens and extension isolation. Report measurements must stay in the report extension; they cannot be uploaded to make Android-style backend reports.

Explicitly stop controls and erase selections **before** replacing an enabled build, bundle prefix, entitlement/App Group or installing the default disabled build. Changing identity does not guarantee cleanup of an older app's named managed settings. Retain Flutter until native acceptance and user approval.
