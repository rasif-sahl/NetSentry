# NetSentry repository instructions

- Work directly on `develop` unless the user requests another branch. Do not create `codex/` branches for this project.
- Keep changes in coherent feature commits with plain-language, human-readable messages. Push completed feature commits to `origin/develop` when the task authorizes coding and publishing.
- Do not install Android Studio, mobile SDKs, emulators, simulators or Xcode unless the user explicitly changes this constraint. Record native build/device checks as pending when tools are unavailable.
- Preserve `mobile/` as the existing Flutter reference until the native replacement is accepted. Standalone native apps live in root `android/` and `ios/`.
- Distinguish source implementation, verified builds, integration checks and physical-device validation. Never present fixtures as real monitoring data or capabilities as authorization.
- Read `DEVELOPMENT_PLAN.md` and relevant architecture decisions before changing a platform/domain. Follow more specific nested instructions, including `dashboard/AGENTS.md`.
