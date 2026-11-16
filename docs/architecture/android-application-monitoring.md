# Advanced Android application monitoring

Phase 9 extends the native personal client with event-derived app/screen history, metadata/classification, reports and health alerts. It uses public UsageStatsManager APIs behind the existing user-controlled usage-access grant. Source and JVM/API checks do not establish Android build compatibility or phone accuracy.

## Consent and collection boundaries

Network consent never enables app history. Android additionally requires the user to read and accept app-usage-v1 and request app_usage alongside monitoring-v3. Consent records retain the addendum version. Existing duration-only app grants remain compatible but cannot authorize the new detailed-history endpoint. Current generation, verified owner, registration permission, active device credential, consent and supported OS capability remain server gates. Capability reports are authenticated assertions, not hardware attestation or authorization.

The adapter reads timestamp, public event type, package and an activity instance identifier. Before API 29 it uses local class identity conservatively and marks reliable counts unavailable. Activity identity stays in private encrypted checkpoint state and never enters uploads. No activity content, notifications, messages, accessibility-service data, installed-app enumeration or QUERY_ALL_PACKAGES permission is used. Locked users, denied access, failed/truncated streams and unavailable APIs produce missing/unknown data.

## Event calculations and launch definition

The reducer tracks active activities and unions them per package; activity handoffs within a package do not become new launches. An observed foreground entry occurs when a package has no active captured activity and resumes, with a one-second handoff debounce. This includes warm foreground entries and is **not** a verified cold-process-launch count. Duplicate events are idempotent. Counts are null when context/identity is incomplete; observed entry counts remain separately visible. Even complete captured context is not a claim that Android retained every event or that an entire calendar day was observed.

App foreground can overlap across packages in multi-window mode. Screen time is a separate union of explicitly interactive, unlocked screen intervals. API 26/27 lack the screen events used here and report that scope unavailable. Screen-off/lock ends foreground eligibility and establishes a conservative future boundary. Shutdown/startup clears active state; unmatched pauses and noncontiguous checkpoints invalidate context. Unknown initial screen state is not a zero-length measured screen session.

Open sessions are clipped at observation boundaries and resumed from a contiguous persisted checkpoint. Each window spans at most six hours; new detailed collection looks back no further than 24 hours. Older/unavailable windows remain missing, not invented. There are at most 5,000 scanned events, 32 packages, 128 foreground and screen segments, and 256 observed entries per window. Exceeding limits fails the window closed with a reason instead of silently claiming complete truncated history. Native reboot, event-retention and OEM behavior still require device acceptance.

## Durable upload and server storage

Network and detailed batches share the encrypted atomic queue/cursor/checkpoint transaction. Queue limits are 48 batches and one megabyte of queued JSON, with seven-day expiry and eight attempts. A pass drains at most four batches so two-source capture does not steadily outrun delivery. Byte/capacity exhaustion stops appending without overwriting pending work or advancing its cursor. Immutable UUIDs/payloads survive response loss; changed generations discard data/context together. No new scope is inferred from an older server grant.

The shared OkHttp 4.12 transport verifies TLS, rejects redirects and disables connection recovery. Mutating request bodies are one-shot, including HTTP 503 follow-up behavior, so retry decisions stay with session/measurement/command policy. A lost refresh acknowledgement clears credentials; it is not replayed automatically. Standalone JVM integration verifies PATCH and one-shot POST behavior. No cookies, disk HTTP cache or payload logging is configured.

POST devices/:id/application-usage validates the strict app-usage-batch.v1 envelope and derives stable measurement IDs. Detailed history, generic usage/threshold aggregates, catalog metadata, daily summaries and replay receipt commit atomically under the existing workspace/device locks. A changed rich payload under the same ID, overlapping windows/segments, duplicate entry records, missing metadata, out-of-window values or absent addendum is rejected. Metadata is accepted only for packages observed in that window. Rich replay after raw retention acknowledges its receipt without recreating expired timelines.

Daily app measurements are split at workspace-local midnight using actual captured segment overlap, rather than proportional allocation of an entire observation window. Threshold progress and detailed totals therefore agree across that boundary. Daily rows also retain observed first/last use, entry counts/context and late-night overlap (22:00–06:00), using actual timezone/DST day lengths. App sums are not screen time. These are still estimated, device-reported event calculations.

## Metadata and classifications

Only packages already observed in captured intervals can be queried for permitted labels/platform categories. Visibility-filtered or missing metadata remains unknown. Icons are loaded locally for this phone's visible packages only; no icon data or store lookup is uploaded. Catalogs hold at most 256 applications and twenty custom categories per installation; uncatalogued packages remain unknown in reports.

The OS declaration maps to fixed categories with heuristic confidence 0.6, unknown to 0.0 and an explicit owner correction to 1.0. These scores express a deterministic rule, not statistical accuracy. Custom categories and corrections require current workspace access and installation ownership; report permission alone does not grant editing rights. Deleting a custom category removes its assignments. Resetting a correction restores the OS/unknown fallback. Corrections apply at report time; historical usage is not rewritten.

## Reports, exports and insights

Application reports require one authorized device and a bounded date range, exclusive end date and day/week/month period. They expose per-app and category totals, first/last observed use, known/unknown counts, current/prior totals, trends, coverage, policy progress and descriptive evidence. Raw timeline detail is available only for ranges up to seven days and 500 windows; aggregates can survive raw expiry. Daily history from a former workspace timezone is excluded rather than reinterpreted, and that limitation is disclosed. Missing/partial comparisons do not produce a percentage trend claim.

Insights select the largest positive observed foreground and late-night values with deterministic package-ID tie-breaking and explicit evidence. There is no diagnosis, inferred missing usage or enforcement claim. Existing screen/app threshold rules show progress from the same server policy aggregates, with measured and estimated qualities kept separate. Category enforcement/policies are not invented when no such policy exists.

CSV exports preserve the selected device/date/app/category filters and escape spreadsheet formula prefixes. Password-confirmed personal export includes the subject's catalog, detailed windows and daily rows, with existing tenant/credential safeguards. Report viewers follow the established own-device versus shared-report permission rules.

## Health, retention and remaining gates

Permission loss stops collection and clears queued usage/context. An offline revocation health receipt persists across restart and is retried without resuming collection; renewed explicit consent clears obsolete health work. Permission-loss alerts remain separate from offline heartbeats. A new not_reporting rule uses the most recent accepted measurement-batch receipt and current consent epoch, not heartbeat lastSeenAt/metadata lastSyncedAt. Intentional monitoring pause suppresses that condition. Evaluation/in-app delivery still requires scheduled monitoring maintenance; push is unavailable.

The eleventh migration adds application_catalogs, application_windows and application_days. Scheduled monitoring:work removes raw windows on raw retention (default thirty days) and daily rows on aggregate retention (default 365 days), bounded to 1,000 rows/store/pass. The current bounded catalog remains until device/account erasure. Device erasure and account deletion clear all new derivative state; foreign keys cascade. Backups and saved exports have separate retention.

See [verification/device checklist](../validation/phase-9.md), [Android setup](../../android/README.md), [monitoring semantics](../features/monitoring.md), and the official [UsageEvents](https://developer.android.com/reference/android/app/usage/UsageEvents.Event), [UsageStatsManager](https://developer.android.com/reference/android/app/usage/UsageStatsManager) and [ApplicationInfo](https://developer.android.com/reference/android/content/pm/ApplicationInfo) references. Android/Compose compilation, native Keystore/UI behavior, event/launch accuracy, split screen, reboot, battery restrictions and permission transitions remain physical-device acceptance gates. No mobile tooling is installed by these changes.
