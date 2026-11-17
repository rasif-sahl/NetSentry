# Mobile bottom navigation verification

17 November 2026. Source implementation and offline design verification only; no native app build or physical-device claim.

## Completed

- Android source: Material 3 bottom bar with five tabs and 21 submenu destinations, section routing, visible Back and system Back handling, scoped saved navigation, and separate scrollable content.
- iOS source: five `TabView` tabs with independent `NavigationStack` menus and 20 submenu destinations; scoped navigation reset and native Back links. Local Apple controls remain gated.
- Offline design catalogue: 66 previews, including five landing menus per platform, clickable bottom tabs/submenus, Back, related states and searchable screen gallery.
- `npm run check:android`: emitted synthetic contract fixtures pass. This is not execution of the native UI.
- `npm run test:android-core` using the existing standalone Kotlin/JDK tools: 35 repository/policy checks, 14 detailed reducer checks, family synchronization checks, emitted fixture checks and parsing of 18 Kotlin files pass. Parsing does not resolve Compose/Android APIs.
- `npm run check:ios`: 27 Swift files parse with the Screen Time flag on and off; source references, extension boundaries, project and plist checks pass. This is not SwiftUI type checking.
- `scripts/design/check-mobile-designs.cjs` using existing desktop Chrome: all 41 submenu destinations, tab selection, Back, related variants, search, hidden signed-out tabs, browser Back and a narrow viewport pass. Native route labels are checked against the design map. These checks execute HTML, not Compose or SwiftUI.
- Four PNG design sheets export without clipped content; bottom-navigation overview visually inspected. No API requests, monitoring readings, remote commands or permission grants occur in the designs.
- `git diff --check` passes.

## Pending on separately prepared native build hosts / real devices

- Android/Compose and iOS/SwiftUI compilation, native packaging and signing.
- VoiceOver/TalkBack, text scaling, translated labels, landscape/tablet layouts, safe areas, gesture/three-button navigation, keyboard insets and reduced motion.
- Actual native Back behavior, per-tab iOS history, Android rotation/process restoration and reset after account/workspace changes.
- Real API integration of the reorganized native screens, permission transitions, offline/error recovery, sharing flows and separately confirmed desktop commands.
- Apple approval, entitlements and provisioning for Screen Time; no capability or enforcement is granted by navigation.

No Android Studio, SDK, emulator, simulator, Xcode or browser runtime was installed.

## Floating dock refinement

The Android bottom bar is now clipped to a rounded 28 dp surface with side margins and navigation-bar-safe bottom spacing. The iOS tab selection is presented through a custom rounded material dock above the home indicator, while `TabView` keeps the per-tab stacks. Both designs include a soft shadow and selected-tab highlighting. Existing destination counts and Back behavior are preserved. Swift syntax checks, Kotlin/core checks and the browser navigation checks pass after the styling change; native rendering and inset/keyboard/accessibility checks remain pending.
