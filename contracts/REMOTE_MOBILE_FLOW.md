# Native mobile remote-service contract

Phase 7 defines this shared HTTP/JSON flow for Kotlin/Compose and Swift/SwiftUI. OpenAPI `api.v1.json` version 1.7.0 is authoritative; the URI remains `/api/v1`. Native account screens, adapters/UI, OS secure session storage and physical-device acceptance are Phases 8/12/15. No mobile SDK, emulator or simulator is needed to validate these contracts.

1. Authenticate with the existing account/session APIs. Mobile uses its own account access token over HTTPS, not a desktop/agent credential. Never embed credentials in URLs or expose agent enrolment/command lease tokens to users.
2. Select an authorized workspace and read `GET /workspaces/{workspaceId}/developer`. `PairedComputer` includes connection, sharing/consent reports, platform support, server-evaluated `canControl`, and up to 32 `RemoteService` summaries. Unavailable/revoked computers expose no active services. Missing/sleeping/offline cannot be distinguished reliably; do not claim wake support.
3. Viewers can inspect shared summaries. Only verified current OWNER/ADMIN members explicitly named by that paired computer's owner can request remote shutdown. The computer must independently enable Developer Tools, sharing and remote control. A capability, local-control flag, guardian role or installation ID is not authority.
4. Select a fresh service, display its project/runtime, PID/start time, ports and captured child count. PID/start time are read-only display metadata. Confirm graceful mode or a **separate** force-stop warning. Captured descendants are optional and limited to sixteen; do not silently select them or escalate to force.
5. Create a UUID request ID **once per confirmed intent**, retaining it for retries after a lost HTTP response. POST `RemoteCommandInput` to `/workspaces/{workspaceId}/agents/{agentId}/commands`. The fixture `fixtures/remote-command.v1.json` is synthetic. There is no PID, process path, signal number or shell-text input. A reused request ID with different intent returns 409.
6. HTTP 201/pending and accepted both remain unconfirmed. Poll `GET .../commands` (bounded recent 25) for the immutable command ID, state, outcome, timestamps and audit. Keep workspace/user boundaries on asynchronous results, cancel reads on account/workspace changes and clear protected data on authorization loss. Refresh inventory approximately every five seconds while the screen is visible; never replay queued offline button presses after a reconnect.
7. Cancellation is `POST .../commands/{commandId}/cancel`, only before `startedAt`. Once execution is authorized to start, cancellation returns 409 and cannot undo shutdown. The agent separately claims a short-lived lease and performs a final server authorization check; mobile clients never call these opaque-agent endpoints.

## State and outcome presentation

| State | Meaning |
| --- | --- |
| pending | Requested, not claimed; shutdown is unconfirmed |
| accepted | Agent claimed the request; shutdown is still unconfirmed |
| succeeded | Agent reported `stopped` or `already_stopped` for the captured identity |
| failed | Denied/changed/still-running/replacement/inspection failure, or outcome unknown |
| expired | Execution was not authorized to start before the deadline |
| cancelled | Cancellation/revocation prevented execution authorization |

A started command whose deadline passes becomes failed/unknown, not “expired and definitely unexecuted.” A late authenticated receipt can refine an unknown result. `replacement_listener` means another owned listener was observed; it can be a supervisor or port reuse. Do not stop the replacement automatically. `target_changed`, `STALE_OBSERVATION`, `tree_changed`, `permission_denied`, `still_running`, `partial` and `unknown` require clear messages and a fresh review, not automatic retries or success banners.

Creation requires a service observation no more than ten seconds old. Commands expire at the earlier of ten seconds after request or fifteen seconds after that observation. A response includes `expiresAt`; do not invent a longer deadline. An asleep/offline agent cannot run old commands on wake/reconnection. Agent execution additionally checks a fresh permit, process incarnation, sockets/tree and a wall-clock deadline.

## Privacy, storage and unavailable platforms

Only consented summaries leave the computer: project labels, runtime, PID/start time, observed time, up to eight distinct ports, eligibility and captured child count. No executable/working-directory paths, command arguments, traffic or arbitrary files are uploaded. Server command/audit retention is seven days through the configured cleanup job. Current snapshots are hidden after fifteen seconds and stale stored summaries are cleared by maintenance. Erasure revokes credentials and deletes remote state/commands/audit; disconnected agents apply local cleanup on reconnection.

Initial native execution is verified on macOS with controlled services. Windows/Linux process-control adapters remain unavailable. Native Electron/Keychain packaging, real phone UI/network/battery behavior and actual device checks remain pending. Platform reports must not turn unavailable controls into active buttons. Optional long-running-service reminders await operational soak and notification design; no reminder provider is claimed implemented.
