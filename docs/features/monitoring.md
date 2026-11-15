# Measurement and notification infrastructure

Phase 3 implements the backend pipeline and verifies it with synthetic fixtures. No real monitoring collector is enabled. Native collection, persistent mobile buffers, dashboard screens, router integrations, push-provider credentials and physical-device acceptance belong to their later phases.

## Uploads and consent

`POST /api/v1/devices/:deviceId/measurements` accepts a version 1 measurement batch under the opaque device credential. The batch contains a UUID, configuration generation, at most 100 observations and 100 declared gaps. A batch must contain at least one item. The published shape is `contracts/schemas/measurement-batch.v1.schema.json`.

Ingestion rechecks account verification, workspace membership, registration permission, device state, credential and generation while holding workspace/device locks. It requires current `monitoring-v3` consent, the appropriate scope, granted permission and a fresh supported OS measurement capability. The final Phase 3 migration pauses previously enabled monitoring and advances generations; explicit consent is required again. Existing grants are never silently expanded to cover the new retention disclosure.

Supported mobile metrics are `mobile_data_bytes`, `wifi_data_bytes`, `screen_time_seconds` and `application_foreground_seconds`. Their capability IDs are `network.mobile_data`, `network.wifi_data`, `usage.screen_time` and `usage.application_foreground`. Application foreground events require an application ID; other metrics reject one. Android/iOS source labels must match the enrolled platform. Router/Go-agent measurements require their future authentication paths and are rejected here. Device assertions are authenticated reports, not independent proof that an OS collector ran.

Intervals use UTC timestamps with exactly three fractional digits, must end in the past, last at most 26 hours, and fall inside the current consent/enrolment epoch and raw retention window. Bytes are nonnegative safe integers; seconds have at most six decimal places and cannot exceed interval duration. Collection time is stored separately from receipt time. A capability check expires after 24 hours.

A batch is atomic: raw observations, exact daily aggregates, gap declarations and synchronization receipts either commit together or roll back. Identical batch/event IDs are deduplicated; changed content under an existing ID returns 409. Overlaps within the same metric/application/quality are rejected across collector versions, including after raw expiry. Minimal hashed partition/interval indexes survive with synchronization receipts for aggregate retention plus one day. Upgrade backfills indexes from remaining raw rows; unresolved legacy receipts fail closed for new observations until erased or expired. They cannot silently recount historical data.

Configuration publishes a synchronization budget of eight attempts, initial backoff of one second, maximum backoff of five minutes, and the batch size limits. Future native queues must retain UUIDs and payloads across retries, use bounded exponential backoff with jitter for transport failures/429/5xx, and honor bounded server retry guidance. Validation/authentication errors terminate the attempt; 409 requires configuration reconciliation rather than blindly replaying an old generation. Pause, revocation, network reassignment and erasure invalidate old generations. Persistent local buffering and local deletion enforcement remain native/agent implementation work.

## Reports and exports

Authenticated workspace routes live under `/api/v1/workspaces/:workspaceId/monitoring`:

| Route | Behavior |
| --- | --- |
| `GET usage` | Daily, Monday-based weekly or monthly buckets, comparison totals, source rows and declared gaps |
| `GET export` | A JSON envelope containing an escaped CSV download; no retained server file |
| `GET/PATCH retention` | Read policy; only the workspace owner can change it |
| `GET/POST networks` | Read/create manual workspace network labels |
| `POST network-assignment` | Assign the user's own device to a label, pause monitoring and require consent again |

Reports require `from`, exclusive `to` and `metric`; optional parameters are `period`, `deviceId`, `networkId` and `applicationId`. Valid local-date ranges span at most 366 days. Reports use the workspace's validated IANA timezone, including 23/25-hour DST days. Comparisons use the same number of preceding local calendar days and expose their exact dates. Weekly/monthly buckets may be partial at the selected range edges.

Values are fixed six-decimal strings to preserve exact totals. Integer micro-units are divided across local days proportionally; the final piece receives any rounding remainder. Source rows and buckets identify proportional allocation. Measured and estimated values remain separate. An observed zero is `0.000000`; an unobserved value is null. Coverage and missing time describe the selected devices' full report windows. Declared gaps are historical reports that may later be backfilled, not an assertion that their entire interval remains empty. Manual labels do not establish physical network presence or discovery.

