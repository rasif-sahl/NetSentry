# Android personal client

Phase 8 keeps Kotlin/Compose, OS adapters and secure storage together in root android/. Flutter remains the reference; iOS remains separate SwiftUI source for its own phase. [Android setup and limits](../../android/README.md) describe operation.

## Trust boundaries

The account HTTPS client uses the current user JWT and serializes refresh-token rotation. A failed/lost refresh acknowledgement clears the session rather than automatically replaying a rotated credential. Device configuration, heartbeat and measurement uploads use a separate opaque credential. It cannot call account or developer command routes. Every server authorization still applies; user roles and capabilities never replace consent or named computer grants.

The repository uses one synchronized process-scoped instance for worker and foreground actions. It persists complete account/device/queue transactions through an encrypted atomic file. No secrets enter Compose view state, URLs, logs, exports or backup directories. A lost Keystore key requires explicit local clearing/sign-in; it is not silently treated as successful decrypt/reset. Account/workspace changes clear protected screen data. Server validation/authentication/generation errors stop pending collection rather than retrying indefinitely.

## Collection and retry

AndroidUsageSource owns AppOps usage access, NetworkStatsManager and safe build/battery metadata. Absence, denial and transient failure remain distinct missing-data reasons. Network aggregates are estimated because OS bucket attribution is coarse; Phase 9 adds separately consented app/screen event adapters; see [advanced monitoring](android-application-monitoring.md). Hotspot/client data is unavailable on this API 35 baseline. There is no hidden/privileged tether API or traffic attribution to another device.

Consent starts the cursor after server acknowledgement and schedules best-effort periodic work. Intervals lag two minutes and last at most 24 hours. A bounded encrypted queue holds immutable payload IDs; cursor advancement and append are committed together before upload. A lost acknowledgement retries the same payload. Only measurement data is queued. Offline capture is limited by a 24-hour cached authorization horizon; reconciliation checks the current generation before upload. Old generation/expired data is discarded, never retagged. Permission loss, local stop, sign-out or erasure clears queued work. Collection is not promised to run continuously through battery restrictions, force-stop or reboot.

## Reports, allowances and commands

Report dates use the workspace IANA timezone, an exclusive end date, Monday-based weeks and month-to-date windows. Missing coverage is visible. Allowance rules explicitly choose measured or estimated quality; measured remains the backend default. Each threshold uses one quality only, preventing double counting when both sources cover a period. Alert snapshots retain their quality and web/native clients display it. Evaluation/delivery still depends on scheduled monitoring maintenance; push is unavailable.

Remote intents freeze the captured service/observation, mode, optional descendants and request UUID. Confirmation distinguishes graceful from force, limits freshness to ten seconds and re-reads server grants immediately before creation. Polling displays audit and explicit outcomes; pending/accepted never mean stopped. Offline commands are not persisted or automatically replayed. The same UUID is retained for explicit lost-response retries. Native phone-to-agent acceptance remains pending; standalone Kotlin-to-API tests use synthetic desktop observations.

## Primary platform references

- [NetworkStatsManager](https://developer.android.com/reference/android/app/usage/NetworkStatsManager): permission-dependent device summaries, worker-thread queries and null subscriber scope.
- [Usage access](https://developer.android.com/reference/android/provider/Settings#ACTION_USAGE_ACCESS_SETTINGS): a separate user-controlled Settings grant.
- [Android Keystore](https://developer.android.com/privacy-and-security/keystore): AES/GCM key protection, subject to actual device validation.
- [Periodic work](https://developer.android.com/reference/androidx/work/PeriodicWorkRequest): minimum interval and OS/battery delays.
- [TetheringManager](https://developer.android.com/reference/android/net/TetheringManager): the public callback is API 36; this API 35 client does not claim it.

Native compilation, API-level resolution, KeyStore behavior, UI/a11y/layout, signing, OEM network-accounting differences and physical-device/background/network behavior remain acceptance gates, not JVM test results.

Phase 9 extends this source with the detailed application addendum, bounded reducer/queue and OkHttp one-shot mutation transport. The Phase 8 verification record remains historical; current limits and native acceptance gates are in the Phase 9 record.
