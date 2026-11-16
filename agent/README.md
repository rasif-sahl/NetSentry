# NetSentry Go agent

Phase 5 implements a separately enrolled, revocable software identity, outbound backend connection, heartbeats, bounded diagnostic buffering, independently gated modules, and authenticated desktop IPC. Phase 6 additionally discovers owned macOS TCP services and performs explicitly confirmed local shutdown through the desktop. Phase 7 adds separately consented summary sharing and authorized outbound remote commands. It does not collect traffic.

## Build and test

Use Go 1.23+ (`GOTOOLCHAIN=local` prevents automatic toolchain downloads). No external Go dependencies are needed.

```sh
cd agent
GOTOOLCHAIN=local go vet ./...
GOTOOLCHAIN=local go test -race ./...
GOTOOLCHAIN=local go build -o /tmp/netsentry-agent ./cmd/netsentry-agent
```

macOS native credential storage requires cgo and the already-provisioned macOS desktop development tools. Missing tools cause a safe error; do not install Xcode/mobile SDKs for this task. The local validation used a checksum-verified temporary Go toolchain and existing Command Line Tools. See [verification](../docs/validation/phase-5.md).

## Run explicitly

For the initial macOS target, initialize against your HTTPS API, whose base path includes `/api/v1`:

```sh
/tmp/netsentry-agent init --api https://your-api.example/api/v1
/tmp/netsentry-agent status
```

`init` outputs a nonsecret installation ID. In your authenticated workspace, read `GET /agents/disclosure`, accept that version and `POST /workspaces/:workspaceId/agents/enrolments` with this installation ID, platform `darwin`, name, explicit `{network,developer}` module authorization, and `backgroundAllowed`. Set `accepted:true` and `disclosureVersion`. Codes expire after ten minutes and are single use. This API flow is available now; a dashboard agent-management screen is not part of Phase 5.

Save the returned code to a private 0600 file, then pair. Avoid putting the code into process arguments, terminal history or logs. Delete the file afterwards.

```sh
/tmp/netsentry-agent pair --code-file /absolute/path/to/private-code-file
/tmp/netsentry-agent settings --network=true --developer=false --allow-background=false
/tmp/netsentry-agent run --once
/tmp/netsentry-agent run
```

The last command stays in the foreground until Ctrl-C. It listens only on a private Unix socket; backend traffic is outbound. `--no-local` supports an outbound-only host. Commands that mutate local state take an exclusive installation lock; use desktop IPC for changes while running. `status` requires the foreground process to be stopped and reads persisted identity/preferences and does **not** query a running process or assert current connectivity. Desktop Refresh queries live local status; the backend list uses server timestamps, not local claims.

Both module preferences default off. Effective configuration requires local preference, current workspace authorization and a successful backend connection; actual collectors still report unavailable. `--background` requires explicit local **and** workspace permission and exits when permission is removed. It never registers a service or login item. Closing Electron neither starts nor stops a separately launched agent.

`unpair` removes the local backend credential and outbox after the process stops. Revoke the backend registration with `DELETE /workspaces/:workspaceId/agents/:agentId` to invalidate any copied credential; erase associated diagnostic data using the `/data` deletion endpoint. Re-pairing rotates credentials and invalidates the previous generation. Membership removal revokes agent access.

## Development-only credential files

For loopback tests only, add `--development-store` at initialization, an explicit `http://127.0.0.1:PORT/api/v1` API and an isolated `--state-dir`. This uses private local files instead of an OS credential store. It is rejected for non-loopback APIs, including HTTPS. Production storage is macOS Keychain; no secret is returned in status/stdout. Linux production secure storage and Windows private ACL/named-pipe operation remain unavailable; there is no plaintext/TCP fallback. Windows credential-manager source cross-compiles but is not a supported runtime yet.

Local storage is per user: private directory 0700, files/socket 0600. The outbox contains only enumerated diagnostic codes, UUIDs and timestamps: at most 1,000 events / 1 MiB / 24 hours, in batches of 50 with durable replay IDs. Overflow/expiry drops oldest entries and reports a count. Backoff increases with jitter for eight attempts, followed by five-minute cooldown retries. Generation changes, revocation and unpairing clear stale buffered data. Server retention is seven days, with an explicit operator cleanup job.

