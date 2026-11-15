# Data and privacy foundations

Phase 1 establishes contracts and boundaries. Monitoring ingestion, consent records, retention jobs, exports and full deletion workflows are implemented in subsequent phases before the corresponding collection features are enabled. No monitoring collector is enabled now.

## Identity and provenance

Use separate identities for account, workspace, enrolled installation, agent, network, observed endpoint, application, service and command. A discovered IP/MAC/hostname is an observation, not verified ownership. An installation ID is not a credential. A capability report is technical evidence, not permission to collect or execute.

New event contracts require UTC timestamps ending in Z; preserve interval start/end, collection time and later ingestion time independently. Reporting uses an explicit IANA workspace timezone and handles daylight-saving boundaries. The backend process/database connection use UTC; legacy timestamp-without-timezone columns remain unchanged in the baseline migration. Before adopting a populated historical database, confirm how its old timestamps were stored; changing the session timezone cannot repair unknown historical offsets.

Use event IDs plus authenticated source identity for idempotency, reject cross-workspace/device attribution, and preserve missing intervals. Bytes and seconds are distinct units. Estimated values must be labelled and cannot silently fill a missing measured interval. Deduplicate observations from multiple agents without asserting that randomized identifiers represent the same person/device.

## Consent and collection lifecycle

Before monitoring enrolment, record actor, subject/profile/device, workspace, consent purpose/scope, disclosure version, grant/revoke time and relevant platform permission state. Treat OS permission, human consent, workspace role and technical capability separately. Recheck all required conditions at collection/ingestion boundaries. Device-owner status or a guardian role is not permission to bypass platform security.

Paused monitoring stops new collection and ingestion for the paused scope. Revocation invalidates credentials/queued commands and stops collection; old offline batches cannot bypass the new state. Bind batches to an enrolment generation so a deleted/re-enrolled installation cannot replay an old buffer. Distinguish user-requested pause/revocation from temporary OS restrictions in health/status reporting.

## Retention and deletion

Define explicit per-workspace raw, aggregate and audit retention policies before enabling collectors; do not retain raw monitoring events indefinitely by default. Retention settings are bounded by edition entitlements, and changes have a recorded effective date. Retention workers operate in bounded, retryable batches and expire raw data separately from longer-lived aggregates. Exact defaults and storage capacity targets must be chosen before production collection, not invented by a collector.

Deletion records the request, revokes relevant access/ingestion generations, cancels queued commands and removes applicable raw events, derived aggregates, reports/exports and credential references. Propagate deletion to agents and prevent offline data from resurrecting removed records. Handle backup expiry according to the documented backup retention schedule; do not promise immediate erasure from every historical backup. Keep only policy-justified minimal audit/tombstone data, pseudonymizing subject references where required by the selected deletion policy. Exports remain authorized, scoped, short-lived and auditable.

## Credentials and diagnostics

Use TLS for app/backend/agent communication and verified PostgreSQL TLS in production. User passwords remain scrypt hashes; refresh tokens remain hashed in the database. Keep access/refresh secrets independent. Router credentials require encryption with a key outside the database and controlled rotation; native/agent credentials use operating-system secure storage. Select managed key/secret storage with deployment, before router credential collection.

Never log passwords, bearer/refresh/pairing tokens, raw router credentials, private application contents, query-string secrets, unredacted process arguments or unnecessary full local paths. Error responses now have server-owned request IDs and hide internal exception text. Structured operational logs should carry event name, component, request ID, scoped identifiers, outcome, latency and stable error code; collection/reporting jobs must avoid dumping full payloads.

## Audit design

Record event ID, workspace, actor type/ID, target type/ID, action, outcome/reason code, request/command correlation and occurred/received timestamps. Use append-oriented records with explicit authorization and retention; audit storage is not a secret or message-content archive. Cover enrolment/revocation, permissions, consent/policies, exports/deletion, billing changes and service-control outcomes. A command accepted for delivery and a command confirmed successful are distinct events.

Workspace isolation applies to API queries, ingestion, reports/exports, audit access, agents and commands. Phase 1 enforces existing workspace device-access gates and tests isolation. Full organization/guardian/device-specific grants and audit persistence arrive with their domains; no implemented full audit pipeline is claimed here.
