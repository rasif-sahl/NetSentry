# Native iOS application

Independent Swift/SwiftUI source and a shared Xcode application project/scheme (`NetSentry`). The Flutter-owned `mobile/ios/` remains untouched.

Initial bundle identifier: `com.netsentry.app`. Deployment target: iOS 17; Swift language mode 5. These are scaffold decisions; supported physical devices still require validation. No signing team, Family Controls entitlement, push registration or distribution certificate is configured.

The starter screen requests no permissions and collects no data. Family Controls/Device Activity/Managed Settings will be introduced only after their authorization and entitlement requirements are addressed.

No Xcode, mobile SDK or simulator was installed. The existing machine has Apple Command Line Tools rather than full Xcode. Project/plist structure can be checked locally; an actual iOS build, signing and physical-device behavior are pending.

When explicitly preparing device testing later, open `NetSentry.xcodeproj` in an existing compatible Xcode installation, select the `NetSentry` scheme, assign a development signing team and use a connected physical device. Do not install tooling or start a simulator during Phase 0.
