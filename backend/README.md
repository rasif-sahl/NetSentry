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
