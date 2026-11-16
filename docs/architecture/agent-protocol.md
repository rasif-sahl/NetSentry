# Agent and desktop integration design

Phase 5 implements the shared outbound core and authenticated Unix IPC below. Phase 6 adds local macOS service discovery/actions through application protocol v3; remote command delivery and persistent service installation remain unavailable. See [validation](../validation/phase-5.md) and the [distribution/service plan](agent-distribution.md).

## Process and module boundaries

The Go core owns installation identity, enrolment/revocation, heartbeat, outbound authenticated backend communication, bounded local buffering and update/diagnostic status. Network Monitoring owns discovery/router adapters; Developer Tools owns process identity, project mapping and service actions. Each module reports its own capability and can be disabled independently. A network-only installation denies developer requests before process inspection or signalling.

Electron main is the local agent client. The renderer receives a minimal typed bridge; it never receives agent credentials, arbitrary socket access, shell commands or raw filesystem/process APIs. Preserve Phase 0 context isolation, sandboxing and CSP. The bridge exposes runtime metadata, setup/preferences and typed local developer calls. See `local-service-controls.md` for separate consent, observation and execution rules. Main validates frame origin and payloads; renderer input cannot choose a binary, path, socket or arbitrary method.

## Local transport and authentication

For the initial macOS target, choose a per-user Unix domain socket in a private application-state directory (0700 directory, 0600 socket). Bind it to the current user, verify ownership before connecting, reject symlink/unexpected-owner paths, and never expose a TCP control endpoint. Windows later uses a per-user named pipe with an explicit user ACL and equivalent identity checks; do not silently replace it with an unauthenticated localhost port.

Generate a random installation credential with at least 256 bits of entropy and protect it in the operating-system credential store. Keep it in Electron main and agent memory only; never send it to the renderer, API logs or process arguments. Initialization/authentication is a transport preface, separate from `local-ipc.v1.schema.json` application requests. On connection, perform a versioned challenge-response using a fresh random nonce and an HMAC proof over the nonce and protocol context; consume each challenge once, impose a short handshake deadline, compare proofs in constant time and reject unauthenticated application frames. The implemented preface and shared HMAC vectors are in `contracts/schemas/local-auth.v1.schema.json` and `contracts/fixtures/local-auth.v1.json`.

Use length-delimited UTF-8 JSON frames, with a 64 KiB initial frame limit and request IDs. Validate size, method, payload shape, protocol version and authentication before dispatch. No generic execute/shell/file-read methods exist. Reconnection requires a new handshake. Each connection handles one application request then closes; changes apply to subsequent requests. Local credential rotation requires stopping/restarting the development agent; backend revocation clears backend identity on the next outbound check. There is no long-lived authenticated renderer session. Local filesystem permissions supplement authentication; they do not replace it.

Local authentication proves installation access, not remote workspace authority. Remote commands additionally require server-side membership, explicit device control grants, pairing, consent, enabled module, supported action and unrevoked agent identity. Keep local view, local action and remote control settings separate.

## Backend connection and command state

Use an agent-initiated TLS connection; deploy no inbound desktop listener for remote access. Enrolment codes are short-lived/single-use and exchanged for scoped, revocable installation credentials. Define heartbeat/connection deadlines during agent implementation; mark disconnected devices unavailable rather than assuming reachability.

Remote stop command identity includes workspace, agent, stable service ID, expected PID/start time, command ID, requested time and expiry. The draft contract limits lifetime to 60 seconds. Execution must verify actual current time, clock skew policy, current authorization, target identity and previous execution state. A service report/capability cannot authorize a command.

Allowed lifecycle: pending -> accepted -> succeeded/failed; pending/accepted can expire or be cancelled before action starts. Acceptance is not success. Once shutdown starts, cancellation cannot claim to undo it; record the eventual result. A process that exits before execution produces an explicit already-stopped outcome; replacement identity produces target-changed failure. Force-stop is a separate explicit request, never an automatic fallback. Record supervisor restarts and verify port/process state before reporting lasting success.

Maintain deduplication records durably through the command replay window. Re-delivery returns the previous outcome rather than repeating shutdown. Revocation invalidates queued commands and closes relevant sessions. Expired commands cannot run after reconnect or computer wake. Retention/deletion must preserve enough minimal deduplication state to avoid replay while removing user content according to policy.

## Packaging and operational requirements

Package the Electron interface and matching Go executable for each supported OS/architecture. Verify downloaded updates/signatures, avoid privileged agent execution, and keep pairing credentials outside replaceable application binaries. Agent background startup requires explicit user enablement. Distribution signing/notarization, updater provider, supported OS versions and installer rollback need acceptance before shipping; they are not configured by this design.

The no-argument Go command still prints the disabled collector capability report and exits for compatibility. Explicit `init`, `pair`, `settings` and `run` commands activate the shared foundation. Native Keychain source compiles on macOS using existing tools; tests run a development process with explicit private loopback storage. Windows Credential Manager source cross-compiles, while private ACL/runtime lock/named-pipe startup is fail-closed and pending. Linux Unix IPC is CI-tested with development storage only.

## Implemented wire details

Handshake version 1 is separate from application protocol version 2. Each frame is 4-byte unsigned big-endian length followed by UTF-8 JSON, with length 1–65,536. Authentication has a five-second deadline, subsequent operations a twenty-second server deadline and a maximum of sixteen concurrent socket clients. Unknown/duplicate JSON keys and unsupported frames are rejected in Go.

The agent sends `{protocol:"netsentry-local",version:1,nonce,instanceId}` with two fresh 32-byte random values as lowercase hex. Electron generates its own fresh 32-byte hex `clientNonce` and sends `{version:1,clientNonce,proof}`. `proof` is lowercase hex HMAC-SHA256, using the hex-decoded 32-byte local secret, over `netsentry-local/v1` + newline + nonce + newline + instanceId + newline + clientNonce (no trailing newline). The agent compares in constant time and returns `{authenticated:true,proof}` using the same construction with context `netsentry-local/v1/accepted`. Electron verifies that proof before sending an application request. Challenges are per connection; replay against a new challenge fails.

Application v2 requires a UUID request ID and `{schemaVersion:2,requestId,method,payload}`. Electron exposes `get_status`, `pair`, `set_modules` and `set_background`; request and response schemas are versioned separately. The earlier v1 service-command schema remains a future design and is not used by the active bridge. Under v2, agent-side `list_services`/`request_stop` still return module-disabled or unavailable-phase. The separately versioned v3 interface implements local developer operations on supported macOS. There is no generic execute method.

Outbound API uses verified HTTPS without redirects/proxy inheritance; explicit test mode alone permits loopback HTTP/private credential files. Agent identity is distinct from account/device tokens and scoped to one installation, workspace and owning membership. Configuration is generation-bound. Heartbeats run every 30 seconds; server list status becomes unavailable after 90 seconds without a heartbeat. Historical diagnostic replay never updates last-seen reachability. Backoff and retention limits are recorded in the agent README and API configuration contract.

Phase 6 adds `local-ipc.v3.schema.json` and `local-ipc-response.v3.schema.json` for explicit local discovery/actions. See [local developer architecture](local-service-controls.md). Service/process details stay local; the shared outbound core still uploads only the Phase 5 heartbeat and enumerated diagnostic metadata.

Phase 10 adds independent local IPC v5 network preferences and outbound named-network configuration/snapshot/pause routes. The runner retains only a short-lived latest snapshot for exact lost-acknowledgement retry. Network evidence cannot authorize process control. See [network monitoring](network-monitoring.md).
