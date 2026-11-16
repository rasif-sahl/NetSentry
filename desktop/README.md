# NetSentry Desktop

Electron main/preload with a React/TypeScript renderer and Vite. Phase 5 adds live local agent status, pairing-code exchange and local module/background preferences. Phase 6 adds supported macOS local discovery/project grouping and separately confirmed graceful/force shutdown. It never starts or installs a background agent automatically.

The renderer has Node integration disabled, context isolation and sandboxing enabled, a restrictive CSP and navigation/window denial. Its typed bridge exposes runtime metadata plus allowlisted setup and developer calls. Only main verifies local file/socket ownership/permissions, invokes the fixed agent credential helper over inherited descriptor 3 and performs the mutual HMAC handshake. The backend agent credential never enters Electron; the local secret never enters the renderer, process arguments or stdout. Frames are bounded to 64 KiB and one request per authenticated connection.

With prepared dependencies:

```sh
npm run typecheck
npm run build
npm run dev:renderer
```

`dev:renderer` serves an ordinary browser on 127.0.0.1:5173; bridging is unavailable there. `npm start` loads built files and needs an existing Electron runtime. Use `npm ci --ignore-scripts` when preparing source dependencies to avoid automatic binary downloads. No Electron runtime or mobile tooling is installed by these build/test commands.

Build and initialize the agent separately using [its README](../agent/README.md), then run it in the foreground. Development-only Electron main environment overrides are `NETSENTRY_AGENT_BINARY` (absolute path to your built executable) and optional `NETSENTRY_AGENT_STATE_DIR` (private directory). Packaged builds ignore overrides and resolve the executable at `resources/agent/netsentry-agent`, with state under the user's application-data `NetSentry/agent` directory. The packaging flow now bundles the matching binary and can prepare signed DMG/ZIP artifacts on a configured signing host. The current unsigned preview blocks bundled-agent execution and production updates. See [packaging and update instructions](packaging/README.md).

The UI shows the installation UUID needed to issue a workspace-bound enrolment code through the backend API. Paste the single-use code, then enable the desired local preferences. Pairing and module eligibility do not grant process-control authority. Backend online status proves a recent heartbeat only. Network collectors remain unavailable; macOS service eligibility is reported separately by v3 inventory. Phase 7 remote consent uses v4 and additionally requires explicit backend controller grants. Background preference is separate from a registered service and requires workspace allowance as well.

Cross-language integration check after building both source projects:

```sh
TEST_AGENT_BINARY=/absolute/path/to/netsentry-agent npm run test:agent
```

This starts a temporary foreground Go process with explicit loopback-only development credential files. It verifies actual socket authentication, shared HMAC vectors, status, module isolation, persistent preferences, wrong-secret denial, unsafe permissions/symlink denial, and exclusive startup. It does not launch Electron or use native Keychain. Native Electron/Keychain runtime acceptance remains pending; the initial target is macOS. Windows named-pipe/private ACL operation is explicitly unavailable. See [Phase 5 validation](../docs/validation/phase-5.md) and the [distribution/service decision](../docs/architecture/agent-distribution.md).

## Phase 6 service workflow

After pairing and enabling Developer Tools locally and in the workspace, refresh services. Review runtime/executable, PID/parent, listeners, start/duration, project evidence and fifteen-second freshness. Correct a project/group label locally, search the inventory and inspect paginated groups. Enable local shutdown separately; it is off by default and grants no remote/mobile access. Confirm graceful stop or separate force-stop; optionally include the captured descendants after reviewing the count. Expired observations disable action buttons and require a refresh.

Results distinguish still running, identity/tree changes, denied/unknown/partial outcomes, original exit and observed replacement listeners. The latter may indicate a supervisor or port reuse; no automatic follow-up kill occurs. Load action history before retrying a lost response. Revocation/disabled authorization clears visible service data; backend outages deny fresh access/actions.

`TEST_AGENT_BINARY=/absolute/path/to/netsentry-agent npm run test:developer` validates actual authenticated Go IPC, all v3 wire responses, native controlled samples on macOS and fail-closed platform behavior elsewhere. The backend is an explicit loopback fixture. Existing desktop Chrome fixture checks separately cover UI/dialogs; native Electron/Keychain packaging acceptance remains pending. See [Phase 6 verification](../docs/validation/phase-6.md).

## Phase 7 sharing and remote consent

Paired Developer Tools exposes independent summary-sharing and remote-shutdown choices, initially off. Read and accept the disclosure before enabling; disabling sharing clears control. Workspace/controller grants are managed in the web dashboard and are required separately. No background service is installed. See [remote architecture](../docs/architecture/remote-service-commands.md) and [verification](../docs/validation/phase-7.md).

Phase 10 adds Network observation sharing with a named network UUID and separate `network-sharing-v1` acceptance. The web dashboard must grant the same installation/network; enabling a module alone is insufficient. Authenticated local IPC v5 exposes only get/set network preferences. Developer control remains independently gated. Renderer builds and Node-Go IPC fixtures are checked; packaged Electron/real-host collection remains pending.

Phase 15 provides [packaged desktop and cross-network phone acceptance steps](../docs/release/desktop-and-remote-testing.md). Existing renderer/Go checks do not establish Electron/Keychain, installers, signatures or phone acceptance. Distribution/update gates stay pending until an actual candidate passes.

Phase 16 adds local SYSTEM/LIGHT/DARK appearance, OS/cross-window updates and blocked-storage fallback. The subsequent Tailwind migration uses Tailwind CSS 4 for desktop layout and controls. `npm run test:desktop-appearance` uses the existing dashboard Playwright/Chromium installation against the built renderer; it does not launch Electron or an agent.

## Desktop Tailwind styling

The desktop renderer compiles Tailwind CSS 4.3.3 through `postcss.config.mjs` with pinned PostCSS 8.5.23. `styles.css` explicitly scans renderer TSX, maps runtime colors with `@theme inline` and uses Tailwind base rules for shared form/typography defaults. Components use utilities for responsive layouts, cards, actions, focus and dialogs. `theme.css` contains runtime light/dark tokens. CSS is bundled locally by Vite; no CDN, remote fonts, inline style permission or runtime compiler is added.

Build with `npm run build:desktop`; verify appearance with the existing Chromium setup via `npm run test:desktop-appearance`. Browser agent data is synthetic and no stop action is submitted. Native Electron/Keychain/signing/device acceptance remains pending. See [migration evidence](../docs/validation/desktop-tailwind.md).
