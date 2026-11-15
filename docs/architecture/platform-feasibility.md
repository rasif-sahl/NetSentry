# Platform feasibility and verification gates

Assessment date: 15 November 2026. This is a documentation/source assessment, not device or router certification. No Android Studio, SDK, emulator, simulator or Xcode is installed for these checks.

| Feature | Implementation direction | Gate before claiming support |
| --- | --- | --- |
| Android application usage | Native usage-access integration with explicit disclosure | User-granted usage access, compatible device/API and physical-device accuracy tests |
| Android mobile/Wi-Fi totals | Native NetworkStatsManager source assessment | Required permissions/access, supported query scope and measured-vs-missing behavior on real devices |
| Android background collection/sync | Platform-appropriate scheduled/background APIs | Battery restrictions, process death, reboot, offline and permission-revocation tests; no universal continuous-operation claim |
| Hotspot clients/per-client traffic | Capability-gated OS/vendor or supported router adapter | A verified source on the exact device/firmware; otherwise unavailable, never inferred from aggregate phone usage |
| Android policy enforcement | Supported authorized device/app/router mechanisms | Per-action feasibility and confirmed real-device enforcement; observation access does not establish enforcement permission |
| iOS usage/Family Controls | SwiftUI plus approved Screen Time framework/extension integration | Authorization, applicable entitlements, permitted data scope and actual device behavior; do not assume Android parity or arbitrary backend export of Screen Time data |
| iOS mobile desktop controls | Ordinary authenticated client for paired computer commands | Signed native build, network connectivity and successful end-to-end phone test; independent of Family Controls entitlement |
| Router discovery/traffic/control | Small explicit adapter/model/firmware support matrix | Owner-authorized hardware, authentication method and tested capabilities; no vendor family chosen without evaluation |
| Desktop processes and IPC | Platform-specific per-user agent and authenticated local transport | Correct process identity, privileges, child/supervisor behavior and actual OS transport tests |

## Android references and implications

Usage access is a separate user-controlled setting; the application must handle denied or revoked access rather than treating declaration of a permission as approval. See [UsageStatsManager](https://developer.android.com/reference/android/app/usage/UsageStatsManager) and [usage-access settings](https://developer.android.com/reference/android/provider/Settings#ACTION_USAGE_ACCESS_SETTINGS).

Network statistics expose queries with permission/access conditions; assess each intended device/app scope rather than promising all-device or tethered-client measurements. See [NetworkStatsManager](https://developer.android.com/reference/android/app/usage/NetworkStatsManager).

Background restrictions and user battery settings affect task execution. Report missing data and delayed synchronization instead of claiming continuous monitoring. See [Android background restrictions](https://developer.android.com/develop/background-work/background-tasks/bg-work-restrictions).

The Android scaffold is still compile/target API 35 with its Phase 0 pins. No SDK upgrade/build occurs here. Review current distribution requirements and dependency versions when preparing native builds; a scaffold target is not store-release approval.

## Apple references and implications

Family Controls distribution requires approval, including relevant Screen Time extension targets. Do not add entitlement files to imply approval that has not been granted. See [requesting the Family Controls entitlement](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement) and [configuring Family Controls](https://developer.apple.com/documentation/xcode/configuring-family-controls).

Validate what each authorized framework can report and where that data may be used before designing cross-device/server reports. Keep unverified iOS fields unavailable. Native compilation, signing, entitlements, push delivery and restriction behavior remain pending physical-device acceptance.

## Router acceptance record

For each candidate record manufacturer/model, firmware, adapter version, authentication method, available readings/actions, measurement source, tested date, limitations and revocation/disconnect behavior. Network discovery alone is not proof of bandwidth attribution or filtering support. Do not scan a user network or collect router credentials during this architecture phase.
