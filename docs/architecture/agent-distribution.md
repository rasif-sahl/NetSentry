# Agent packaging and service decision

Phase 5 provides a development executable and offline Ed25519 package verifier. It does not install a background service, download updates, configure a signing provider or create release signing credentials. Release distribution remains gated on provider/key ownership, code signing, notarization and installer acceptance.

## Release trust and replacement

Ship the matching Go binary in Electron `resources/agent/netsentry-agent` on the initial macOS target. The renderer cannot choose this path. Development builds alone accept a main-process environment override. Electron verifies ownership/file permissions before invoking the credential helper, but those checks are **not** code-signature verification. Release packaging must verify the signed application/binary chain before first execution; ordinary developer-built binaries are not distribution-verified.

Use an offline-controlled Ed25519 root whose public key is pinned in the installer. Sign exact UTF-8 manifest bytes; publish a detached signature and the artifact. Each manifest includes `schemaVersion:1`, positive monotonic `release`, semantic display `version`, exact `platform`/`architecture`, artifact basename, `bytes`, lowercase SHA-256, and UTC-millisecond `expiresAt`. Metadata expires within 30 days. The Go verifier checks all these bindings and an operator-supplied minimum release. It never executes or installs the file.

The future installer must persist a protected accepted-release high-water mark across upgrades/reinstallation; the CLI minimum is an input, not persistent rollback protection. Download to a separate staging path, verify using the pinned key, verify platform code signing, stop the user agent, atomically replace the application-owned binary and restart only if background permission remains. Verify the same opened bytes at replacement time; the current CLI verification result must not authorize a later mutable file. Preserve credentials/state outside the application bundle. Keep the previous signed version for health rollback; rollback must satisfy explicit signed recovery policy and must not erase the high-water mark silently. Key rotation needs a root-signed transition and acceptance tests. None of these installer actions is enabled now.

## Explicit service registration

Initial target: a macOS **per-user LaunchAgent**, with no root/LaunchDaemon registration. A later installer will offer an unchecked “Run NetSentry in the background” choice, explain the selected modules/data, require workspace background authorization, verify the signed executable, then create the current user’s `~/Library/LaunchAgents/com.netsentry.agent.plist` only after that choice.

The proposed plist uses a fixed `Label`, `ProgramArguments` containing the trusted executable plus `run --background --state-dir` and the user's private state directory; it never includes credentials/codes. `RunAtLoad` is allowed only after opt-in. `KeepAlive` must not restart a process intentionally exiting after revocation/disabled permission; use bounded scheduling or explicit successful-exit handling, and verify behavior before release. Do not run a shell. Do not make state world-readable or emit credentials in launch logs. Disabling background must stop/unregister the job, not merely hide the UI preference.

The current desktop checkbox stores local consent only. The agent requires local AND workspace allowance for `run --background` and stops when either is withdrawn. It uses an exclusive process lock to protect the durable outbox. Development runs remain foreground/manual; no launchctl commands or plist are executed/created by this phase.

A hard crash can leave `agent.sock`. Startup refuses to replace it. After confirming the foreground process has exited, an operator may remove only the private socket and restart; normal shutdown removes its own socket. An installer should provide a process-identity-aware repair workflow, not delete arbitrary paths.

Windows named-pipe ACL, private-state ACL, runtime locking and explicit user service/login registration are deferred together. Credential Manager source exists but is not runtime accepted. Linux development tests use Unix sockets and explicit loopback-only file storage; production Secret Service and service supervision remain unimplemented. No TCP fallback is permitted. Phase 6 process adapters and Phase 7 remote command delivery remain independent gates.

Phase 14 supplies offline Ed25519 candidate packaging and protected per-target verification high-water state in `infra/scripts/release.mjs`, compatible with the existing Go verifier. This verifies candidates only; it does not install/update binaries or satisfy OS code signing, service installation or atomic replacement/rollback. Follow the Phase 14 operational runbook before preparing a distributable release.
