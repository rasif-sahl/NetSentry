# Android physical-device handoff

Current status: Kotlin/Compose source and SDK-free repository/HTTPS integration exist; Android type checking, APKs, signing and phone acceptance are pending. Do not install mobile tools in this workspace. Use an already prepared external build host or supply its signed APK and build log. `mobile/` is the Flutter reference.

## Build candidate

The checked-in baseline is JDK 17, Gradle 8.11.1, AGP 8.9.2, Kotlin/Compose 2.1.20, compile/target API 35 and minimum API 26. Review actual dependency resolution and current distribution requirements on the build host; these pins are not store approval. No wrapper distribution/binary is provisioned. Select existing paths through `JAVA_HOME`, `ANDROID_HOME` and `NETSENTRY_GRADLE_EXECUTABLE`; the prerequisite inspector reads paths only.

On an independently prepared host with all required SDK/dependencies already cached, these are manual build commands, **not run or installed by this phase**:

```sh
cd android
# Existing Gradle only; offline prevents dependency resolution over the network.
"$NETSENTRY_GRADLE_EXECUTABLE" --offline --no-daemon :app:lintDebug :app:assembleDebug
# Inspect the produced artifact with the build host's existing SDK tools.
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose --print-certs app/build/outputs/apk/debug/app-debug.apk
```

If cached prerequisites are missing, stop and use the build-host owner rather than triggering tool installation. Record Gradle/JDK/SDK versions, source commit, lint/build logs, APK SHA-256, application ID/version and signer certificate digest. Debug application ID is `com.netsentry.app.native.dev`, allowing Flutter co-installation. Release `com.netsentry.app` and release signing remain separate launch gates. A debug signer is not a production release signer.

On the test host only, after the tester authorizes USB debugging for their phone, use its existing `adb -s DEVICE_SERIAL install -r /private/build/app-debug.apk` or a reviewed signed-APK installation method. Keep serials/private account information out of shared logs. Do not install over the Flutter application ID or retire Flutter. Confirm the application ID before opening the candidate.

Use [Android's command-line build guide](https://developer.android.com/build/building-cmdline) for the distinction between assembling an APK and installing it on a physical device. This handoff does not install an IDE, SDK or emulator.

## Tests and acceptance

Use the `android` evidence profile. Test models/OS builds individually; a result on one phone does not certify every OEM. Record timezone, interval and observed units for measurements. Pair only to a dedicated reachable HTTPS test workspace with a real verification-mail setup. Backend migrations/workers and exact source/image manifest must be recorded.

| Gate | Steps | Expected observation |
| --- | --- | --- |
| `android.account` | Register/verify/sign in; enrol with collection off; switch workspace/account; restart app; sign out offline; exercise unavailable Keystore/local reset | Scope is isolated, collection remains off until explicit consent, offline sign-out clears local access and never claims server revocation |
| `android.permissions` | Deny usage access; grant it explicitly; separately opt into network and detailed-app collection; revoke while visible and in background | Missing/denied remains unknown; declared permissions do not grant access; collection stops and stale data is not presented as fresh |
| `android.lifecycle` | Background/lock app; restrict battery; kill app process; force-stop separately; reboot; reconnect and inspect times | Best-effort work/gaps are honest; no promise of continuous execution or automatic recovery after force-stop; stale authorization never resumes collection |
| `android.measurements` | Record OS reference totals; perform a bounded mobile/Wi-Fi transfer and timed app/screen sequence, including split-screen/screen-off; compare same windows | Source/quality/coverage and units are explicit; app/screen unions are not double-counted; estimates remain distinct; do not certify billing-grade accuracy |
| `android.offline` | Disconnect for a short interval, then reconnect; repeat acknowledgement loss; exceed cached-consent horizon using a dedicated long-duration test; revoke server generation while phone is offline | Immutable batches deduplicate, retries are bounded, old generations are discarded; commands are never queued as measurements |
| `android.privacy` | Pause, withdraw consent, sign out, export to an explicit destination, erase device data and unenrol; repeat with network loss | Local stop is immediate where possible; server failures are visible, saved export copies are separately controlled; successful erasure actually removes scoped server rows |
| `android.family-business` | Device owner explicitly accepts/withdraws Family/employee sharing; change assignment/role/generation; inspect supported/unsupported policy state | Sharing never starts collection or grants device-owner authority; consumer Android must not report applied restrictions it cannot perform |
| `android.notifications` | Run scheduled rule evaluation, inspect alert/preference/acknowledgement and quiet-hour behavior | In-app delivery works where configured; FCM registration/provider remains unavailable, not a successful push |
| `android.remote` | Follow the cross-network controlled-process checklist | Only confirmed exact targets stop; expired/offline/revoked actions never replay |
| `android.distribution` | Review separate release signing, install/upgrade/data retention, disclosures/store requirements and final APK/AAB | Evidence identifies the actual distribution channel and signer; no live purchase or store approval is inferred |

For long offline/background tests, keep observed timestamps rather than changing production clocks. Explicitly test date/timezone boundaries and time changes separately in a dedicated environment. Android hotspot state/client count/per-client traffic remains unavailable on the current baseline. No hidden API or phone-total inference is an acceptable result. UI tests must include font scaling, TalkBack, narrow/landscape layouts, loading/error/empty states and sensitive export handling.

If any step fails, retain a redacted defect record and keep the gate failed/blocked. Send the exact gate ID, OS/model, source/APK digest and reproduction so development can fix and rerun the affected checks.
