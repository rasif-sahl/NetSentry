# Cross-platform formatting audit

17 November 2026. Formatting was checked against the repository's EditorConfig and each language's formatter. Existing behavior and API/IPC boundaries are unchanged; native build/device acceptance is not established by formatting checks.

| Area | Check | Result |
| --- | --- | --- |
| Web, desktop, backend, contracts and source/config tooling | Prettier with nearest project configuration and EditorConfig | 351 files pass |
| Standalone Android source, tests and Gradle Kotlin | ktfmt 0.54, Kotlin language style, four spaces; unused-import removal disabled | 28 files pass |
| Standalone iOS app, extensions and tests | Existing swift-format, four spaces, 100-column configuration | 28 files pass strict lint |
| Go agent | Existing gofmt | 56 files pass; no edits needed |
| Flutter reference | Existing Dart formatter, read-only | 11 files pass; reference tree unchanged |
| Python generation scripts | Existing Black 25.11.0 | 2 files pass |
| Shell scripts | Bash syntax and trailing-whitespace/final-newline checks | 2 files pass; no shfmt claim |

The initial audit found 65 Prettier-managed files needing formatting, compressed Kotlin/Swift declarations and two Python scripts needing standard formatting. Source indentation, statement wrapping and whitespace were normalized. Swift rules that could change declaration access levels, replace loops or synthesize initializers are disabled. The new Python EditorConfig override follows Black's four-space indentation. Generated project/scheme files and the bundled mobile HTML catalogue were regenerated from their formatted source generators. Lockfiles, wire fixtures and the preserved Flutter tree were not rewritten.

## Repeatable checks

`npm run format:check` and `npm run format:write` use existing tools only and never download or install SDKs, formatters or runtimes. The write command still treats Flutter as read-only. Missing language tools are reported explicitly and produce exit code 2 rather than being counted as passing checks. Failures produce exit code 1.

Prepare the existing backend dev dependencies for Prettier. Configure installed native formatters explicitly when they are not on PATH:

```sh
JAVA_HOME=/path/to/existing/jdk17 \
KTFMT_JAR=/path/to/ktfmt-0.54-jar-with-dependencies.jar \
GOFMT=/path/to/existing/gofmt \
DART=/path/to/existing/dart-sdk/bin/dart \
npm run format:check
```

`KTFMT` may alternatively name an existing ktfmt executable. `SWIFT_FORMAT` and `PYTHON` select existing tool paths. On macOS the script can discover swift-format in an existing Command Line Tools installation. Black is invoked through Python. The standalone ktfmt jar used in this audit came from Maven Central's `com.facebook:ktfmt:0.54` release and was kept in a temporary tooling directory, not installed into the project or system. No Android Studio, SDK, emulator, simulator or Xcode was installed.

## Validation after formatting

- A repeat formatting check passes for every area above without further edits.
- `npm run check` passes: scaffold/release/infra checks, contracts, Android fixture checks, Swift source/project checks, backend build/unit tests, desktop build/tests and dashboard lint/build.
- `npm run test:android-core` passes repository/policy, detailed reducer, family synchronization and wire checks, and parses all 20 Android Kotlin source files using the existing standalone compiler bundle. Missing temporary compiler support libraries were restored from the already-present compiler archive; no Android tools were provisioned.
- `npm run test:ios-core` passes portable Swift repository/Keychain host and emitted contract checks.
- `git diff --check` passes.

Native Android/Compose and iOS/SwiftUI compilation, platform rendering and physical-device validation remain pending. This audit does not claim native visual or device acceptance. Database/API/live-device checks were not rerun for a formatting-only change.
