# Agent and desktop integration design

This is the Phase 1 protocol design. No IPC listener, command delivery, process discovery, persistent service or background connection is implemented in this phase.

## Process and module boundaries

The Go core owns installation identity, enrolment/revocation, heartbeat, outbound authenticated backend communication, bounded local buffering and update/diagnostic status. Network Monitoring owns discovery/router adapters; Developer Tools owns process identity, project mapping and service actions. Each module reports its own capability and can be disabled independently. A network-only installation never registers a service-control handler.

Electron main is the local agent client. The renderer receives a minimal typed bridge; it never receives agent credentials, arbitrary socket access, shell commands or raw filesystem/process APIs. Preserve Phase 0 context isolation, sandboxing and CSP. The current bridge exposes read-only runtime metadata only.

## Local transport and authentication

For the initial macOS target, choose a per-user Unix domain socket in a private application-state directory (0700 directory, 0600 socket). Bind it to the current user, verify ownership before connecting, reject symlink/unexpected-owner paths, and never expose a TCP control endpoint. Windows later uses a per-user named pipe with an explicit user ACL and equivalent identity checks; do not silently replace it with an unauthenticated localhost port.

Generate a random installation credential with at least 256 bits of entropy and protect it in the operating-system credential store. Keep it in Electron main and agent memory only; never send it to the renderer, API logs or process arguments. Initialization/authentication is a transport preface, separate from `local-ipc.v1.schema.json` application requests. On connection, perform a versioned challenge-response using a fresh random nonce and an HMAC proof over the nonce and protocol context; consume each challenge once, impose a short handshake deadline, compare proofs in constant time and reject unauthenticated application frames. Pin down the preface wire schema and cross-language test vectors before implementing transport.

Use length-delimited UTF-8 JSON frames, with a 64 KiB initial frame limit and request IDs. Validate size, method, payload shape, protocol version and authentication before dispatch. No generic execute/shell/file-read methods exist. Reconnection requires a new handshake. Credential rotation/revocation closes authenticated sessions. Local filesystem permissions supplement authentication; they do not replace it.

Local authentication proves installation access, not remote workspace authority. Remote commands additionally require server-side membership, explicit device control grants, pairing, consent, enabled module, supported action and unrevoked agent identity. Keep local view, local action and remote control settings separate.

## Backend connection and command state

Use an agent-initiated TLS connection; deploy no inbound desktop listener for remote access. Enrolment codes are short-lived/single-use and exchanged for scoped, revocable installation credentials. Define heartbeat/connection deadlines during agent implementation; mark disconnected devices unavailable rather than assuming reachability.

Remote stop command identity includes workspace, agent, stable service ID, expected PID/start time, command ID, requested time and expiry. The draft contract limits lifetime to 60 seconds. Execution must verify actual current time, clock skew policy, current authorization, target identity and previous execution state. A service report/capability cannot authorize a command.

Allowed lifecycle: pending -> accepted -> succeeded/failed; pending/accepted can expire or be cancelled before action starts. Acceptance is not success. Once shutdown starts, cancellation cannot claim to undo it; record the eventual result. A process that exits before execution produces an explicit already-stopped outcome; replacement identity produces target-changed failure. Force-stop is a separate explicit request, never an automatic fallback. Record supervisor restarts and verify port/process state before reporting lasting success.

Maintain deduplication records durably through the command replay window. Re-delivery returns the previous outcome rather than repeating shutdown. Revocation invalidates queued commands and closes relevant sessions. Expired commands cannot run after reconnect or computer wake. Retention/deletion must preserve enough minimal deduplication state to avoid replay while removing user content according to policy.

## Packaging and operational requirements

Package the Electron interface and matching Go executable for each supported OS/architecture. Verify downloaded updates/signatures, avoid privileged agent execution, and keep pairing credentials outside replaceable application binaries. Agent background startup requires explicit user enablement. Distribution signing/notarization, updater provider, supported OS versions and installer rollback need acceptance before shipping; they are not configured by this design.

The Go source still prints disabled module status and exits. Prototype the protocol with cross-language fixtures and malformed/authentication/replay tests before enabling real controls. Validate Unix socket behavior on the actual desktop and Windows pipe behavior when that target is implemented.
