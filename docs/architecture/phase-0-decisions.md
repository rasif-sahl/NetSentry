# Phase 0 platform decisions

## Repository organization

Keep `backend/` and `dashboard/` in their existing locations. Add root `android/`, `ios/`, `desktop/`, `agent/`, `contracts/`, `docs/` and `infra/`. Preserve `mobile/` without edits until the Kotlin replacement is accepted. Do not create empty feature folders for unimplemented future domains.

Each application owns its build configuration and dependencies. Shared language-neutral schemas/fixtures live in `contracts/`; platform-specific UI, collectors and credential handling stay in their applications. Generated dependencies/build output are ignored, while source configuration and JavaScript lockfiles are committed.

## Android

Choose Kotlin with Jetpack Compose. It keeps the UI native and places permission/usage/background integrations directly beside Android source without a Flutter bridge. Initial application ID and namespace: `com.netsentry.app`. Initial minimum: API 26. Compile/target API: 35. Use JDK 17, AGP 8.9.2, Gradle 8.11.1, Kotlin/Compose compiler 2.1.20, activity-compose 1.10.1 and Compose BOM 2025.04.01 as a pinned initial baseline.

The baseline is source configuration, not a current app-store support guarantee. Reassess target API and supported dependency versions before distribution. No SDK, IDE, Gradle distribution/wrapper binary, dependency cache or emulator is provisioned. Build, permission and real-device behavior are pending. Plan a development ID suffix before installing alongside the Flutter reference with the same Android application ID.

References: [AGP compatibility](https://developer.android.com/build/releases/agp-8-9-0-release-notes), [Compose compiler setup](https://developer.android.com/develop/ui/compose/compiler), [Compose BOM](https://developer.android.com/develop/ui/compose/bom).

## iOS

Choose Swift with SwiftUI. Initial bundle ID: `com.netsentry.app`; deployment target: iOS 17; Swift language mode: 5. The project includes a shared scheme targeted at physical iPhone/iPad builds. The project has no development team or entitlement claims. Family Controls, Device Activity, Managed Settings, push registration and privacy workflows arrive in their planned phases.

Only project/plist structure is locally checked. An existing Command Line Tools installation does not provide a complete iOS build/signing environment. No Xcode, simulator or iOS SDK is installed during this phase.

Reference: [SwiftUI application entry point](https://developer.apple.com/documentation/swiftui/app).

## Desktop

Choose Electron for the React/TypeScript desktop shell and Vite for the renderer build. This keeps the existing JavaScript toolchain and avoids adding a separate Rust runtime/toolchain requirement. The initial acceptance target is the current macOS development host, not a claim that every macOS/Windows/Linux version is supported.

Pin Electron 45.3.2 and Vite 8.3.8. Keep React/React DOM 19.3.0 consistent with the existing dashboard and use TypeScript 5.9.3. Main/preload code is TypeScript; a sandboxed CommonJS preload exposes read-only metadata. Node integration is disabled and context isolation, sandboxing and web security remain enabled. Navigation/new windows/webviews/permission requests are denied. Do not expose raw filesystem, shell or process APIs to the renderer.

There is no authenticated agent IPC yet. Define the protocol in Phase 1 before implementing privileged actions. The Electron binary is not installed during dependency preparation because install scripts are disabled. Packaging/signing, OS support matrix, local IPC and update distribution remain future work.

Reference: [Electron security recommendations](https://www.electronjs.org/docs/latest/tutorial/security).

## Go agent

Use one Go module with independent network/developer packages. The scaffold requires Go 1.23+ and uses only its standard library. Disable automatic toolchain downloads via `GOTOOLCHAIN=local` in documented commands. No Go executable was available during initial setup, so Go build/run checks are pending; Go has not been installed.

The executable currently reports both modules unavailable and exits. It opens no ports, does no discovery, and performs no service control. Future identity, heartbeat, pairing and outbound command delivery belong to the shared core; enabling network monitoring never enables process-control permission.

## Backend, web and infrastructure

Retain NestJS/PostgreSQL/TypeORM and Next.js/React/Tailwind rather than regenerating working projects. Phase 0 introduces no production API changes, migrations, cloud resources, databases, containers or background services. Root scripts provide entry points using available tools. Phase 1 will define complete API contracts, configuration/secret management, database migrations and deployment requirements.
