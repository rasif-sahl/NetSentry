# iOS design implementation

17 November 2026. The approved iOS previews are implemented in SwiftUI source in root `ios/`. This record distinguishes source and host verification from pending native compilation, screenshots and device acceptance.

## Source coverage

- `UI/AppStyle.swift` provides semantic light/dark system colors, blue accents, grouped forms, consistent row sizing, grouped submenu rows with native chevrons, status notices, page backgrounds and the floating material dock. Native text styles continue to support Dynamic Type.
- All five tab landing menus and 20 submenu destinations use the shared styling. The dock retains a 28 pt radius, selected-tab capsules, 16 pt side margins, safe-area bottom spacing and a soft shadow. Tab buttons expose selected traits and identifiers for future device UI checks. `TabView` retains the separate per-tab navigation stacks; account/workspace identity continues to reset scoped navigation.
- Sign-in, registration, verification and recovery share the styled account form, with no signed-in dock.
- Workspace, installation pairing/heartbeat, capabilities/consent, device privacy, server reports, alert rules and notifications use `AppForm` and the shared disclosure treatment.
- Family profile/report/sharing/request sections, Business assignments/sharing and Subscription status use the grouped form treatment and explicit empty/unloaded states.
- Paired computer/service inventory and command history use consistent spacing and grouped rows. The nested remote-stop confirmation sheet uses the same form and page styles; exact intent capture, independent graceful/force confirmation and uncertain-outcome handling remain intact.
- Profile/appearance, notification preferences, sessions, exports/deletion and local recovery use the shared form. Native confirmation dialogs, document exporters and destructive roles remain native system surfaces.
- Local Apple authorization/selection/schedule controls inherit their containing Family form. The report extension uses a separate rounded system-background summary with a header and explicit unavailable state. Its source remains isolated from app/network/storage code. The existing shield already uses the approved system-background/blue-button presentation. Apple authorization sheets/activity pickers remain OS-owned, and controls remain separately gated.
- Both app targets reference the new styling source through regenerated project/scheme references. No signing team, entitlements or platform installation was added.

## Completed checks

- `npm run check:ios`: all 28 Swift source files parse with Screen Time enabled and disabled; project/plist references, optional extension targets and report privacy boundaries pass. Parsing does not type-check SwiftUI/iOS APIs.
- `npm run test:ios-core`: the real portable Foundation repository/Keychain host checks pass, covering session and URL boundaries, local leases, scope races, confirmed remote intents/retries, persistence and offline logout. Swift-emitted capability and remote-stop payloads match shared contracts. No actual iOS UI or monitoring executes.
- `git diff --check` passes.
- `node scripts/release/native-prerequisites.mjs ios` confirms that Xcode build tools and an iPhoneOS SDK are not configured. No tooling was installed.

## Pending

Native SwiftUI/iOS type checking and compilation, signing/distribution, real API/device integration through the styled UI, visual comparison against the approved light-mode previews, dark appearance, VoiceOver/Dynamic Type, narrow/iPad/landscape layouts, keyboard/home-indicator spacing, per-tab Back history and account/workspace reset on real devices remain pending. Optional Screen Time still requires Apple approval/provisioning and physical-device validation. The HTML preview is a design reference, not proof of native rendering.
