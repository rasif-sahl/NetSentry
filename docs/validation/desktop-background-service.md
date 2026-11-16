# Desktop background-service registration and removal

Implemented for the initial macOS per-user desktop target. This is source/build/integration verification, not signed production or login acceptance. No production `com.netsentry.agent` job was installed. Windows/Linux service registration is unavailable.

## Behavior and operation

Use a signed packaged NetSentry app installed in `/Applications` or `~/Applications`, with a matching trusted bundled agent and configured signing team. Pair the agent and authorize background operation in the workspace, then stop its foreground process. Select **Register background service** under **Run at login** and review the native confirmation. This saves local background consent only after a fresh backend grant; it does not enable modules, data sharing or shutdown permission. The fixed job starts immediately and at login. `KeepAlive` is false: offline/denied startup exits without a restart loop. Resolve the issue and use **Start registered service**. A stale pairing generation needs foreground reconciliation first.

Use **Remove background service** before updating, moving or deleting the app. Removal bootouts only the verified owned job, verifies absence and deletes matching plist/receipt files. Pairing, stored data, module and sharing choices remain intact. Local background permission is cleared through the signed helper; if this cannot be verified, the UI reports it separately. Removal of verified owned files/jobs does not require current signature trust, but never executes an untrusted helper. Cancel makes no changes. A conflicting job/file or unverifiable launchd response blocks mutation; review it manually. A stale agent socket is never deleted automatically.

A private ownership receipt binds the exact generated plist and state directory. Partial registration/bootout failures retain recovery evidence. Update installation refuses a registered plist, receipt or loaded job; registration after an update is explicit. Production signing identity and update hosting remain unconfigured, so unsigned packaged execution, registration and updates stay disabled.

## Reproducible checks

- Build the existing Go toolchain's agent into `artifacts/netsentry-agent`; run `go test -race ./...` from `agent/`.
- `npm --prefix desktop run build` and `TEST_AGENT_BINARY="$PWD/artifacts/netsentry-agent" npm run test:desktop-updates`: manager ownership/permission checks, native-confirmation cancellation, workspace denial, partial recovery, modified/foreign jobs, stale sockets, explicit restart and update exclusion. Actual helper checks cover lock exclusion, opt-in denial/success and credential/preference preservation using private loopback development fixtures.
- `PLAYWRIGHT_CHROME_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:desktop-appearance`: existing browser renderer checks, including disabled registration and explicit register/remove bridge calls. No actual service is installed by browser tests.
- `RUN_LAUNCHD_FIXTURE=1 npm run test:desktop-launchd`: macOS-only explicit native fixture. Creates a unique `com.netsentry.fixture.<uuid>` job from a private temporary plist outside LaunchAgents, runs only `/bin/sleep 30`, confirms running program/path, bootouts and verifies absence, then removes temporary files. This fixture passed on the development host; it does not exercise the packaged agent, Keychain, monitoring or login persistence.
- `TEST_AGENT_BINARY="$PWD/artifacts/netsentry-agent" npm run test:desktop-agent`: real local authenticated IPC regression against a temporary foreground development agent.
- Rebuild the unsigned arm64 preview with the matching agent; it must retain disabled production policy. This verifies packaging, not production trust.

Local results: repository `npm run check`, Go race tests, all 21 desktop lifecycle/update tests, Chromium renderer checks and authenticated agent IPC passed. The unsigned arm64 preview rebuilt successfully; packaged lifecycle modules and bundled agent matched the checked build byte for byte, and the public policy retained `enabled=false` with an empty signing team.

## Pending native acceptance

With a real Developer ID identity and signed/notarized build, test credential prompts/locked Keychain, user login and logout/reboot, workspace denial/revocation, offline login followed by explicit Start, module isolation, runtime exclusivity, crash/stale-socket recovery and removal while the agent is active. Verify the correct user's job disappears and unrelated jobs survive. Test cancellation and interrupted registration/removal, signed update refusal until removal and explicit registration afterward. Record actual running/monitoring outcomes separately; a loaded job or live process is insufficient evidence.

No Android Studio, mobile SDKs, Xcode, simulators or emulators were installed. The Flutter reference is unchanged.
