# Candidate support and evidence matrix

Status as of 16 November 2026. This is a source/verification boundary matrix, not a production support promise. Update exact rows only after reviewing candidate-specific evidence. Source version numbers and build targets are not store eligibility.

| Component | Source baseline / available evidence | Pending acceptance |
| --- | --- | --- |
| Android | API 26 minimum / compile-target 35; Kotlin 2.1.20 and Compose; SDK-free core, emitted contracts and synthetic HTTPS integration | Android/Compose compilation, signed APK/AAB, model/OS-specific measurement/lifecycle/privacy/UI, other-network stop and distribution |
| iOS default | iOS 17 / Swift 5 / SwiftUI; Foundation host tests and source parsing; synthetic HTTPS integration | iOS API/build, actual Keychain, signing/provisioning/privacy manifest, physical phone/UI/remote control and distribution |
| iOS optional Screen Time | Explicit separate scheme and four extension sources; authorization/opaque/local-only design | Apple approval/profiles/App Group, app/extension build/signing, real selection/shields/schedules and cleanup/privacy |
| macOS developer agent | Native controlled-process and authenticated IPC/API checks, plus an unsigned arm64 desktop preview package and signed-update controller tests; historical Phase 6 host was macOS 27.0.1 arm64 | Each advertised OS/architecture, packaged Electron/Keychain, trusted signatures, installers/background registration and update/recovery |
| Windows/Linux developer controls | Cross-builds or unavailable-adapter checks where documented | Actual developer adapter, private storage/transport and OS acceptance; no native developer support advertised |
| Network / OpenWrt candidate | Read-only `openwrt-ubus-v1` protocol fixtures, separate consent, encrypted assigned-only credential flow | Exact authorized model/firmware/TLS/ACL/counters/disconnect; no router model certified |
| Backend / web | Node 24, NestJS/PostgreSQL, Next.js; database/API/browser checks and development encrypted recovery | Real digest-pinned image runtime, HTTPS/ingress, production workers, backup storage/recovery, performance targets and measured deployment behavior |
| Notifications | Scheduled in-app delivery and provider-unavailable states | Real SMTP verification/push provisioning and delivery; APNs/FCM unavailable |
| Billing | Provider-neutral sandbox, test TST units, entitlement boundaries | Approved prices/limits, live provider/reconciliation/financial retention and native payment/distribution decisions |
| Flutter | Preserved reference under `mobile/` | Retirement only after native replacement acceptance and explicit user decision |

Source tests cannot certify universal OEM behavior, continuous monitoring, full hotspot/client visibility, applied consumer-Android parental controls, billing-grade accuracy, employee legal compliance or device security. Release notes must name the actual accepted capabilities and environment combinations. See [acceptance workflow](README.md).
