## Backend source layout

Organize HTTP features by domain under `src/`. Use `*.module.ts` for NestJS wiring, `*.controller.ts` for HTTP routes, `*.service.ts` for use cases, and `dto/` for request validation classes. Keep TypeORM entities and domain helpers with their feature, migrations under `src/database/migrations/`, and integration checks under `scripts/`.

# Device enrolment and lifecycle

Verified users with workspace registration permission issue one-time, account/workspace/installation/platform-bound enrolment codes. Codes expire after ten minutes and cannot be reused. Redemption acknowledges the versioned pairing disclosure and returns a new opaque device credential once; only its hash is stored. An installation already owned elsewhere cannot be taken over. This is installation pairing, not hardware attestation; native device-side acceptance is still pending.

Direct POST /workspaces/devices registration is deprecated and returns 403. Existing records migrate to UNVERIFIED with no device credential and monitoring disabled. Explicit enrolment is required before receiving authenticated health reports. Re-enrolment by the same owner/workspace rotates credentials, increments the generation and starts with monitoring disabled. It never silently preserves old consent or revives an old token.

Device bearer credentials are distinct from user JWT sessions. Configuration/heartbeat endpoints validate current device state, credential hash, active verified owner and current workspace registration permission. Heartbeats recheck credentials under the same workspace/device locks as revocation. User tokens cannot authenticate a device, and device credentials cannot access user APIs. Membership removal or a downgrade that loses registration permission revokes associated device credentials and unused enrolment codes.

Owners and authorized managers may rename/pause/unenrol/remove devices. Only the device owner grants monitoring consent or erases personal data. Administrators cannot grant consent for someone else. Owner data-erasure rights remain available after workspace departure. Removed devices disappear from inventory; their minimal identity/generation tombstone prevents stale code/credential reuse. Account deletion removes the owned record entirely.

Consent records include actor, server time, selected scopes, disclosure version/hash and generation. MonitoringEnabled is the user's collection setting, not proof that a collector is supported or running. Phase 2 enables no monitoring collectors. Later ingestion must additionally validate consent scope, permission/capability, owner membership, credential and current generation. Pause/revocation/deletion advance that generation so old offline batches cannot be replayed. Permission-denied/revoked health reports turn monitoring off.

Health metadata contains reported OS/model/app version, permission/battery status, synchronization time and a schema-validated capability report. Reports cannot claim executable actions while a capability is unavailable, use another device/workspace identity, duplicate identifiers, or use invalid/future check times. These are authenticated client reports, not independently measured device certification. No actual native detection or monitoring is claimed before physical-device checks.

Permission/consent history is scoped to the device owner or authorized managers. Data erasure clears stored capability/health/version fields and old history, disables collection, revokes the installation credential and retains only the new deletion tombstone event. Fresh enrolment is required before health metadata can be reported again. Phase 3 connects measurement, aggregate, synchronization, gap and alert stores to this erasure lifecycle; see `monitoring.md`. Current collection metadata is deleted transactionally; future offline agents must apply revocation and deletion when their synchronization protocols are implemented.

Builds copy the shared capability schema into the backend artifact. Source/watch development can read the repository contract when the bundled copy is absent. Test metadata is synthetic; no SDK, emulator, native collector or live network scan is installed or run.

Phase 3 ingestion requires the current `monitoring-v3` disclosure, source-specific scopes/capabilities and the current generation. Configuration includes bounded synchronization guidance. Manual network reassignment pauses monitoring and requires consent again. The measurement feature remains device-reported infrastructure until native collectors are implemented and validated.

## Measurement and notification maintenance

See `../docs/features/monitoring.md` for ingestion, reporting, privacy and alert APIs. Apply explicit migrations before use; the latest Phase 3 disclosure requires renewed consent. No native collector is enabled.

