# Native iOS client decisions

Phase 12 uses Swift 5 language mode, SwiftUI and iOS 17 source in root `ios/`. `mobile/` remains the Flutter reference. Native compilation, API availability/type checking, signing and hardware acceptance are separate gates. No mobile toolchain is installed by repository scripts.

## Accounts and API boundaries

The Foundation actor repository scopes async results to an account/workspace epoch. Access-token renewal is single-flight. A lost rotating refresh response clears credentials rather than replaying an old refresh. A denied response clears protected views. HTTPS URLs must end exactly in `/api/v1`, with no credentials, query or fragment. The ephemeral URLSession forwards no redirects, stores no cookies, disables caching and caps decoded response bodies. Mutations have no transport retry loop; an explicit 401 may renew access before one authenticated replay. No TLS trust override ships in the application.

Account/device credentials and the exact uncertain remote-stop intent are stored together in the unlocked, device-only, nonsynchronizing Keychain. There is no plaintext fallback. The App Group receives only opaque Apple selection tokens, a local scope/expiry lease and local callback state; it receives no account/device credentials. Account export remains in memory until explicitly saved through the system document exporter. Logout/account changes clear prepared exports and local controls. Failed server logout does not preserve local credentials.

Pairing requires the displayed `device-enrolment-v1` acceptance and creates an IOS installation binding. Metadata heartbeat does not grant monitoring consent. The iOS client uploads no device-wide network totals or Screen Time measurements. Its capability report uses schema-supported `restricted_by_os`/`temporarily_unavailable` statuses with empty actions; source implementation and a capability declaration confer no authority.

## Desktop controls

The UI shows current server-granted computers, projects, PIDs, start/observation times, ports and command history. Graceful and force-stop have separate confirmations. An intent captures the exact service and observation IDs, mode, children flag, account/workspace and one UUID. It must match an online, permitted service observation at most ten seconds old; children are bounded at sixteen. Both client and backend recheck freshness and grants.

Keychain retains the exact intent before sending it. After response loss, the user checks history and may explicitly retry the same UUID/body only inside its original deadline. There is no offline command queue, background mutation replay, retargeting to a replacement process or arbitrary shell/PID entry. Dismissing local state does not cancel the server command. Server pending-command cancellation is separate. Agent acknowledgement/outcome, rather than HTTP acceptance, establishes what happened. Automatic five-second inventory/history refresh runs only in the visible foreground Computers view.

## Apple controls and report isolation

The default `NetSentry` scheme never requests Family Controls authorization or starts schedules. `NetSentryScreenTime` compiles the explicit feature flag and embeds Monitor, Report, Shield Configuration and Shield Action targets. Both are source preparations, not provisioned products. No signing team, active entitlement file or approved App Group is checked in. Examples under `ios/Provisioning/` are deliberately unreferenced. Each target requires appropriate Apple approval and provisioning before distribution.

Authorization is requested explicitly for `.individual` self-management or `.child` Family Sharing authorization. A NetSentry guardian role is not Apple authorization or proof of guardianship. The picker stores only local opaque selections. Server Android app IDs and category policies are never translated into Apple tokens. Server request approvals do not automatically unblock iOS. Existing server family receipts continue rejecting `applied`.

A user must explicitly accept a local schedule or activity threshold, select opaque tokens and use an authorized, provisioned App Group. One nonrepeating window lasts at least fifteen minutes and expires within twenty-four hours of creation. A lease binds it to the signed-in account/workspace and checks wall time against monotonic uptime; detected clock changes/reboots invalidate it. Activity names contain the lease UUID. Old callbacks cannot apply a replacement selection. A process lock serializes selection/lease changes and managed-setting writes between app and monitor. Revocation, expiry, scope changes and privacy/logout flows request clearing this app's named store and its own monitors only. Corrupt data fails closed. Storage/cleanup failures are displayed as unverified cleanup, never successful enforcement. Reboot/end-callback reliability, OS scheduling limits and clock changes require physical acceptance; source expiry checks alone are not an OS guarantee.

The Monitor requests shields at interval start or threshold, clears at end and records warning callbacks locally. It does not deliver a push or upload usage. Apple may count earlier authorized activity within the threshold interval; the UI makes no exact post-consent accounting promise. Shield actions close the shield interaction; they do not open the app, grant extra time, contact the backend or silently approve a request.

Device Activity report totals are computed and rendered **inside the report extension only**. Report source has no API, Keychain, App Group or file-storage dependency; no measurements are exported to the main app. No segments means unavailable rather than zero. The UI labels the authorized, potentially combined-device scope. Shield configuration likewise has no network or shared-storage code.

## Apple references

- [Family Controls](https://developer.apple.com/documentation/familycontrols) and [opaque selection](https://developer.apple.com/documentation/familycontrols/familyactivityselection)
- [Requesting Family Controls distribution entitlement](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement)
- [Device Activity reports and extension privacy](https://developer.apple.com/documentation/deviceactivity/deviceactivityreport)
- [Report scenes](https://developer.apple.com/documentation/deviceactivity/deviceactivityreportscene) and [schedules](https://developer.apple.com/documentation/deviceactivity/deviceactivityschedule)
- [Shield configuration isolation](https://developer.apple.com/documentation/managedsettingsui/shieldconfigurationdatasource) and [shield action delegate](https://developer.apple.com/documentation/managedsettings/shieldactiondelegate)

These references inform source design; they do not establish app approval or tested OS behavior. APNs provider configuration, device token registration and delivery remain pending. Reports and family views use authorized backend data with quality/gap labels; no demonstration measurements ship in the app.

## Shared UI styling

`UI/AppStyle.swift` centralizes the approved iOS grouped form appearance, menu rows, page backgrounds, status cards and safe-area floating tab dock. It uses semantic system colors and native text styles for light/dark appearance and Dynamic Type. Account and every signed-in destination use the shared form/chrome while native confirmation dialogs, activity pickers and document exporters remain system-owned surfaces. Report-extension styling remains independent from this app-only source. See [iOS design coverage and checks](../validation/ios-designs.md) for implementation details and pending native verification.