Members/viewers can report on their own registered devices. Owners/admins/guardians with report permission can read shared reports; shared CSV export additionally requires export permission. Reports are bounded to 20 devices, 10,000 aggregate rows and 2,000 source/gap rows; larger requests fail with a request to narrow the query. CSV guards spreadsheet formulas. Personal password-confirmed export includes only the subject's measurement rows, aggregates, gap declarations and notification preferences; synchronization hashes/credentials are excluded.

## Retention and erasure

| Store | Default | Configurable maximum |
| --- | --- | --- |
| Raw observations | 30 days | 90 days |
| Daily aggregates and gap declarations | 365 days | 730 days |
| Synchronization receipts and interval indexes | Aggregate policy + 1 day | 731 days |
| Alerts and cascaded delivery attempts | 90 days | 90 days |
| Operational diagnostics | 7 days | 30 days |

Settings have a current effective timestamp; null means the unchanged default policy. Aggregate retention must cover raw retention. These are infrastructure bounds; edition-specific entitlements arrive with billing. Raw expiry uses interval end; aggregate expiry uses complete local dates. Each worker pass deletes at most 1,000 rows per store per workspace and commits atomically. Repeated passes continue cleanup. Aggregates survive raw expiry and are never reconstructed from incomplete raw history.

Device data deletion/removal erases raw data, derived totals, gaps, receipts, device diagnostics and network association. It removes device rules and any alert whose snapshot included the device, with cascaded deliveries, and resets affected shared rule state. Account deletion invokes the same derivative cleanup before existing foreign-key cascades. Minimal lifecycle tombstones remain under the existing privacy policy. Backup expiry and agent-side deletion still require deployment/client implementation; this does not promise immediate erasure of backups or downloaded CSVs.

## Rules and delivery

`GET/POST rules`, `PATCH/DELETE rules/:ruleId`, `GET alerts`, `GET notifications` and `POST alerts/:alertId/acknowledge` operate on the signed-in user's rules/alerts within the workspace. At most 100 rules are allowed per workspace. Rules support measured usage thresholds, device-offline duration, permission loss, severity, day/week/month windows, device/network scope, channels, enabled state and IANA quiet hours. Health rules target one device; offline thresholds are 60–604800 seconds. Quiet-hour start/end must differ and overnight/DST periods are supported.

Own-device rules require workspace access. Shared device/network/workspace rules require both report and alert permissions. Evaluation, delivery, reads and acknowledgement recheck current scope. Membership removal or downgrade below alert-management permission deletes the member's rules and queued/delivered occurrences. User preferences are available through `GET/PATCH /api/v1/notifications/preferences`.

Thresholds use measured values only. False-to-true transitions and new period windows create one occurrence; repeated evaluations and acknowledgement do not rearm an active condition. False conditions resolve the occurrence. Editing a rule removes its previous occurrences/deliveries and evaluates the new definition afresh. Alert reads return up to the latest 100 scoped occurrences.

In-app notifications become visible after a durable delivered state. Quiet hours postpone delivery without consuming attempts; preferences are rechecked immediately before delivery. Transient failures retry with exponential backoff, capped at five attempts and a one-hour delay. Delivery attempt history stores stable outcome codes, never arbitrary provider exceptions. Adapters receive a stable idempotency key. Any future external adapter must enforce provider idempotency and bounded calls because a transaction retry can repeat delivery.

Android and iOS adapter implementations explicitly return unavailable while unconfigured. No push token registration, FCM/APNs call or success claim exists. In-app defaults to enabled and push to disabled. Operational diagnostics expose safe recent job outcomes and delivery counts only to audit-authorized workspace members.

## Running maintenance

After reviewed explicit migrations, use the existing backend environment and one workspace UUID:

```sh
npm --prefix backend run monitoring:work -- WORKSPACE_UUID
```

This performs one bounded evaluation/delivery/retention pass. It prints only stage outcomes, records safe failures and exits nonzero if a stage fails. It installs no daemon or scheduler. Deployment must arrange recurring passes for every workspace, monitor failures/backlogs, and repeat retention passes until caught up. Alerts are not time-triggered merely by starting the API.

The live API fixtures cover atomic ingestion, replay/conflicts, UTC midnight, DST boundaries, gaps, source attribution, reports/CSV, isolation, independent raw expiry, retention failure recovery, exact interval protection, threshold/health rules, acknowledgement, quiet hours, unavailable providers, retries/preferences, network scope, role revocation and deletion. See `docs/validation/phase-3.md` for the verification record.
