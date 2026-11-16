# Desktop and cross-network remote acceptance

Existing Go/macOS checks exercise controlled native listeners and real outbound agent/API flows. They do not establish packaged Electron, native Keychain, installer signing or a phone-to-desktop workflow. Windows/Linux native developer control remains unavailable. Do not install Electron, services or mobile tooling automatically to fill these gaps.

## Desktop candidate

Use profile `desktop`, exact desktop archive and agent hashes, and the server manifest. On the intended macOS/architecture, review the signed application/agent trust chain before executing a distribution candidate. The Electron runtime is not downloaded by repository dependency preparation. If no reviewed packaged application exists, mark runtime/distribution gates pending; a renderer build or Go CLI is insufficient.

`desktop.runtime`: open the real app, pair an explicit foreground agent, verify actual Keychain access/lock failures and private socket/state permissions. Test wrong-user/secret IPC rejection, exclusive startup, safe failure after a crash and local preference persistence. Network module selection never grants developer control. Local/background preferences do not install a LaunchAgent; no service registration is implemented.

`desktop.processes`: use only disposable owned sample listeners in a dedicated test project, with an unrelated sample left running. Inspect actual executable/PID/start, ports, project evidence and freshness. Test graceful stop, a separate force-stop when a sample ignores graceful shutdown, explicitly captured descendants and changed trees. If a supervisor restarts a sample or a port is reused, report the replacement and leave it untouched. Never retry by entering a PID, signalling an unrelated existing server or killing all instances of a runtime. Verify actual listener/process exit, not just an accepted request.

`desktop.revocation`: turn off local control, sharing and remote consent independently; remove named controller grants or revoke agent generation while a command is pending. Reconnect and confirm no expired/cancelled action executes. Check current action history after a lost response before any retry. No arbitrary shell command or inbound agent port should exist.

`desktop.distribution` and `desktop.recovery`: inspect actual app/agent signing and notarization, trusted bundled binary path, install/uninstall/data preservation, protected release root/high-water state, interrupted update, atomic replacement and signed recovery policy. Phase 14's offline package verifier returns `installed: false` and is not an updater. Service installation, atomic replacement and installer recovery are not implemented/accepted here; leave these gates pending until the actual delivery path exists and passes. See [agent distribution](../architecture/agent-distribution.md).

## Android/iPhone remote test

Use `android.remote` or `ios.remote`, with the exact phone app, foreground agent and server-manifest hashes. Record phone/desktop model/OS, UTC time, reviewed project label/ports, command UUID and redacted server/agent outcome. Avoid logging full local paths or credentials.

1. Pair the computer to the test workspace; explicitly enable local Developer Tools, summary sharing and remote shutdown consent. Grant only the intended verified controller through the backend/web. Check that a viewer/ungranted account has no action.
2. Start two clearly identified disposable sample Node/Python listeners with different ports. Record which is the target; leave the unrelated listener running. Do not test on real unsaved projects, shared services or unknown processes.
3. Put the phone on cellular or another network while the computer remains on its original network. The phone must use the reachable HTTPS backend. Do not forward a port into the desktop or treat two loopback clients as another-network evidence.
4. On the phone, fetch a fresh service observation, inspect the target project/runtime/ports and confirm graceful stop. Verify the outcome on the computer and that the unrelated listener remains alive. Pending/accepted is not a passed shutdown.
5. Repeat with a fresh disposable sample ignoring graceful shutdown. Confirm it remains running after graceful mode; only an explicit new force confirmation may target it. Recheck exact observation/identity before each action.
6. Wait beyond freshness; replace a sample/listener before confirmation; turn the desktop offline; revoke grant/local consent; expire and cancel pending commands. Reconnect after expiry and prove no delayed stop executes. Record uncertainty rather than assuming success.
7. Interrupt a response after submission in a controlled test. Review history using the original UUID. An explicit retry must preserve the exact original intent inside its deadline; never autoqueue a stop offline or silently target a new process.
8. Disable sharing/remote shutdown, stop samples manually through their own terminal controls and confirm no persistent monitoring/service was installed. Record any cleanup failure.

Test phone accessibility, distinct graceful/force dialogs, cancel/error/empty states and visible stale observations. A remote API/Go test with synthetic phone requests remains integration evidence; only an actual signed phone app over the stated network boundary passes this physical gate.
