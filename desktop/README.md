# NetSentry Desktop

React and TypeScript renderer, Vite build and an Electron main/preload shell. The Go agent remains a separate process; no agent IPC or system control is exposed in Phase 0.

The renderer has Node integration disabled, context isolation/sandboxing enabled, a content security policy, no window-opening/navigation permissions, and a read-only runtime metadata bridge. The source follows [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

From this directory, with prepared desktop dependencies:

```sh
npm run typecheck
npm run build
npm run dev:renderer
```

`dev:renderer` serves the UI on `127.0.0.1:5173` in an ordinary browser; native bridging is unavailable there. `npm start` loads the built local files in Electron and requires the Electron binary. Dependency preparation uses `npm ci --ignore-scripts` to avoid automatic binary/tool installation. The Electron binary is not downloaded by that command. A later explicit `npm rebuild electron` downloads the desktop runtime; it is not a mobile SDK.

No fake device count or stop action is shown. Packaging, signing, local authenticated agent IPC, pairing and a persistent service belong to subsequent phases. Initial desktop acceptance will target the current macOS development host; other supported versions/platforms require testing. There is no automatic login/background installation.