## Verify a release artifact

```sh
/tmp/netsentry-agent verify-package --manifest release.json --signature release.sig --public-key trusted-release-key.pub --artifact netsentry-agent --minimum-release 5
```

The key and detached signature are standard base64 Ed25519 values. The signature covers the exact manifest bytes. Pin the public key independently of the downloaded package; never trust a key shipped alongside an untrusted update. The signed manifest binds schema version 1, monotonic `release`, display `version`, platform, architecture, artifact basename, byte size, SHA-256 and UTC-millisecond `expiresAt`. It rejects expired metadata, freshness windows over 30 days, rollback below the supplied minimum, wrong targets, modified files, non-regular files and files over 128 MiB. Success verifies bytes only; it does not install or run them. A production installer must persist its accepted release high-water mark and verify again at replacement time.

See [agent protocol](../docs/architecture/agent-protocol.md) and [package/service plan](../docs/architecture/agent-distribution.md) for trust, installation, recovery and pending platform acceptance.

## Phase 6 local developer tools

Pair with Developer Tools authorized in your workspace and enable the local developer preference. In the desktop, choose **Refresh services** to discover owned TCP listeners. Project names are inferred from nearby markers or directories and show their uncertainty. Enter a local project/group correction or use the inferred association again. Search by project/runtime/PID/port; inventory is paginated.

Local service shutdown is a separate unchecked choice. Enable it in the desktop, or while the foreground agent is stopped:

```sh
/tmp/netsentry-agent settings --developer=true --allow-local-control=true
```

Pairing, unpairing and revocation reset that choice. Select a fresh service observation and confirm graceful stop or a separate force-stop. The entire selected process and its listeners are targeted, with optional captured descendants (maximum sixteen). Backend authorization must be reachable/current for every operation. An offline backend denies local developer access in this initial policy; no stale grant enables shutdown.

Node, Python, Bun, Deno, Ruby, PHP and Java executable names are initially eligible. Unknown/native/Go runtimes remain view-only. A marker or capability does not grant control. Signals are bound to the stored process incarnation; changed sockets/trees and expired observations are rejected. A supervisor may replace a process; the agent reports observed replacement without targeting it automatically.

Action receipts and manual labels are private local data, not backend telemetry. Receipts are bounded to 100 within seven days, pruned on active agent passes/start/read/write; they are cleared with labels on unpair/revocation. Full paths and process arguments are not sent to the renderer/backend. See [architecture and limits](../docs/architecture/local-service-controls.md) and [Phase 6 verification](../docs/validation/phase-6.md). Windows/Linux controls and packaged Electron/Keychain acceptance remain pending.

## Phase 7 remote service commands

Sharing and remote shutdown default off. After pairing, explicit CLI flags are `--developer=true --share-services=true --allow-remote-control=true --accept-remote-disclosure`, or use desktop consent controls. The computer owner must separately accept the server disclosure and name current verified owner/admin controllers in the web dashboard. Local shutdown consent never enables remote access. Commands use outbound polling, fresh execution permits and bounded durable receipts; no inbound listener or shell execution is exposed. See [remote architecture](../docs/architecture/remote-service-commands.md) and [verification](../docs/validation/phase-7.md).

Phase 10 network collection is separately opt-in: assign this agent to a named network in the dashboard, then use `settings --share-network=true --network-id=<uuid> --accept-network-disclosure=true` (or desktop Network sharing). The module flag alone collects nothing. `--share-network=false` schedules a server pause acknowledgement; erasure remains separate. `run --once` runs one network cycle; normal running samples every thirty seconds independently of developer commands. Only passive macOS/Linux IPv4 cache metadata is collected. OpenWrt credentials require a separately configured assigned router, verified HTTPS and a local matching interface. No active scanning or per-device traffic. See [network boundary and limitations](../docs/architecture/network-monitoring.md).

Desktop update handoff: the internal `hold-update-lock --state-dir PRIVATE_DIRECTORY` command acquires the existing runtime lock, emits only a bounded lock acknowledgement and holds until stdin closes. It accesses no credentials and starts no monitoring. The desktop invokes only its signature-verified bundled agent; running agents (including `--no-local`) exclude the update lease. Background service registration remains separate.
