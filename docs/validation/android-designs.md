# Android design implementation

17 November 2026. The approved source-based Android previews have been applied to the Kotlin/Compose UI in root `android/`. This record covers source implementation and available host checks, not a rendered native app or APK.

## Implemented

- `AppTheme.kt`: explicit light and dark lavender palettes, account SYSTEM/LIGHT/DARK selection, common type sizes and rounded Material shapes. No external fonts or bitmap assets are required.
- `AppChrome.kt`: rounded full-width submenu cards with chevrons, focused page headers and Back controls, workspace context, polite status notices and a floating dock with full selected-tab capsules and code-native icons. Tab roles and selected semantics are exposed to accessibility services.
- `PersonalApp.kt`: the five tab menus, account/recovery/verification, device/permission/consent, reports, alerts, computers and settings screens share the new theme and card/field styles. Destructive device/account actions and confirmation controls use the error color. Consent rows combine the label and checkbox into one toggle target. The scrollable body consumes Scaffold insets and applies keyboard padding.
- Family, Business and Subscription sections now use the same lavender cards. Family request fields use the shared full-width inputs. Business and Subscription show explicit unloaded states rather than sample records.
- Application reports, categories, timeline and health thresholds already use the shared panel/input components and inherit the new visual system. Account/session, workspace, measurements, sharing and remote-command authorization behavior stays in the existing repositories. UI previews are not substituted for API responses.
- Development-only build/testing text was removed from the user-facing page footer and remains in repository documentation.

## Verification

`npm run test:android-core`, using the existing standalone JDK/Kotlin tools, passes 35 repository/policy checks, 14 detailed reducer checks, family synchronization checks, emitted contract fixtures and parsing of all 20 Kotlin source files. Kotlin parsing verifies grammar, not Compose/Android API types or rendering. No new native tooling was installed.

`node scripts/release/native-prerequisites.mjs android` reports missing configured Gradle/Android SDK/build-tools/device prerequisites. The standalone JVM tools used above are separate from a complete Android build host. `git diff --check` passes.

## Pending

- Android/Compose compilation, dependency/API resolution, APK packaging and signing.
- Actual screenshot comparison against the light-mode design catalogue; dark appearance on native Android.
- TalkBack, large text, RTL, narrow/tablet/landscape layouts, keyboard and gesture/three-button navigation insets, process restoration and physical-device checks.
- Real-device API, permission, collection, Family/Business sharing and remote-command acceptance through the styled screens.

The HTML design catalogue remains a visual reference. It is not an Android renderer and does not establish native visual parity.
