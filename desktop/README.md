# NetSentry Desktop

Electron main/preload with a React/TypeScript renderer and Vite. Phase 5 adds live local agent status, pairing-code exchange and local module/background preferences. It does not discover or stop servers and never starts or installs a background agent automatically.

The renderer has Node integration disabled, context isolation and sandboxing enabled, a restrictive CSP and navigation/window denial. Its typed bridge exposes runtime metadata plus four allowlisted calls. Only main verifies local file/socket ownership/permissions, invokes the fixed agent credential helper over inherited descriptor 3 and performs the mutual HMAC handshake. The backend agent credential never enters Electron; the local secret never enters the renderer, process arguments or stdout. Frames are bounded to 64 KiB and one request per authenticated connection.

With prepared dependencies:

```sh
npm run typecheck
npm run build
npm run dev:renderer
```

`dev:renderer` serves an ordinary browser on 127.0.0.1:5173; bridging is unavailable there. `npm start` loads built files and needs an existing Electron runtime. Use `npm ci --ignore-scripts` when preparing source dependencies to avoid automatic binary downloads. No Electron runtime or mobile tooling is installed by these build/test commands.

Build and initialize the agent separately using [its README](../agent/README.md), then run it in the foreground. Development-only Electron main environment overrides are `NETSENTRY_AGENT_BINARY` (absolute path to your built executable) and optional `NETSENTRY_AGENT_STATE_DIR` (private directory). Packaged builds ignore overrides and resolve the executable at `resources/agent/netsentry-agent`, with state under the user's application-data `NetSentry/agent` directory. The current repository does not produce a signed installer or bundle that binary automatically.

The UI shows the installation UUID needed to issue a workspace-bound enrolment code through the backend API. Paste the single-use code, then enable the desired local preferences. Pairing and module eligibility do not grant process-control authority. Backend online status proves a recent heartbeat only; collectors and remote controls remain unavailable. Background preference is separate from a registered service and requires workspace allowance as well.

Cross-language integration check after building both source projects:

```sh
TEST_AGENT_BINARY=/absolute/path/to/netsentry-agent npm run test:agent
```

This starts a temporary foreground Go process with explicit loopback-only development credential files. It verifies actual socket authentication, shared HMAC vectors, status, module isolation, persistent preferences, wrong-secret denial, unsafe permissions/symlink denial, and exclusive startup. It does not launch Electron or use native Keychain. Native Electron/Keychain runtime acceptance remains pending; the initial target is macOS. Windows named-pipe/private ACL operation is explicitly unavailable. See [Phase 5 validation](../docs/validation/phase-5.md) and the [distribution/service decision](../docs/architecture/agent-distribution.md).