`npm run monitoring:work -- WORKSPACE_UUID` runs one bounded alert evaluation, delivery and retention pass using the backend environment. Arrange recurring passes per workspace in deployment; starting the API alone does not schedule jobs. In-app delivery is implemented; Android/iOS push adapters explicitly report unavailable. Live API tests use synthetic data and injected adapters only.

## Shared Go agent foundation

Phase 5 adds installation/workspace-bound software-agent enrolment, separate opaque credentials, module/background authorization, heartbeat/configuration, bounded diagnostic synchronization and revocation/export/erasure. Apply the new migration explicitly. Phase 7 adds consented summaries and expiring developer commands; traffic collectors remain unavailable. See [agent setup](../agent/README.md) and [verification](../docs/validation/phase-5.md).

`npm run agents:cleanup -- WORKSPACE_UUID` runs one bounded diagnostic/code retention pass; arrange recurring passes in deployment. `TEST_AGENT_BINARY=/absolute/path/to/netsentry-agent npm run test:api` includes actual Go-process pairing, outage/restart recovery, module isolation and revocation against the disposable test database.

## Phase 7 remote commands

Apply the tenth migration explicitly. Paired-computer policy and command endpoints use current workspace roles plus named computer-owner grants; agent claim/start/result endpoints use separate opaque credentials. Schedule `agents:cleanup` per workspace for seven-day command/audit retention and stale snapshot cleanup; no scheduler starts with the API. On supported macOS, `TEST_AGENT_BINARY` enables actual remote shutdown of controlled sample listeners in `test:api`. See [remote architecture](../docs/architecture/remote-service-commands.md).

Phase 10 requires the twelfth explicit migration. Router setup additionally needs a distinct base64 32-byte `ROUTER_CREDENTIAL_ENCRYPTION_KEY`; no plaintext fallback exists. The server never dials router private addresses. Schedule `npm run networks:work -- <workspace-uuid>` at least once per minute for source-health events and bounded thirty-day samples/presence/events cleanup. Repeat batches after downtime. No scheduler or router hardware certification is installed. See [network architecture](../docs/architecture/network-monitoring.md).

Phase 11 family routes require a Family workspace and explicit current profile grants. Only the active device owner can consent to sharing; profile/device revisions require renewed consent. Apply migration thirteen and schedule `npm run family:work -- <workspace-uuid>` for bounded request/event retention. Policies are unsupported intent until a separately authorized supported enforcement adapter exists; `applied` receipts are rejected. Guardian legacy report/alert scope cannot bypass child grants. See [family architecture](../docs/architecture/family-wellbeing.md).

## Business organizations (Phase 13)

Business workspaces expose `/workspaces/:workspaceId/business` for structure, employee/device consent, reporting-check policies, location/department reports, network alert assignment, audit and remote unenrolment. Observed network endpoint departments are revision-checked metadata, not ownership or traffic attribution. Apply migrations fourteen/fifteen explicitly. Schedule `npm run business:work -- <workspaceUUID>` alongside existing domain workers for bounded 90-day Business audit retention; network/developer projection windows stay 30/7 days. No scheduler or provider is provisioned by the source.

Company custody requires the registering organization owner's separate disclosure. Employee offboarding revokes in-organization credentials and sharing while preserving personal data and unrelated organizations. Employee account deletion preserves another custodian's company device; owner transfer revokes company credentials before moving explicit custody. See [architecture](../docs/architecture/business-organizations.md) and [validation](../docs/validation/phase-13.md).

Phase 14 adds provider-neutral sandbox billing, opt-in edition enforcement, separate expiring operator grants and migration-aware readiness. Apply migration sixteen explicitly. See [subscriptions and operations](../docs/architecture/subscriptions-and-operations.md) and [operational runbook](../infra/phase-14-runbook.md). Live billing remains disabled.

Phase 16 adds migration seventeen, default-off email opt-in and a rule channel whose adapter always reports `EMAIL_DELIVERY_DISABLED`. SMTP/account-mail configuration cannot enable alert sending. See [themes and email boundaries](../docs/architecture/themes-and-alert-email.md).
