# Native mobile navigation

The signed-in Android and iOS applications use five persistent bottom tabs: **Home, Usage, Family, Computers, More**. Each tab opens a submenu; selecting a row opens only the relevant section. Account registration/recovery/verification stays outside this navigation. Navigation grants no permission and sends no monitoring, sharing or remote-stop mutation.

| Tab | Shared submenu destinations |
| --- | --- |
| Home | Workspace selection; This phone; Device inventory; Permissions & consent |
| Usage | Usage reports; Alerts & rules; In-app notifications |
| Family | Child profiles; Wellbeing reports & policy status; Sharing & consent; Time requests & decisions |
| Computers | Paired computers & services; Command history |
| More | Business; Subscription; Profile & appearance; Notification preferences; Privacy & account |

Android adds **Application usage, Categories & corrections, Timeline & evidence** under Usage: 21 submenu destinations, 26 total including the five tabs. iOS adds **Local Apple Screen Time controls** under Family and **Sessions** under More: 20 submenu destinations, 25 total. The local Apple route labels the default build as disabled; it does not enable the separately provisioned Screen Time target.

## Behavior

- Android uses Material 3 `Scaffold`, `NavigationBar` and `NavigationBarItem`. The bar floats in a rounded 28 dp surface with 16 dp side margins, a 12 dp gap above the navigation-safe area and a soft shadow. System insets are applied outside the dock, and content scrolls independently above it. A visible Back control and Android system Back return to the submenu; system Back from a non-Home submenu returns Home. Selecting a tab opens its submenu. Navigation selection survives configuration changes with `rememberSaveable`.
- iOS uses `TabView` with a separate `NavigationStack` per tab. The system tab bar is hidden in favor of a rounded floating material dock with 16 pt side margins, a 12 pt bottom gap and a soft shadow, placed with `safeAreaInset` above the home indicator. Accessible tab buttons retain selection state. `NavigationLink` supplies platform Back and stack history. Each tab retains its stack while switching tabs.
- Account/workspace changes and sign-out reset the scoped navigation and discard destination-local form state. Sign-in screens show no signed-in bottom tabs. Consent checkboxes and remote confirmations are not preserved across destination changes.
- Existing authorization, consent, confirmation, disclosure and data-quality boundaries remain in place. Busy state gates mutations. Empty inventories and missing reports stay explicit.
- Family reads and visible Computers polling retain the existing repository/session boundaries. No command is queued by navigation. Manual refresh controls remain available for alerts, reports and inventories.
- Sensitive details, permission instructions and conditional reports remain inside their corresponding destination; selected child profiles can be changed from Family sections. Device management, alert creation, export and destructive confirmations are subordinate flows, not additional main tabs.

## Designs

`docs/design/mobile/index.html` is a self-contained, offline design preview with clickable bottom tabs, all submenu routes, Back behavior, a searchable 66-view gallery and related-state selectors. `navigation.json` maps native route labels to illustrative previews. Long source pages and conditional states have separate gallery cards; the number of previews is not the navigation count. HTML forms and dialogs are illustrations and never call APIs.

Build the bundled catalogue with `python3 scripts/design/build-mobile-designs.py`. With dashboard Playwright dependencies and an existing desktop Chrome, run:

```sh
PLAYWRIGHT_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/design/check-mobile-designs.cjs
```

The browser check exercises all 41 submenu routes, tab selection, Back, variants, search, signed-out tab visibility and a narrow layout, and checks that route labels exist in native declarations. It does not execute either native UI. Native compilation, accessibility, safe-area/inset behavior, gesture navigation, state restoration and physical-device acceptance remain pending.

The [17 November verification record](../validation/mobile-navigation.md) distinguishes passing host/design checks from pending native integration and device checks.
