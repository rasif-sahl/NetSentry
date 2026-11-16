# Desktop Tailwind migration

The user requested Tailwind CSS for the Electron/React desktop interface after the Phase 16 theme increment. Work remains on `develop`.

## Change

Desktop now pins Tailwind CSS and its PostCSS adapter to 4.3.3, with PostCSS 8.5.23, independently of the dashboard dependency tree. Vite compiles the local PostCSS configuration into bundled CSS. Installation used `--ignore-scripts`; no Electron runtime or mobile tooling was downloaded by dependency scripts.

Renderer layouts, sections, project/service cards, action groups, confirmation dialogs and button variants now use Tailwind utilities. Shared typography/forms/focus defaults use Tailwind `@apply` in the base layer. Explicit renderer-only `@source` scanning avoids pulling fixtures or other applications into the stylesheet. `@theme inline` maps utilities to existing runtime light/dark tokens, including distinct primary/danger text colors. Light, dark, system mode, persistence and reduced-motion handling remain available.

No CDN, remote stylesheet/font, runtime Tailwind compiler or additional inline-style CSP permission is added. Main/preload IPC, consent checks, process control, email delivery and native apps are unchanged. Flutter remains preserved.

## Verification

- Desktop TypeScript/main compilation and Vite production build pass. The emitted local CSS contains the generated Tailwind layouts and theme colors; source directives are processed at build time.
- Existing Chrome renderer checks pass OS theme changes, explicit overrides, reload persistence, cross-window synchronization and blocked-storage fallback.
- Extended synthetic paired-agent UI checks pass 360px and desktop layout without horizontal overflow, long project labels, actual light/dark dialog backgrounds and danger colors, graceful/force confirmation opening/cancellation, Escape and visible keyboard focus. No stop callback is submitted. Fixtures are renderer-only data, not monitoring or native process evidence.
- The renderer screenshot was visually inspected for spacing, cards, controls and long-label wrapping. It contains synthetic data only.
- Existing desktop/Go authenticated IPC integration passes after rebuilding. No agent/main/preload behavior was changed.
- Hosted foundation CI remains the full regression check, including renderer-browser verification in the dashboard job.

No Android Studio, mobile SDK, Xcode, simulator or emulator was installed. Actual Electron runtime, Keychain, packaging/signing and physical-device acceptance remain the separate pending Phase 15 gates.

Build configuration follows [Tailwind's PostCSS setup](https://tailwindcss.com/docs/installation/using-postcss) and [theme variable guidance](https://tailwindcss.com/docs/theme). Keep static utility strings in renderer TSX so the explicit source scan can discover them.
