# Remote developer service commands

Phase 7 extends the Phase 6 macOS identity-bound adapter. The backend accepts typed intents, and the agent polls outbound over authenticated HTTPS every three seconds. No inbound port, arbitrary PID input, shell command or automatic force escalation is exposed. See [native control limits](local-service-controls.md) and [mobile flow](../../contracts/REMOTE_MOBILE_FLOW.md).

## Independent authorization gates

A paired computer must have the workspace Developer Tools module enabled. Its local owner independently opts into sharing and remote shutdown through desktop IPC v4 or explicit CLI preferences. Both are off initially; enabling requires acceptance of `developer-sharing-v1`. Local shutdown consent does not enable remote shutdown. Disabling sharing clears remote control; withdrawal persists a pause request until the backend acknowledges it, even across restart.

The paired computer's owner must additionally accept the server disclosure, enable sharing and name verified OWNER/ADMIN controllers in the current workspace. A role alone, technical capability, guardian relationship or installation ID grants no remote authority. Current roles, active credentials, generation, policy revision, fresh report and explicit grants are checked when creating, claiming and authorizing execution. Policy changes invalidate old observations and unstarted commands. Viewers can read consented summaries but cannot change grants or request shutdown.

## Observation and execution boundary

The agent retains separate local and remote observations so desktop refresh cannot retarget a pending remote action. Each published summary contains only service/observation identifiers, PID/start time, project label, runtime, observed time, up to eight ports, eligibility and captured descendant count. Full executable/working-directory paths, arguments, socket addresses, traffic and files are excluded. Publish at most 32 summaries, with total inventory bounded to 256; recent server observations are bounded to 256 and agent remote observations to 512.

Creation requires an observation at most ten seconds old. Expiry is the earlier of ten seconds after request or fifteen seconds after observation, within the original contract's sixty-second maximum. The backend binds the captured immutable target to a requester-scoped UUID/idempotency fingerprint. Conflicting reuse is rejected. Agent polling claims a pending command with an opaque random lease; only its hash is stored server-side. A second server call obtains fresh execution authorization before the agent uses its native adapter.

Before this call the agent durably records an unknown receipt. Response loss or restart never blindly repeats a shutdown. Native execution rechecks process incarnation, socket identity and optional captured descendants (maximum sixteen), then checks the remaining permit immediately before signaling. macOS checks wall time at the kernel-signal boundary as well as the Go context deadline. No PID-only fallback is used. A supervisor's replacement is reported and left untouched.

## Lifecycle and audit

Pending and accepted are unconfirmed. Succeeded requires an authenticated `stopped` or `already_stopped` result. Denial, changed target/tree, still-running, replacement, inspection failures and uncertain execution remain explicit outcomes. Cancel is allowed only before execution authorization starts; it cannot undo a signal. Expired unstarted work never executes after reconnection. Started work lacking a result becomes failed/unknown; a late authenticated receipt can refine that uncertainty. Audit records requested, accepted, execution-started and terminal transitions. Identical result replay is acknowledged; conflicting outcomes are rejected.

Limits are ten pending and 1,000 retained commands per agent. UI history returns the latest 25. The private agent receipt buffer is bounded to 32 entries/32 KiB and cleared on unpair/revocation; it flushes even when sharing is disabled. It is distinct from the bounded seven-day local action journal.

## Privacy and operation

Apply the tenth explicit database migration before use. Schedule `npm --prefix backend run agents:cleanup -- WORKSPACE_UUID` per workspace: each pass deletes at most 1,000 commands older than seven days with cascading audit removal, clears stale stored service reports older than sixty seconds, and performs existing code/diagnostic cleanup. API startup installs no scheduler. Reports older than fifteen seconds or heartbeat older than ninety seconds are already unavailable in reads. Account export includes owned sharing policies/requested commands without leases; erasure removes snapshots, commands and audit. Re-enrolment changes generation and removes old remote state. Account deletion also removes its controller grants.

An explicit development CLI example after pairing is `--developer=true --share-services=true --allow-remote-control=true --accept-remote-disclosure`. Server grants are still separately required. Desktop preferences never register a persistent service automatically. Use HTTPS outside isolated loopback tests. Native process execution currently supports macOS only; Windows/Linux report unavailable. Phone UI, signed Electron/Keychain acceptance, cross-network/device behavior and operational soak remain pending. Optional long-running reminders are deferred until that soak and notification design are complete.
