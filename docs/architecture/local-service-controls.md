# Local developer services and shutdown

Phase 6 implements local macOS TCP service discovery and shutdown. Phase 7 owns remote service synchronization, command delivery and mobile/web control grants. No local capability or preference authorizes a remote command. No listener, process inventory, directory or action receipt is uploaded by Phase 6.

## Identity and platform adapter

The macOS cgo adapter calls libproc directly, without shell commands, `ps` parsing or `lsof` dependencies. It enumerates the current user's processes, reads process start time, executable path, parent, working directory and listening TCP socket descriptors. Arguments, environment variables and socket traffic are never read. The renderer receives executable basenames, project labels/evidence and endpoints; full executable/working-directory paths stay inside the agent.

The process identity includes PID, start time, owner and kernel PID version. Socket generations distinguish a close/rebind in the same process. Before signalling, the agent rechecks process identity and the complete captured socket set. Signals use `proc_signal_with_audittoken` with the captured PID/version, so the kernel rejects a reused PID/incarnation rather than targeting its replacement. No plain-PID kill fallback exists. Only SIGTERM and separately confirmed SIGKILL are exposed.

The PID-version binding uses Apple's published 56-byte `PROC_PIDUNIQIDENTIFIERINFO` ABI (selector 17), absent from public SDK headers. Its size is asserted, query results are checked, and capability checks require a successful self-query and the signal symbol. Unsupported environments fail closed. This dependency requires continuing OS-version acceptance; a passing build is not a guarantee for every macOS version. References: [Apple XNU identity ABI](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info_private.h) and [Apple libproc signal implementation](https://github.com/apple-oss-distributions/xnu/blob/main/libsyscall/wrappers/libproc/libproc.c).

Windows, Linux and macOS without cgo have no native developer adapter. They return platform-unavailable inventory with no services or controls. Existing Windows private-state/pipe limitations remain. Root execution is not supported for local developer controls; no privilege escalation is attempted.

## Eligibility, consent and freshness

Every discovery, project correction, history read and shutdown rechecks current backend agent configuration. Local Developer Tools preference, paired identity and current workspace module authorization are all required. Shutdown additionally requires the separate local `localControlAllowed` choice, initially false and reset on pairing, unpairing or revocation. That choice does not register a service or enable remote access. Backend outages, stale generations, revoked identity and disabled modules deny actions. Runtime/capability reports are not authorization.

Discovery creates fresh random observation IDs, valid for fifteen seconds and held only in memory. Each inventory refresh replaces the previous observations; project correction invalidates them too. Shutdown accepts an action UUID, service hash, observation UUID, explicit mode and explicit child choice. Renderer-provided PIDs, signals, paths and commands are rejected. A consumed observation cannot initiate another stop. The action targets a process and all of its listeners, not one port.

Only supported runtime executable names (Node, Python, Bun, Deno, Ruby, PHP and Java) are eligible initially. This is a heuristic label/compatibility filter, not a security grant. Unknown runtimes, privileged/foreign processes, the agent and visible ancestors remain uncontrollable. Go/native binaries and platform/container expansion require later adapters or explicit eligibility design; a project label cannot grant process-control permission.

## Project and inventory limits

Project inference checks marker existence only, walking at most twelve ancestors for package.json, go.mod, pyproject.toml, Cargo.toml, Gemfile, pom.xml, composer.json or .git. It does not read their contents or execute package scripts. A working-directory-only match is explicitly uncertain. Manual local group names can correct or combine projects; clearing a correction restores inference. Keys are hashes of local association locations, not persisted full paths. At most 128 overrides are retained.

A scan is bounded to five seconds, 8,192 candidate PIDs and 256 listening processes, paginated ten per response. Per-process inspection is limited to 2,048 descriptors and 64 endpoints; the UI shows at most eight endpoints plus an additional count. Query filtering covers project labels, runtime, executable, PID and endpoints. Permission failures/process exits/limits may omit a process and are counted when its descriptor inspection fails. Inventory is per user, not a system-wide administrator view.

## Child processes, outcomes and history

A stop defaults to the selected process only. The confirmation can explicitly include its captured descendants, at most sixteen. Preflight rejects changed trees, changed identities and protected targets before signalling. Captured descendants are signalled deepest first, then the selected process. No process-group broadcast, unselected supervisor shutdown, force fallback or repeated signal loop is used. Newly created or reparented processes are not swept into an old request.

A journal entry must be persisted before any signal. Receipt fingerprints enforce duplicate-ID consistency; repeats return the stored outcome without repeating shutdown. Interrupted pending entries become unknown after restart and never resume. An in-memory observation is also single use, so evicted receipts cannot reactivate old requests.

Verification waits up to three seconds for captured identities to end, retrying transient inspection uncertainty. Unknown inspection stays unconfirmed. After exit, it checks owned listeners for roughly half a second; a new listener at the old address/port produces `replacement_listener`. This may indicate supervisor restart or unrelated port reuse. The replacement is never signalled automatically. No observation window proves that a supervisor cannot restart later. Listener changes can also race preflight; the actual kernel signal remains bound to the original process incarnation, not to a port.

Outcomes distinguish stopped, already stopped, target changed, still running, denied, tree changed/limited, partial, unknown, inspection failure and replacement listener. A signal acknowledgement alone is not success. A lost response requires inspecting history, not assuming shutdown or blindly issuing another action.

The private local journal retains at most 100 receipts in a seven-day window. History responses are paginated 25 per frame, including for long/escaped project labels; the optional offset preserves empty-payload compatibility. Expiry is pruned at startup, reads/writes and normal agent-loop passes (including disabled-module/offline passes); a stopped agent prunes on its next start. Pairing, unpairing and credential revocation clear receipts/overrides and reset local shutdown consent. Offline server-side deletion is applied after the agent reconnects. Existing backup and OS-store acceptance limits still apply.

## IPC compatibility

The authenticated framing/HMAC preface is unchanged. Phase 5 setup/status calls remain application protocol v2. Developer methods use separately versioned v3 schemas: list_services, request_stop, set_project, get_action_history and set_local_control. Electron main validates allowlisted request/response shapes; preload exposes typed calls only. The legacy status `serviceControlAvailable:false` remains unchanged for v2 clients; it cannot advertise v3 execution. The v3 inventory reports local eligibility, and every execution still performs fresh checks.
