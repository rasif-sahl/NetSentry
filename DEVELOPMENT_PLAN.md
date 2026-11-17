# NetSentry development plan

Updated: 17 November 2026

NetSentry will provide personal device and network monitoring, family digital wellbeing and supported parental controls, business network management, and developer service monitoring across desktop and mobile. Features depend on verified operating-system, device, permission, agent, and router capabilities.

This plan combines the complete feature catalogue with the agreed native mobile stack, a modular Go agent, and desktop developer tools. Email sorting is deferred. The feature catalogue describes the full product scope; the release milestones define when each part becomes available. Inclusion in this plan does not mean a feature is already implemented.

## Development environment and validation constraints

Do not install Android Studio, Android emulators, iOS simulators, or other mobile IDE/platform tooling during this development stage. Do not install Android SDK components, Xcode, or related platform build dependencies without a later explicit request. Existing tools may be inspected and used where available without provisioning mobile runtimes. No mobile platform installation is needed to begin backend, web, Go agent, desktop interface, API contract, or native source work.

Develop Kotlin Android and Swift/SwiftUI source against versioned contracts and platform interfaces. Run backend/web/agent checks with available tooling. Native builds and platform-specific checks are conditional on existing compatible build tools; if those tools are absent, record the checks as pending. Do not describe uncompiled native source as build-verified. Physical-device tests will be performed by the user later; no emulator or simulator is required by this plan.

Use separate progress states: source implemented, build verified, integration verified, and physical-device/hardware verified. A phase may proceed with documented pending hardware checks, but the affected mobile or router feature is not release-ready until those checks pass. Test fixtures validate contracts and behavior without pretending to be real monitoring data. Permission/background behavior, usage measurement accuracy, push delivery, battery behavior, and policy enforcement require real-device validation. Reserve follow-up work for findings from those tests.

Real Android packaging still requires compatible Android build tools, and iOS device distribution requires compatible Apple build/signing tools. Installation or a remote build environment can be arranged when explicitly requested for device testing. This plan does not provision either environment, create paid services, or assume signing credentials are already available.

## Native mobile navigation update

Android and iOS source now use Home, Usage, Family, Computers and More bottom tabs, with scoped submenus and Back behavior. Android has 21 submenu destinations; iOS has 20. The offline design catalogue includes the five tab landing pages for each platform and existing detail/state previews. See [navigation architecture and checks](docs/architecture/mobile-navigation.md). Available host checks and browser design checks remain separate from pending native builds and physical-device navigation/accessibility acceptance.

Android design source now applies the approved lavender light/dark theme, shared cards/fields, page headers, submenu rows and floating selected-tab dock across its native screens. See [Android UI verification](docs/validation/android-designs.md); native compilation and device screenshot parity remain pending.

iOS design source now applies the approved white grouped forms, blue controls, shared page/menu styling and rounded floating material dock across its native pages and nested confirmation forms. See [iOS UI verification](docs/validation/ios-designs.md); native compilation and device screenshot parity remain pending.

Desktop source now implements the approved floating sidebar with five groups and 14 focused pages, service review details, separate control/history/settings views and route-independent appearance. See [desktop navigation verification](docs/validation/desktop-navigation.md). Renderer build/browser checks are distinct from pending packaged Electron, Keychain and real-agent acceptance.

## Public product homepage

The approved public homepage now lives at `/` in the existing Next.js/Tailwind web project. The workspace is accessible at `/app`; existing verification/reset URLs and query-based workspace bookmarks are preserved. The page showcases web, Android/iOS and desktop UI previews in a simple, upright storytelling layout, with explicit availability and consent information. See [public website architecture](docs/architecture/public-website.md) and [homepage validation](docs/validation/public-homepage.md). Other proposed public content pages and production hosting are outside this increment.

## Agreed technologies

| Component | Technology | Responsibility |
| --- | --- | --- |
| Android application | Kotlin, Jetpack Compose and native Android APIs | Registration, permissions, monitoring, reports, alerts, family workflows, and desktop service controls |
| iOS application | Swift and SwiftUI with native Apple frameworks | Registration, reports, alerts, mobile desktop controls, and approved Family Controls capabilities |
| Responsive web dashboard | TypeScript, React, Next.js, Tailwind CSS | Personal, Family, Business, reporting, administration, and developer views |
| Desktop interface | Electron, React, TypeScript and Tailwind CSS 4 with Vite | Pairing, capabilities, project/service inventory, monitoring settings, local controls, and action history |
| Backend | TypeScript and NestJS | Authentication, workspaces, enrolment, ingestion, reporting, policies, alerts, subscriptions, audit records, and command routing |
| Database | PostgreSQL with TypeORM and versioned migrations | Application records, measurements, aggregates, commands, and retention policies |
| Shared agent foundation | Go | Device identity, secure backend connection, enrolment, heartbeat, local buffering, updates, and diagnostics |
| Agent Network Monitoring module | Go with supported router adapters | Network discovery, inventory, presence, health, and supported traffic measurements |
| Agent Developer Tools module | Go with platform-specific process adapters | Local service discovery, project association, authorized stop actions, and outcome verification |

Phase 0 selects Electron for the desktop shell, Vite for its renderer build, and Jetpack Compose for the Kotlin Android interface. The Go agent remains separate from the desktop renderer. Initial identifiers and pinned scaffold versions are recorded in `docs/architecture/phase-0-decisions.md`. Installer signing/update distribution, authenticated local IPC, backend job infrastructure, push delivery providers, billing provider and deployment hosting remain later decisions.

The existing Flutter application will be replaced by native applications. Flutter and Dart are not part of the target mobile stack. WebGL is optional only if advanced visualization later needs it; Jira integration and JQL are not committed scope. COBOL, Fortran, OCaml, mainframe tooling, and Verse are not planned dependencies.

## Existing implementation and migration

The repository currently contains a NestJS/PostgreSQL backend, a Next.js/React/Tailwind dashboard, and a Flutter mobile application with a Kotlin capability bridge. The backend implements authentication/session foundations, workspace creation/listing, membership records, and device registration/listing. The dashboard used preview data at the planning baseline; Phase 4 replaces those values with API-backed workflows and explicit unavailable states. Mobile connects to authentication and checks Android capabilities; it does not complete backend device registration. Native mobile applications, desktop applications, Go agents, verified monitoring pipelines, billing, and policy enforcement still need implementation.

Migration work:

1. Preserve current Flutter code as a reference while defining native Android and iOS project locations. Do not overwrite the Flutter project in place.
2. Define shared, versioned API contracts for native apps, web, desktop, and agents, including authentication, capabilities, measurements, and errors.
3. Port account flows, secure credential storage, session restoration, logout, profile display, and capability checks to Kotlin. Validate migration of existing API behavior before retiring Flutter.
4. Build the SwiftUI client against the same contracts. Share schemas and behavior specifications across clients, not Flutter UI or platform-specific collectors.
5. Preserve backend records through versioned migrations; add invitation and permission flows rather than treating existing role enums as complete authorization.
6. Replace dashboard preview values with measured results or explicit empty/unavailable states. The current security score and protection wording must not imply verified protection.
7. Retire Flutter after the Android replacement meets its acceptance criteria; update repository instructions and build automation at that point.

## Shared agent architecture

Use one Go foundation with two independently enabled modules. Install Network Monitoring alone on a supported always-on host, Developer Tools alone on a developer computer, or both on the same computer. An agent on one computer does not gain process-control access to another computer by discovering it on the network.

| Shared foundation | Network Monitoring | Developer Tools |
| --- | --- | --- |
| Enrolment and revocable identity | Gateway and subnet discovery | Local processes and listening ports |
| Workspace/device association | Network device discovery and presence | Project detection and manual association |
| Authenticated outbound backend connection | Supported router authentication and adapters | Graceful stop and explicit force-stop |
| Heartbeats and capability reports | Router/network/agent health | Process identity and command validation |
| Bounded offline buffering and synchronization | Supported traffic measurements | Service lifecycle and stop results |
| Updates, diagnostics, and audit events | Network compatibility reports | Platform-specific process control |

The desktop interface communicates with the local agent through authenticated local IPC selected with the desktop runtime. Closing the interface may leave the agent running if background operation is enabled. Users can independently disable either module. Network enrolment never implicitly grants desktop process-control permission.

A network-only deployment may use a supported dedicated host, such as a small always-on computer. Embedded router execution is not assumed. If several agents observe one network, identify the network consistently, record observation sources, and avoid counting duplicated observations as additional devices or usage.

### Mobile service stop workflow

1. A signed-in user selects a paired computer and a discovered service from Android, or from iOS after that client is released.
2. The backend checks current workspace membership, explicit control permission, device pairing, and the target agent capability.
3. The backend creates an expiring command with an immutable target identity, requester, request identifier, and audit record.
4. The agent receives it over its authenticated outbound connection. Users do not need to expose an inbound desktop control port to the internet.
5. The agent verifies authorization, freshness, duplicate execution state, and the target process identity before attempting shutdown.
6. The agent attempts graceful shutdown; force-stop is a separate explicit action. It reports and verifies the outcome.
7. The backend updates command state and clients display the confirmed result.

Command states: pending, accepted, succeeded, failed, expired, and cancelled. A delivery acknowledgement is not a successful shutdown. Expired commands cannot run after reconnection. If the target exits, changes identity, or is replaced by another process, return an explicit no-longer-running or target-changed outcome. Reusing a process ID or port must not redirect an old request to a different service.

If a service supervisor restarts the process, report that behavior rather than claiming a lasting stop. A sleeping/offline computer cannot execute an immediate command. Do not add wake-on-LAN, arbitrary shell execution, or broad operating-system administration to the initial release.

## Data and API foundations

Define contracts and migration boundaries before each domain is implemented. Do not create every future table before its release needs it.

| Domain | Main records and responsibilities |
| --- | --- |
| Accounts and access | Users, profiles, sessions, email verification, recovery, workspace invitations, memberships, role permissions, and consent |
| Devices and agents | Registered devices, installations, ownership/enrolment records, capabilities, credentials, module settings, heartbeats, and health |
| Measurements | Timestamped observations, source, units, collection interval, device/network/app references, quality, gaps, and optional estimate classification |
| Applications | Package identifiers, display metadata, categories, confidence, corrections, and catalogue versions |
| Networks and routers | Networks, collectors, discovery observations, inventory, compatibility records, adapters, firmware, and credential references |
| Developer services | Agent-scoped service identities, process observations, projects, associations, command requests, acknowledgements, outcomes, and action history |
| Family and policies | Family profiles, guardians, assignments, consent, schedules, policy versions, enforcement capabilities/results, and override requests |
| Business | Organizations, locations, departments, employee lifecycle, assignments, compliance, and alert ownership |
| Operations and billing | Alerts, delivery attempts, audit events, exports, retention jobs, subscriptions, entitlements, usage counters, and payment-provider references |

Use UTC event timestamps and explicit workspace/reporting timezones. Preserve collection time separately from ingestion time. Make ingestion idempotent, record missing periods, and avoid double-counting overlapping sources. An enrolment record represents a monitoring installation; a discovered network device represents an observed endpoint. Do not automatically merge them solely because an IP address matches.

All clients need workspace-scoped authorization and structured errors. Store user/agent credentials securely, redact secrets in diagnostics and process arguments, and avoid uploading full local paths or command lines when less information is sufficient. Keep router secrets separately protected. Enforce revocation on subsequent requests and command execution.

The capability contract must include status, reason, source, required permission/setup, last check time, and supported actions. Monitoring availability, policy enforcement availability, and remote-control permission are separate properties. Show unavailable features with explanations; expose active measurements/actions only when their capabilities permit them.

## Implementation phases

These phases define the working order. The product release groupings below remain scope boundaries, not a requirement to finish mobile device testing before independent backend/desktop development can proceed. Developer Tools can be built before native clients are validated: its API and web/desktop workflow are verified first, and phone control is verified later on physical devices. No calendar estimates are committed until the foundation inventory and technical decisions are complete.

| Phase | Main result | Catalogue coverage |
| --- | --- | --- |
| 0 | Repository layout, platform decisions and project scaffolds | All domains and migration |
| 1 | Architecture, contracts, database and project foundation | 1–3, 20, 23–24, 26 foundations |
| 2 | Accounts, workspaces, permissions and consent | 1–2, 20, 23 |
| 3 | Measurement, synchronization, reports and alert infrastructure | 3, 7–8, 23–24 |
| 4 | Live responsive web application | 22 and views for available domains |
| 5 | Shared Go agent foundation | 9, 23–24, 26 foundations |
| 6 | Desktop discovery, project mapping and local shutdown | 26 |
| 7 | Remote commands, permissions and confirmed outcomes | 20, 23, 26 |
| 8 | Kotlin Android personal monitoring source | 1–4, 7–8, 22–23, 26 mobile controls |
| 9 | Advanced Android usage, categories and reporting | 5–8, 17 baseline |
| 10 | Network discovery, routers, inventory and security | 9–13 |
| 11 | Family profiles, policies and deterministic insights | 14–15, 17, 20 |
| 12 | SwiftUI iOS source and authorized Family Controls | 1–3, 7–8, 16, 23, 26 mobile controls |
| 13 | Business organizations and permissions | 19–20, Business parts of 11 and 13 |
| 14 | Billing and complete platform operations | 21, 24 and cross-domain completion |
| 15 | Physical-device validation, corrections and release | All delivered domains |
| 16 | Optional extensions after core validation | 18 and explicitly later scope |

### Phase 0 Repository and platform setup

Set up the repository and source projects before feature development. Platform setup means project structure, configuration and starter source; it does not authorize installing mobile SDKs, IDEs, emulators or simulators.

First inventory existing code, dependencies, tests, available tools and uncommitted work. Preserve the existing backend and dashboard locations to avoid unnecessary path changes. Keep the Flutter application intact as a migration reference.

Target top-level layout:

```text
NetSentry/
  backend/             Existing NestJS API and PostgreSQL migrations
  dashboard/           Existing Next.js React web dashboard
  android/             New standalone Kotlin Android application
  ios/                 New standalone Swift and SwiftUI application
  desktop/             React and TypeScript desktop interface and runtime integration
  agent/               Shared Go core with network and developer modules
  contracts/           Versioned API schemas, event schemas and shared fixtures
  docs/                Architecture decisions, setup and validation instructions
  infra/               Deployment and local service configuration as needed
  mobile/              Existing Flutter application retained during migration
  DEVELOPMENT_PLAN.md
```

The new root `android/` and `ios/` projects are independent of the Flutter-owned `mobile/android/` and `mobile/ios/` directories. Leave business feature folders to the phase that implements them rather than creating empty scaffolds for the whole catalogue.

Platform decisions and project setup:

- Confirm application identifiers, project naming and initial target OS versions.
- Use Jetpack Compose and Electron/Vite as recorded in the Phase 0 architecture decisions. Kotlin, SwiftUI, React/TypeScript and Go remain fixed choices.
- Establish standalone Android source/build configuration and SwiftUI source/project configuration without using IDE generators that require new installations. Record any incomplete project-generation or compilation checks explicitly.
- Scaffold the desktop interface and Go module entry points; keep the two agent modules independently enabled.
- Keep the existing backend/dashboard frameworks, and establish common formatting, environment examples, ignore rules, run/build instructions and available checks.
- Add a root setup guide identifying each component, its prerequisites, its verification status and the current no-install constraint.
- Establish the implementation backlog from all 26 catalogue sections, with dependencies and separate source/build/integration/hardware status.

Completion: each planned component has a documented location, platform choice and scaffold status; available non-mobile checks pass. Missing native tools do not trigger installation and do not block independent components. Uncompiled native scaffolds are marked pending verification. No mobile IDE/platform installation or relocation/deletion of existing applications is performed.

### Phase 1 Architecture and project foundation

Status: architecture and contract foundations implemented, with local and hosted foundation checks passed. See `docs/validation/phase-1.md` for exact verification and deferred hardware/native work.

- Establish API schemas, structured errors, versioning, identifiers, event timezones, and shared fixtures.
- Define capability statuses/reasons and distinguish monitoring, enforcement, and control rights.
- Add PostgreSQL migrations, development/test configuration, and repeatable checks using available tools.
- Define shared Go core/module boundaries, authenticated local IPC, and desktop packaging requirements.
- Use the desktop runtime, Android UI toolkit and initial platform targets recorded in Phase 0; refine authenticated IPC and packaging contracts.
- Design retention/deletion and audit boundaries, secret storage, deployment topology, and observability.
- Assess mobile permission, background, iOS entitlement, and router feasibility from source/documentation without installing mobile tools.

Completion: architecture decisions and contracts are recorded, applicable foundation checks pass, and unsupported or unverified platform assumptions are listed.

### Phase 2 Accounts and access

Status: backend APIs, migrations and access/privacy rules implemented. See `docs/validation/phase-2.md` for local/hosted checks and configured SMTP/client/device prerequisites. No mobile tooling is installed.

- Complete registration, verification, recovery, login/logout, refresh, session listing/revocation, profile, notification preferences, and account deletion.
- Add workspace invitations/switching, membership lifecycle, and explicit report/device/network/control permissions.
- Implement device ownership/enrolment codes, rename/pause/remove/revoke/delete workflows, and installation metadata/health contracts.
- Add clear disclosure, consent and permission history, privacy exports, and deletion workflows before monitoring collection.
- Define Family/Business access boundaries now; implement their full profiles and workflows in later phases.

Completion: API integration tests cover recovery, session revocation, enrolment and deletion, workspace isolation, and separate device-view/control permission.

### Phase 3 Measurement and notification infrastructure

Status: backend infrastructure implemented and verified with synthetic integration fixtures. Native buffers/collectors, UI integration, deployment scheduling and physical push acceptance remain in their platform/deployment phases. See `docs/features/monitoring.md` and `docs/validation/phase-3.md`.

- Implement idempotent ingestion, offline batch synchronization, retry limits, source attribution, data-quality flags, missing intervals, and raw/aggregate retention.
- Add daily/weekly/monthly aggregation, comparison periods, report/export APIs, measurement-source indicators, and measured/estimated distinctions.
- Implement configurable thresholds, severity, quiet hours, device/network scope, alert acknowledgement, delivery attempts, and notification preferences.
- Deliver in-app notifications first; define Android/iOS delivery adapters and leave actual push verification pending physical devices.
- Add operational diagnostics for failed ingestion, aggregation, retention and alert delivery.

Completion: fixture-driven ingestion/report/alert integration checks pass, including duplicate batches, timezone boundaries, gaps, deletion, and failure recovery. Fixture data remains clearly identified as test data.

### Phase 4 Responsive web dashboard

Status: connected web workflows implemented and browser integration verified with synthetic data. Deployment/provider/native and broader accessibility/browser acceptance remain documented follow-ups. See `docs/features/dashboard.md` and `docs/validation/phase-4.md`.

- Connect real authentication, workspace switching, devices, usage, reports, alerts, profile, privacy and settings to the API.
- Implement accessible mobile/tablet/desktop navigation and loading, empty, error, permission and unsupported states.
- Replace hardcoded metrics/protection claims; show unavailable data truthfully.
- Establish shared UI patterns for Networks, Family, Policies, Organizations, Locations, Team, Audit, Subscription and Developer Tools; connect each as its backend domain arrives.
- Add live updates and observation freshness indicators where available.

Completion: browser-based end-to-end flows pass for implemented domains; future modules are identified clearly rather than shown as working features.

### Phase 5 Shared Go agent

Status: shared core, backend agent identity and authenticated desktop IPC implemented and development-process integration verified. See `docs/validation/phase-5.md` for platform/build/runtime distinctions and signing/service/native acceptance gates. No collectors, service-stop commands or persistent service were enabled.

- Implement enrolment/revocable identity, workspace association, authenticated outbound connection, heartbeats, capability reporting and diagnostics.
- Add bounded local buffering, synchronization/reconnect behavior, configuration and version reporting.
- Keep Network Monitoring and Developer Tools independently enabled and separately authorized.
- Implement authenticated local communication for the desktop interface and explicit background-operation settings.
- Define update/package verification and service installation; do not silently install a persistent host service during development.

Completion: exercise the core as a development process and verify pairing, revocation, connection loss/recovery, buffering and module isolation.

### Phase 6 Desktop discovery and local controls

Status: initial macOS native discovery/local shutdown and React desktop workflow implemented and integration-tested with controlled Node/Python services. See `docs/validation/phase-6.md` for build/runtime distinctions, platform limits and pending packaged/native acceptance. Remote commands remain Phase 7.

- Build the React/TypeScript desktop interface and selected desktop runtime integration.
- Discover local listening TCP services with process/runtime, port/address, duration and freshness information where available.
- Infer project associations, show uncertainty, allow manual correction, group services and add search/filtering.
- Stop a selected development service gracefully; provide a separate supported force-stop action.
- Verify target identity, handle child processes, explain denied permissions and supervised restart behavior, and retain local action history.

Completion: discover and stop controlled sample services while preserving unrelated processes. Test stale observations, PID/port reuse and process exits. macOS is the proposed first platform; Windows expands after the initial implementation is reliable.

### Phase 7 Remote service commands

Status: backend/outbound Go/macOS execution, desktop consent, web controls and shared native-mobile contracts implemented and integration-tested. See `docs/validation/phase-7.md`. Native phone UI, packaged desktop acceptance and wider operational soak remain pending. Optional long-running reminders are deferred until soak and notification design are complete.

- Add paired-computer inventory, service synchronization, explicit control permissions and remote-command APIs.
- Add expiring commands, audit records, duplicate protection, cancellation rules and accepted/succeeded/failed/expired states.
- Route requests over agent-initiated authenticated connections; verify process identity and current authorization at execution time.
- Display confirmed outcomes and offline/sleep/revoked/target-changed conditions in web/desktop.
- Define native mobile contracts for the same flow; do not label mobile control validated before a phone test.
- Add optional long-running-service reminders once discovery and commands are reliable.

Completion: an authorized web/API client stops a service through backend and agent across the intended connection boundary. Reconnection cannot execute expired commands. Android and iOS UI/device checks remain pending their respective phases and Phase 15.

### Phase 8 Native Kotlin Android personal application

Status: Kotlin/Compose personal-client source, OS aggregate adapters, encrypted bounded sync, remote-command UI/contracts and SDK-free JVM/API checks implemented. See `docs/validation/phase-8.md`. Android/Compose compilation, packaging and all physical-device checks remain pending; hotspot/client data stays unavailable on the API 35 baseline.

- Implement native project source, authentication, secure sessions, workspace selection, profile, privacy and notification settings.
- Implement enrolment, capability explanations, pause/revoke/delete, version/OS/model and monitoring-health reporting.
- Implement supported hotspot/tethering state and mobile/Wi-Fi usage collectors behind platform interfaces, with daily/weekly/monthly views, allowance tracking and data alerts.
- Implement paired desktop/project/service views and remote-stop requests with confirmed status.
- Provide permission and battery setup guidance, offline synchronization, API adapters and clearly unavailable conditional hotspot-client information.
- Prepare build/signing instructions and a physical-device checklist without installing Android Studio, SDK components or an emulator.

Completion during this stage: Kotlin source and contracts are implemented/reviewed, and any checks supported by existing tools are recorded. Compilation, packaging, permission behavior, monitoring accuracy, background collection and phone stop controls remain pending where tools/devices are unavailable.

### Phase 9 Advanced Android monitoring

Status: event reducer/OS adapter source, separate detailed consent, bounded synchronization, app/category reports and corrections, descriptive insights and missing-report alerts implemented with SDK-free Kotlin/API/database checks. See `docs/validation/phase-9.md`. Android compilation, event/count accuracy, native UI, battery and permission transitions remain pending physical-device acceptance. Counts are defined as observed foreground entries, not verified cold starts.

- Add screen time, app foreground duration, first/last use, reliable launch counts, daily/weekly/monthly totals, timelines and late-night usage.
- Add permitted app metadata/icons, classification/confidence, manual correction, custom categories and unknown-app handling.
- Implement per-app/device/category reports, comparisons, exports, trends and limit progress when policies exist.
- Add permission-revoked/not-reporting alerts and resilient offline/background synchronization.
- Introduce deterministic insight calculations with evidence and data-quality indicators.

Completion: source and backend report behavior pass available checks against representative fixtures. Android collectors, battery restrictions and permission transitions await real-device verification. Retain Flutter reference code until replacement behaviors are validated.

### Phase 10 Wi-Fi networks and router integrations

Status (16 November 2026): source implemented with backend/web/desktop builds, database/API contracts and Go/IPC integration checks. Named-network consent, passive macOS/Linux IPv4 observations, multi-agent inventory/history, encrypted credentials, a versioned read-only OpenWrt ubus protocol candidate, WAN counters/coverage and network event review are delivered. Actual router/model/firmware compatibility and accuracy remain unverified; no hardware is certified. Native mobile, Linux production secret storage/service packaging and Windows discovery remain pending. See [Phase 10 validation](docs/validation/phase-10.md) and [network architecture](docs/architecture/network-monitoring.md).

- Implement the Go Network Monitoring module: gateway/subnet discovery, network naming, device detection, multiple agents and compatibility tests.
- Build compatibility records for manufacturer/model/firmware, adapter versions, authentication, features, limitations, test dates and feedback.
- Add encrypted router credentials and connection tests for a small selected support matrix.
- Deliver device inventory/identity, trust, history, notes, archiving, category, network association and assignment hooks.
- Implement supported WAN/router/agent health, bandwidth totals/history, presence/events, availability and real-time dashboard views.
- Add security events, acknowledgement/severity, inventory changes and health/authentication alerts; Business assignment follows Phase 13.

Completion: adapter contracts and fixtures pass locally. Actual router compatibility and traffic accuracy require authorized hardware tests; unknown capabilities remain unavailable. Discovery support alone is not bandwidth support.

### Phase 11 Family and digital wellbeing

Status (16 November 2026): family profile/grant/consent source, policy models and schedules, requests/overrides, scoped reports/insights, web workflows and Android family synchronization/UI source implemented. Build/API/JVM/browser verification is tracked in [Phase 11 validation](docs/validation/phase-11.md). Current consumer Android and read-only router mechanisms report unsupported restrictions; no executing enforcement adapter or applied receipt is provided. Native builds, notifications, provisioned enforcement mechanisms and physical-device behavior remain pending/unavailable as detailed in [family architecture](docs/architecture/family-wellbeing.md).

- Implement family/guardian/child profiles, invitations, avatars, assignments, consent, role permissions, dashboards, timeline and reports.
- Implement policy models for daily/app/category allowances, bedtime/study/weekend schedules, supported pauses/filtering and allowed/restricted apps.
- Add policy warnings, synchronization/versioning, enforcement states, overrides, child requests, guardian decisions and action history.
- Add rule-based insights, weekly wellbeing summaries, education/entertainment comparisons, evidence, confidence and feedback.
- Implement Android/router enforcement adapters only for supported authorized mechanisms; iOS enforcement follows Phase 12.

Completion: backend schedule, permission, override and policy-state tests pass. Actual restrictions and device notifications remain pending hardware validation; a configured policy is never reported as applied without confirmation.

### Phase 12 Native SwiftUI iOS application

- Implement account, secure sessions, enrolment/capability, reports, alerts, settings, privacy and family views.
- Add paired desktop/service inventory and confirmed remote-stop workflows.
- Implement authorized Family Controls, Device Activity, selections, Managed Settings, shielding/actions, schedules and thresholds, subject to entitlement availability.
- Represent iOS-specific unsupported data and authorization changes accurately.
- Prepare signing, distribution and physical-device test instructions without installing Xcode or simulators.

Phase 12 source status: the SwiftUI account/device/report/alert/settings/privacy/family client, confirmed desktop-stop workflow and separately gated local Apple controls are implemented in `ios/`. The default scheme leaves Family Controls disabled. The optional scheme includes Monitor, Report, Shield Configuration and Shield Action source targets; no active entitlements, signing team or approved App Group are configured. Apple report measurements remain inside their report extension; server family policies are not automatically executed on iOS.

Available checks: portable Swift repository tests, actual Swift-emitted contract validation, all-source grammar checks with the flag on/off, project/plist checks and isolated Swift HTTPS/API/PostgreSQL integration. These checks do not type-check iOS frameworks or build an iOS app. Native builds, signing/distribution, APNs, entitlement-dependent behavior, accessibility and physical-device acceptance remain pending. See `docs/architecture/ios-client.md`, `docs/validation/phase-12.md` and `ios/README.md`. No mobile tooling was installed.

### Phase 13 Business organizations

- Implement organizations, multiple locations/networks, departments, employee enrolment/device assignment, compliance and offboarding.
- Complete Business roles and permission scopes for reports, users, devices, networks, policies, alerts, audit, exports, billing and developer controls.
- Add organization/location dashboards, reports, alert assignment, audit exports and remote unenrolment.
- Verify employee/organization ownership rules during credential revocation and device-data deletion.

Phase 13 source status: Business workspace organizations, locations/networks, departments, verified employee records, registered-device and observed-endpoint department assignments, explicit company custody, employee sharing/withdrawal, consent-scoped aggregate reporting/exports, reporting compliance, alert ownership, audit exports, remote unenrolment and offboarding are implemented. Role-specific web administration and Android/SwiftUI employee sharing views use current server permissions; Business membership never supplies OS or desktop-control authorization.

Verification: backend/web/contract/PostgreSQL workflows pass organization-isolation and ownership checks; portable native code and actual Kotlin/Swift HTTPS adapters pass synthetic employee sharing scenarios. Fifteen migrations, 146 operations, 19 contract tests, 59 backend units and 26 browser scenarios are checked. Physical monitoring, native packaging/signing, offline revocation delivery and platform/hardware acceptance remain pending. Billing operations remain Phase 14. See `docs/architecture/business-organizations.md` and `docs/validation/phase-13.md`.

### Phase 14 Subscriptions and platform operations

- Implement editions, trials, monthly/annual plans, limits, retention/feature entitlements, usage counters, payment history and billing portal.
- Add grace periods, upgrades/downgrades, cancellation and authenticated/idempotent billing events.
- Complete internal user/workspace/subscription administration, category/router compatibility management, feature flags and device compatibility records.
- Complete system/agent-version health, failed-job and delivery monitoring, audit review and redacted support diagnostics.
- Add deployment configuration, backup/restore procedures, release packaging and update verification.

Completion: available billing sandbox, entitlement, administration, recovery and operational checks pass. Native purchase/distribution requirements are resolved before a paid mobile launch. Move this phase's required billing work earlier if an earlier edition is monetized.

Implemented scope: provider-neutral sandbox selected by the user. Editions, calendar-month/year test checkout, one-time trials, cancellation/resumption, grace/expiry, immutable payment history, signed replay-safe events and capacity/feature checks are implemented. Web provides owner billing and separately authorized operations; native clients provide read-only entitlement views. Operator grants expire and are scoped independently of workspace ownership. Deployment source, encrypted recovery and signed package verification are included. Production billing stays disabled; prices, a live provider and native purchase/distribution decisions remain paid-launch gates. See `docs/architecture/subscriptions-and-operations.md` and `docs/validation/phase-14.md` for evidence and pending acceptance.

### Phase 15 Physical-device validation and release

- Provide the user with native build/distribution instructions and the required tooling options when requested; do not install tooling automatically.
- Test on actual Android phones/iPhones: account/enrolment, permission denial/revocation, battery restrictions, background behavior, reboot, offline collection, synchronization, usage accuracy, notifications and privacy controls.
- Verify Android/iOS stop controls against a paired computer over another network, including stale targets, expiry, offline computers and revocation.
- Verify supported router hardware/firmware and Family enforcement/overrides; retain unavailable status for unvalidated combinations.
- Resolve user-reported defects, complete native compilation/signing/distribution checks, and rerun affected verification.
- Validate security/access boundaries, retention/deletion, export, backup restoration, installer/update behavior and supported-environment documentation.
- Retire Flutter after its native replacement is accepted. Release domain increments only when their applicable device/hardware checks pass.

Completion: acceptance evidence identifies which platforms/features are source-complete, built, integrated and hardware-verified. No pending critical platform check is hidden behind a claim of a complete release. The user performs device tests; development includes the correction cycle after their results.

Current status: **in progress; physical acceptance pending**. Phase 15 adds candidate-bound release evidence tooling, read-only existing-tool prerequisite checks, platform-specific build/testing handoffs and an explicit support matrix. iOS Debug identifiers are isolated from the Flutter reference. Native builds/signing, phone/router observations, production runtime and installer/update acceptance remain pending; no mobile tooling is installed and Flutter is not retired. See `docs/release/README.md` and `docs/validation/phase-15.md`.

Desktop packaging/update follow-up: local macOS preview packaging and the signed update controller/provider are implemented. Production identity, notarization and host are unconfigured; actual signed install/replacement/recovery remain pending. Explicit per-user macOS background-service registration/removal is implemented; signed packaged-agent/Keychain and login/device acceptance remain pending. See `docs/validation/desktop-background-service.md`. See `desktop/packaging/README.md` and `docs/validation/desktop-packaging.md`.

Desktop diagnostics/recovery follow-up: explicit current-state checks, fixed public failure reasons, guarded stale-socket repair and redacted diagnostic export are implemented. Recovery never kills/restarts processes or resets pairing/settings. Signed packaged Electron/Keychain acceptance remains pending. See `docs/validation/desktop-diagnostics.md`.

Production deployment/recovery follow-up: digest-gated single-host container rollout, HTTPS ingress, explicit schema operations, a durable bounded maintenance worker and authenticated backup scheduling/health are implemented. Migration eighteen adds operational worker state. No hosting is provisioned; real DNS/TLS/registry/DB roles, off-site storage and measured live acceptance remain pending. See `infra/production/README.md` and `docs/validation/production-deployment.md`.

### Phase 16 Optional later extensions

- Expand Windows and supported Linux desktop targets, plus explicit Docker/WSL support.
- Add further tested router families and supported DNS/firewall/security integrations.
- Consider YouTube reports only with a demonstrated authorized source; include classification confidence and corrections.
- Add optional AI explanations/summaries without silent enforcement.
- Add email notifications, Business notification integrations, themes and Enterprise scope.
- Keep email sorting outside the current implementation. Inbox access requires a separate explicit scope/privacy decision.

Completion: scope and dependencies are reviewed separately for each extension; later features do not block core validation.

Selected first increment: **themes and opt-in alert emails**, explicitly requested by the user. Android now applies account themes; desktop adds local SYSTEM/LIGHT/DARK choices and now uses Tailwind CSS 4 per the user’s follow-up request. Web/iOS retain existing account theme support. Email opt-in and per-rule channel are implemented with a hard-disabled transport and visible unavailable states; no live sending, inbox access or sorting is enabled. Other Phase 16 extensions remain deferred, and Phase 15 physical/native acceptance remains pending. See `docs/architecture/themes-and-alert-email.md` and `docs/validation/phase-16.md`.

## Complete feature catalogue

Sections 1 through 25 preserve the supplied catalogue. Section 26 adds the agreed developer tools. Conditional features require evidence of platform or router support before release. Later items are retained as future scope rather than implied launch commitments.

### 1. Account and authentication

- User registration
- Secure login and logout
- Email verification
- Forgotten-password recovery
- Access and refresh tokens
- Session management
- Sign out from other devices
- Account deletion
- Personal profile
- Notification preferences
- Multiple workspaces
- Workspace invitations
- Workspace switching

### 2. Device registration

- Register Android and iOS devices
- Automatic device name, model and OS detection
- Device ownership verification
- Device enrolment codes
- Rename registered devices
- Enable or pause monitoring
- Remove registered devices
- View last synchronization time
- View application version
- View battery-optimization status
- View monitoring-health status
- Remote device unenrolment
- Device data deletion
- Device capability report

### 3. Capability detection

Every registered device will report which features it supports.

Capability statuses:

- Supported
- Permission required
- Battery setup required
- Device-owner access required
- Manufacturer-specific
- Router required
- Restricted by the operating system
- Unsupported
- Temporarily unavailable

The user will always see why a feature is unavailable.

### 4. Personal hotspot monitoring

Android-first features:

- Detect hotspot/tethering state where available
- Record when hotspot monitoring starts and stops
- Display available hotspot information
- Monitor total mobile-data consumption where supported
- Monitor total Wi-Fi consumption where supported
- Usage history
- Daily usage summary
- Weekly usage summary
- Monthly usage summary
- Mobile versus Wi-Fi comparison
- Monthly data-allowance tracking
- Configurable usage alerts
- Hotspot monitoring-health status
- Permission and compatibility guidance

Conditional features:

- Connected hotspot devices
- Hotspot client online/offline status
- Per-client data consumption
- Client connection history

These conditional features will only appear on devices where Android and the manufacturer expose reliable information.

### 5. Advanced Android device monitoring

With explicit permission:

- Total screen time
- Per-application screen time
- Application foreground duration
- First and last use
- Daily application usage
- Weekly application usage
- Monthly application usage
- Most-used applications
- Usage trends
- Application launch count where reliable
- Device activity timeline
- Late-night usage
- Monitoring permission status
- Permission-revoked alerts
- Device-not-reporting alerts
- Offline data collection
- Automatic background synchronization

Examples of monitored application categories:

- Social media
- Messaging
- Games
- Education
- Productivity
- Entertainment
- Health
- Utilities
- Other

This will show time spent using Instagram, WhatsApp, games and other applications, but it will not read their private contents.

### 6. Application catalogue

- Detect installed package names where permitted
- Resolve application display names
- Application icons
- Application categories
- Category-confidence indicator
- Manual category correction
- Custom categories
- Category-level reports
- Unknown-application handling

### 7. Usage reports

- Today’s usage
- Yesterday comparison
- Seven-day overview
- Weekly comparison
- Monthly overview
- Per-device reports
- Per-application reports
- Category reports
- Mobile-data reports
- Wi-Fi-data reports
- Screen-time trends
- Bedtime usage
- Usage-limit progress
- Exportable reports
- Missing-data indicators
- Measurement-source indicators
- Measured versus estimated values

### 8. Alerts and notifications

- Data limit reached
- Data limit approaching
- Excessive screen time
- Application limit approaching
- Bedtime usage
- Monitoring permission disabled
- Device stopped reporting
- Device returned online
- New network device discovered
- Unknown network device discovered
- Router disconnected
- Agent stopped reporting
- Router authentication failed
- Internet connection lost
- Policy enforcement failed
- Subscription-limit warning

Notification channels:

- In-app notifications
- Android notifications
- iOS notifications
- Email notifications later
- Business notification integrations later

Users can configure:

- Alert threshold
- Severity
- Notification channel
- Quiet hours
- Devices covered
- Network covered
- Enable or disable individual alerts

### 9. Wi-Fi network discovery

Through the local Go network agent:

- Discover the current gateway
- Discover the local subnet
- Detect devices on the local network
- Identify router manufacturer
- Identify router model where possible
- Record router firmware version where available
- Register networks
- Name networks
- Register multiple network agents
- Secure agent enrolment
- Agent heartbeat
- Agent online/offline status
- Offline data buffering
- Automatic synchronization
- Network compatibility test

### 10. Router compatibility system

- Router compatibility registry
- Manufacturer and model database
- Firmware-specific compatibility
- Authentication-method detection
- Supported-feature list
- Unsupported-feature list
- Known limitations
- Last-tested date
- Router adapter version
- Compatibility feedback
- Router credential management
- Encrypted credential storage
- Router connection test

Initial development should support only a small number of thoroughly tested router families.

### 11. Wi-Fi device inventory

- Connected-device list
- Online/offline status
- IP address
- Hardware address or privacy-safe identifier
- Hostname
- Manufacturer
- Device category
- Friendly name
- First-seen time
- Last-seen time
- Connection history
- Network association
- Trusted or unknown status
- Assign device to a person
- Assign device to a department
- Add device notes
- Hide or archive old devices

Device categories may include:

- Phone
- Tablet
- Computer
- Television
- Game console
- Smart-home device
- Printer
- Camera
- Network equipment
- Unknown device

### 12. Wi-Fi monitoring

- Current connected devices
- Device presence history
- Network event timeline
- New-device detection
- Unknown-device alerts
- WAN/internet status
- Router health
- Agent health
- Total network consumption where supported
- Per-device bandwidth where supported
- Upload and download totals where supported
- Historical bandwidth charts
- Peak-usage periods
- Network availability history
- Real-time dashboard updates

### 13. Network security

- Unknown-device detection
- New-device alerts
- Trusted-device management
- Router-disconnection alerts
- Agent-health alerts
- Router-authentication failure alerts
- Device inventory changes
- Security event timeline
- Alert acknowledgement
- Alert severity
- Alert assignment in the Business edition
- Security-event history
- Audit trail

Later supported integrations could add:

- DNS security alerts
- Suspicious-domain categories
- Router firewall events
- Repeated connection-failure alerts

### 14. Family profiles

- Create a family
- Add guardians
- Add children
- Invite family members
- Create child profiles
- Assign devices to children
- Assign networks to family members
- Profile avatar
- Age-appropriate policy selection
- Guardian permissions
- Family overview
- Per-child dashboard
- Family activity timeline
- Family reports
- Consent records

### 15. Parental controls

Depending on Android, iOS and router support:

- Daily screen-time allowance
- Per-application limits
- Application-category limits
- Bedtime schedules
- School or study schedules
- Weekend schedules
- Temporary device pause
- Network access pause
- Domain/category filtering
- Allowed applications
- Restricted applications
- Policy warnings
- Policy synchronization
- Policy enforcement status
- Temporary overrides
- Child override requests
- Guardian approval or rejection
- Policy action history
- Failed-enforcement alerts

### 16. iOS Family Controls

Subject to Apple authorization and entitlements:

- Family Controls authorization
- Parent/guardian approval
- Device Activity monitoring
- Device Activity reports
- Application/category selection
- Managed Settings
- Application shielding
- Website shielding
- Shield configuration
- Shield actions
- Schedule-based restrictions
- Usage-threshold events
- Authorization-status monitoring

The iOS feature set will not necessarily be identical to Android because Apple exposes different capabilities.

### 17. Digital wellbeing insights

The first version will use deterministic rules rather than uncontrolled AI.

- Screen-time increase or decrease
- Application-usage trends
- Category-usage trends
- Late-night usage patterns
- Education versus entertainment comparison
- Usage-limit progress
- Unusual activity periods
- Device stopped reporting
- Weekly wellbeing summary
- Suggested schedule adjustments
- Supporting data for every recommendation
- Confidence and data-quality indicators
- User feedback on recommendations

Later AI features may include:

- Personalized wellbeing summaries
- Age-appropriate recommendations
- Pattern explanation
- Suggested limits
- Natural-language weekly summaries

AI will recommend actions but will not silently enforce restrictions.

### 18. Supported YouTube insights

Where an authorized and legitimate data source is available:

- Video category classification
- Educational versus entertainment classification
- Viewing-category summaries
- Time-based YouTube reports
- Guardian category corrections
- Classification-confidence indicator

NetSentry will not promise universal access to private YouTube viewing history.

### 19. Business organizations

- Create an organization
- Multiple organizations per account
- Multiple locations
- Multiple networks per location
- Department management
- Organization overview
- Location health
- Network health
- Employee enrolment
- Employee-device assignment
- Department assignment
- Device compliance status
- Employee offboarding
- Remote unenrolment
- Organization-wide reports
- Business alerts
- Audit exports

### 20. Roles and permissions

Personal role:

- Owner

Family roles:

- Family owner
- Guardian
- Member
- Child

Business roles:

- Organization owner
- Administrator
- Network administrator
- Analyst
- Viewer
- Employee device

Permissions will control:

- Viewing reports
- Managing users
- Managing devices
- Managing networks
- Creating policies
- Handling alerts
- Viewing audit logs
- Managing subscriptions
- Exporting information

### 21. Subscriptions and editions

Possible editions:

- Personal Free
- Personal Premium
- Family
- Business
- Enterprise later

Subscription features:

- Trial periods
- Monthly and annual plans
- Device limits
- User limits
- Network limits
- Data-retention limits
- Feature entitlements
- Subscription status
- Payment history
- Billing portal
- Usage counters
- Grace periods
- Upgrade and downgrade
- Subscription cancellation

### 22. Responsive web dashboard

Built with Next.js and Tailwind CSS.

Main dashboard areas:

- Overview
- Devices
- Personal usage
- Application usage
- Networks
- Connected devices
- Alerts
- Reports
- Family
- Policies
- Organizations
- Locations
- Team members
- Audit logs
- Subscription
- Settings

Responsive support:

- Mobile navigation
- Tablet layout
- Desktop sidebar
- Loading states
- Empty states
- Error states
- Permission-required states
- Unsupported-feature states
- Accessible keyboard navigation
- Light and dark mode later

### 23. Data and privacy controls

- Clear monitoring disclosure
- Explicit consent
- Permission history
- Consent history
- Pause monitoring
- Revoke monitoring
- Export personal data
- Delete collected data
- Delete individual devices
- Delete account
- Configurable retention
- Raw-data expiry
- Longer-term aggregated data
- Audit logging
- Encrypted communication
- Encrypted sensitive credentials
- Workspace isolation
- Monitoring-health transparency

### 24. Platform administration

Internal administration features:

- User management
- Workspace management
- Subscription support
- Router compatibility management
- Application-category management
- Feature flags
- Device compatibility records
- Agent-version monitoring
- System-health dashboard
- Failed-job monitoring
- Alert delivery monitoring
- Audit review
- Support diagnostics

### 25. Features we will not provide

NetSentry will not include:

- Reading WhatsApp or Instagram messages
- Reading private emails
- Password collection
- Keylogging
- Hidden audio recording
- Hidden camera recording
- Secret screen recording
- Stealth monitoring
- Monitoring spouses or unrelated adults
- Bypassing Android or iOS security
- Claiming unsupported hotspot information
- Decrypting private HTTPS traffic
- AI silently applying restrictions

### 26. Desktop developer tools and mobile service control

Desktop application and agent lifecycle:

- React and TypeScript desktop interface using Electron and Vite, selected during Phase 0.
- Shared Go agent with an independently enabled Developer Tools module.
- Secure computer enrolment, ownership verification, pairing, and revocation.
- Multiple paired computers, identified by workspace and owner.
- Agent version, heartbeat, last synchronization, capability, and online/offline reporting.
- Explicit settings for background operation and launch at login.
- Independent Network Monitoring and Developer Tools enablement.

Service discovery and projects:

- Discover local listening TCP services visible to the current user.
- Display service name, executable/runtime where detectable, process identity, port, listening address, runtime duration where available, and observation freshness.
- Distinguish detected services from confirmed development services.
- Associate services with projects using available process and project metadata.
- Show uncertainty or unavailable process metadata rather than inventing a project match.
- Manual project naming, service association, and correction.
- Group multiple services under one project and computer.
- Search/filter by computer, project, service, and port.
- Update the inventory as services start, stop, or restart.
- Show permission restrictions and unsupported environments.

Local and mobile controls:

- Stop one selected development service from the desktop interface.
- Stop one selected desktop development service from the Android app, and later the SwiftUI app.
- Attempt graceful shutdown and verify the target service stopped.
- Offer force-stop separately when supported and explicitly requested.
- Handle child processes without terminating unrelated processes.
- Recognize or clearly report supervised/automatically restarting services.
- Require separate permissions for viewing services and controlling them.
- Revalidate process identity, target agent, current authorization, and command expiry before acting.
- Track pending, accepted, succeeded, failed, expired, and cancelled commands.
- Protect against duplicate command execution, process-ID reuse, and stale service/port observations.
- Report disconnected, sleeping, revoked, restricted, and target-changed conditions accurately.
- Confirm shutdown through the agent; never interpret message delivery alone as success.
- Provide command history and audit records with requester, target, timestamps, and outcome.
- Provide optional long-running-service reminders after the core workflow is reliable.

Platform expansion:

- Proposed first desktop target: macOS; confirm the supported-version matrix during foundation work.
- Windows support follows with platform-specific discovery and shutdown testing.
- Docker and WSL are later explicit integrations, including container/environment identity and restart behavior.
- General Linux desktop support is a later platform decision. Supported network-only agent hosts are selected separately.
- Arbitrary remote shell commands, automatic service termination, and system-service administration are outside the initial scope.

## Product release scope

These product groupings preserve the supplied Personal, Advanced Android, Wi-Fi, Family, iOS, and Business scope while inserting Developer Tools as Release 2B. The implementation phases above govern working order; device-dependent release acceptance remains pending until physical-device validation. No calendar dates are committed. Estimate each milestone after platform feasibility checks, staffing, and the preceding acceptance results. The first desktop operating system and early router families remain planning decisions.

### Foundation

Scope:

- Establish native Kotlin/SwiftUI project structure and the Flutter retirement path.
- Use the Electron/Vite scaffold with React/TypeScript and a separate Go agent; define authenticated IPC before privileged integration.
- Confirm the first supported Android, desktop, and agent-host environments.
- Define versioned API contracts, capability statuses, enrolment, permission boundaries, and measurement provenance.
- Add database migrations, environment validation, build checks, and isolated test environments.
- Implement the consent, deletion, retention, audit, and workspace-isolation foundations required before collecting monitoring data.
- Plan the Go module interfaces and authenticated local IPC.
- Start Android permission/background feasibility checks, iOS authorization/entitlement assessment, and candidate router evaluation early.
- Add basic platform diagnostics and administrative access boundaries.

Completion criteria:

- API contract checks run reproducibly. Native source structure is prepared; native builds are checked only when compatible tools are already available or a later build environment is explicitly requested.
- Schema migrations apply on a clean database and an existing development dataset without unexpected data loss.
- Permission tests prevent access across workspaces and distinguish device viewing from control.
- Capability reports represent unsupported/denied states consistently across clients.
- Desktop runtime and initial platform choices are recorded in the Phase 0 decision document; runtime/hardware acceptance remains tracked separately.

### Release 1 Personal Android MVP

Scope:

- Kotlin account flows: registration, verification, recovery, login/logout, refresh, session management, profile, notification preferences, and account deletion.
- Personal workspace selection, invitations where supported, and membership checks.
- Complete Android device enrolment/lifecycle and capability reporting, including pause/revoke/delete and health/setup indicators.
- Supported hotspot state and aggregate mobile/Wi-Fi measurements; monitoring session history, daily/weekly/monthly summaries, allowance tracking, and configurable data alerts.
- Conditional hotspot client information only on verified compatible devices; unsupported devices receive explanations.
- Responsive web authentication and live device/usage/alert views with loading, empty, error, permission, and unsupported states.
- In-app and Android notifications, basic privacy controls, data export/deletion, and operational health visibility.

Dependencies: Foundation; supported Android API/permission validation. Per-client hotspot measurements do not block release on devices without support.

Completion criteria:

- Sign up, verify, enrol, grant supported permissions, collect data, synchronize, and view it in Android/web.
- Device pause/revocation stops future collection or ingestion according to the defined lifecycle, and deletion is verified.
- Measurements include sources and time coverage; gaps and unsupported metrics cannot appear as real zeroes or fabricated values.
- Notification thresholds, quiet hours, recovery, session revocation, and workspace isolation pass end-to-end checks.

### Release 2 Advanced Android monitoring

Scope:

- Screen time, per-application foreground duration, first/last use, trends, timelines, late-night usage, and reliable launch counts where supported.
- Application catalogue, icons, categories, confidence, manual/custom classifications, and unknown-app handling.
- Per-app/category/device reports, comparison periods, exports, missing-data/estimate indicators, and limit progress when limits exist.
- Offline collection, bounded local buffering, retry/deduplication, background synchronization, permission history, and monitoring-health alerts.
- Begin deterministic insight calculations with supporting measurements; Family-specific views follow in Release 4.

Dependencies: Release 1 collectors/consent and validated background behavior. Reporting of limits does not imply enforcement before its supported policy module exists.

Completion criteria:

- Permission denial/revocation, background restrictions, device reboot, timezone changes, and offline recovery are tested.
- Repeated synchronization does not double-count app usage, and corrections are reflected in reports.
- Reports identify gaps and data quality; no private app message/content collection occurs.
- The Kotlin replacement covers the accepted Flutter behaviors before the Flutter application is retired.

### Release 2B Developer Tools

Scope:

- Deliver the Go shared foundation and Developer Tools module without waiting for router adapters.
- Deliver the React/TypeScript desktop interface, secure pairing, inventory, project grouping/correction, local shutdown, and confirmed results.
- Add Android remote service views and stop controls via authenticated outbound agent connections.
- Add command expiry, authorization, duplicate protection, process identity checks, audit records, and revocation.
- Add filters, history, background settings, and optional long-running-service reminders after the main workflow is stable.
- Target macOS first as a proposed default; schedule Windows as a follow-up increment after native process-control acceptance.

Dependencies: Foundation identity/permissions/contracts and Android account/device flows. This milestone can overlap Release 2 once the shared foundations are stable; it does not require screen-time collectors.

Completion criteria:

- Pair a computer, start example Node.js and Python services, identify/correct their project association, and stop one locally and from Android over another network.
- Verify the intended service stopped and unrelated processes remain running.
- Test process exits/restarts, child processes, supervised restarts, process-ID reuse, port reuse, denied permissions, revoked credentials, duplicate requests, and expired commands.
- Sleeping/offline machines show unavailable status; reconnection does not execute expired commands.
- Closing the desktop interface preserves only the background behavior explicitly enabled by the user.

### Release 3 Wi-Fi monitoring

Scope:

- Extend the shared Go agent with independently enabled Network Monitoring.
- Discover gateway/subnet/devices, enrol multiple agents, register/name networks, buffer offline data, and synchronize observations.
- Build the router compatibility registry, credential storage, connection testing, versioned adapters, and support limitations.
- Deliver detailed inventory, presence/history, trusted status, notes/archiving, and network association. Person/department assignments activate with Family/Business profiles.
- Provide supported WAN/router/agent health, traffic totals, bandwidth history, availability, real-time views, and security event/alert workflows.
- Start with a small, explicitly tested router support matrix.

Dependencies: Shared agent core, measurement pipeline, compatibility tests, and authorized router access. Discovery alone does not establish per-device traffic measurement support.

Completion criteria:

- Each supported router/firmware combination has a connection and measurement test record with adapter version and limitations.
- Network discovery, unknown-device events, router authentication failure, disconnect/reconnect, agent loss, and multi-agent observation deduplication pass tests.
- Inventory differentiates observed network endpoints from enrolled installations and handles changing/randomized identifiers.
- Unsupported bandwidth fields remain unavailable; no estimated value is presented as measured.

### Release 4 Family edition

Scope:

- Families, guardians/children, invitations, avatars, device/network assignments, age-appropriate profiles, dashboards, timeline, reports, and consent records.
- Daily/app/category limits; bedtime, study/school, and weekend schedules; temporary pauses; allowed/restricted apps; supported domain/category filtering.
- Policy warnings, versioned synchronization, enforcement status, temporary overrides, child requests, guardian decisions, action history, and failed-enforcement alerts.
- Deterministic wellbeing insights, evidence, confidence/data quality, feedback, weekly summaries, and suggested adjustments.
- Family role permissions and entitlement enforcement; implement billing before a paid Family launch.

Dependencies: Android measurement/permissions, family consent/access model, and verified enforcement mechanisms. Router-based controls require an adapter that supports the specific action. iOS enforcement follows Release 5 authorization.

Completion criteria:

- Guardians can manage only the child profiles/devices/networks they are authorized to manage.
- Supported policies are tested on the actual target platform; requested, applied, failed, and unavailable states remain distinct.
- Override requests, expiry, schedule boundaries, timezone changes, stale policy sync, and revoked permission behave predictably.
- Recommendations show supporting data and never silently create/enforce policies.

### Release 5 Native iOS

Scope:

- Swift/SwiftUI account, enrolment, capability, profile, report, alert, settings, and privacy flows.
- iOS views for paired developer computers, service inventory, and confirmed remote stop actions.
- Approved Family Controls authorization, Device Activity reports/monitoring, selection, Managed Settings, application/website shielding, shield actions, schedules, thresholds, and authorization-state reporting.
- iOS notification delivery and platform-specific accessibility/empty/permission states.

Dependencies: Early Apple feasibility/entitlement work and explicit authorization. Android data sources and enforcement behavior must not be assumed available on iOS. Phone control of a paired desktop remains separate from iOS monitoring permissions.

Completion criteria:

- Native app passes account/device/report/notification/privacy and desktop-command scenarios against the shared backend.
- Family functions are validated with the required authorization/entitlements and tested revocation behavior.
- Unsupported iOS measurements/policies have accurate explanations; Android parity is not claimed.

### Release 6 Business edition

Scope:

- Organizations, multiple organizations/account, locations, networks/location, departments, employee enrolment/assignment, compliance, offboarding, and remote unenrolment.
- Organization/location/network dashboards, organization reports, Business alert assignment, detailed roles, and audit exports.
- Subscription editions, trials, monthly/annual plans, limits, retention entitlements, payment history, billing portal, usage counters, grace periods, upgrade/downgrade, and cancellation.
- Business administration/support diagnostics and organization data-access boundaries.

Dependencies: Shared monitoring domains, complete role/permission matrix, billing/entitlement design, and employee consent/access workflows. Bring entitlements and payment integration forward if any earlier edition launches as a paid product.

Completion criteria:

- Users cannot cross organization/location/device permission boundaries, including through reports, exports, commands, or audit APIs.
- Offboarding removes access and revokes relevant device/agent credentials according to ownership policy.
- Billing events are authenticated and idempotent; trial, downgrade, cancellation, limit, and grace-period behavior are tested.
- Report exports and support access follow organization permissions and audit requirements.

### Later extensions

- Windows completion if not delivered within the Developer Tools follow-up; Docker/WSL integrations and separately scoped Linux desktop support.
- Additional router/firmware families and supported DNS, firewall, suspicious-domain, and repeated-connection-failure events.
- Authorized YouTube category/time insights only after a legitimate source is demonstrated, with category corrections and confidence indicators.
- Optional AI wellbeing explanations/summaries and suggestions, with supporting data and no silent enforcement.
- Email notification delivery and Business notification integrations.
- Light/dark themes and Enterprise edition scope.
- Email sorting as a separate future proposal. Connecting/reading an inbox requires explicit scope and privacy-boundary revision; it is not authorized by this plan. Sending notification emails does not authorize reading inbox contents.

## Feature coverage by release

A group may span releases: its basic infrastructure precedes the consumer that requires it. A row covers all items in the corresponding catalogue section, including its explicitly conditional/later items.

| Catalogue section | Delivery mapping |
| --- | --- |
| 1 Account and authentication | Foundation and Release 1; invitations extend into Family/Business |
| 2 Device registration | Foundation and Release 1; desktop in 2B and iOS in 5 |
| 3 Capability detection | Foundation, maintained across every platform/module |
| 4 Personal hotspot monitoring | Release 1 supported metrics; conditional features follow verified device support |
| 5 Advanced Android device monitoring | Release 2 |
| 6 Application catalogue | Release 2; administration maintained thereafter |
| 7 Usage reports | Releases 1 and 2; Family/Business report views in 4 and 6 |
| 8 Alerts and notifications | Core delivery in 1; app/device alerts in 2; developer reminders in 2B; network alerts in 3; policy alerts in 4; iOS channel in 5; subscription alerts in paid editions; email/Business integrations later |
| 9 Wi-Fi network discovery | Release 3, reusing the core delivered in 2B |
| 10 Router compatibility system | Release 3; supported families expand later |
| 11 Wi-Fi device inventory | Release 3; person/department assignments in 4/6 |
| 12 Wi-Fi monitoring | Release 3, gated by source capabilities |
| 13 Network security | Release 3; Business assignments in 6; advanced integrations later |
| 14 Family profiles | Release 4 |
| 15 Parental controls | Release 4 supported Android/router actions; approved iOS actions in 5 |
| 16 iOS Family Controls | Early feasibility in Foundation, delivery in Release 5 subject to authorization |
| 17 Digital wellbeing insights | Initial calculations in 2; full deterministic Family experience in 4; AI later |
| 18 Supported YouTube insights | Later, gated by demonstrated authorized source |
| 19 Business organizations | Release 6 |
| 20 Roles and permissions | Foundation/1 baseline, explicit desktop control in 2B, Family roles in 4, Business roles in 6 |
| 21 Subscriptions and editions | Entitlement design in Foundation; delivery before the first paid launch, full Business scope in 6; Enterprise later |
| 22 Responsive web dashboard | Incremental sections with each domain; all stated UI/accessibility states apply to each release; themes later |
| 23 Data and privacy controls | Foundations before collection, operational in 1 and extended/tested with every domain |
| 24 Platform administration | Basic health/access in Foundation/1; category management in 2; agent versions in 2B; router registry in 3; policy diagnostics in 4; subscription support in paid editions/6 |
| 25 Features we will not provide | Acceptance boundary for all releases; email sorting requires a separate later decision |
| 26 Desktop developer tools | Release 2B, iOS mobile controls in 5, platform/container expansion later |

## Quality and release requirements

Each release must include working empty/error/loading/permission/unavailable states, accessible navigation, relevant administration, and an updated compatibility matrix. Features that depend on unverified access remain unavailable rather than being simulated in production.

Verification should cover:

- Backend units and integration tests for authorization, session rotation/revocation, enrolment, ingestion, retention/deletion, alerts, and commands.
- Native Android/iOS tests on supported real devices for permission transitions, lifecycle/background behavior, offline recovery, and battery restrictions where applicable.
- Go adapter and integration tests for discovery, command targeting, process trees, reconnect behavior, and agent module isolation.
- Router adapter contract tests plus real hardware/firmware verification for each advertised family.
- Web/desktop/mobile end-to-end flows covering account/workspace access, monitoring, unavailable data, and authorized service control.
- Family enforcement tests that distinguish reports from actual applied restrictions.
- Upgrade/migration checks, authenticated update/package distribution, and recovery from failed installations.
- Operational checks for database backup restoration, failed background work, notification failures, agent-version visibility, and diagnostics with redacted secrets.
- Data export/deletion and collection-pause tests, bounded local storage, retry limits, and raw/aggregate retention behavior.

Implementation phases can advance with explicit pending physical-device checks. Every production release requires documented supported environments, known limitations, passing relevant checks, and a demonstrated end-to-end workflow on its supported devices. Performance limits and reporting freshness targets must be defined from the intended deployment scale before load testing. A provider response or command acknowledgement alone is insufficient proof that an action took effect.

## Decisions to resolve during implementation

| Decision | Required before |
| --- | --- |
| Native project locations and Compose toolkit are selected; validate supported OS versions and the Flutter retirement checklist | Foundation completion |
| Electron/Vite and the current macOS host are selected; define authenticated local IPC, installer signing/updates, and validated OS support | Developer Tools implementation |
| Supported network-only agent hosts, service installation, and privilege model | Network module implementation |
| Measurement sources, attribution rules, sampling intervals, retention defaults, and deployment volume targets | Collector implementation |
| Initial router families/firmware and credential handling | Advertising router support |
| Apple authorization/entitlement eligibility and distribution requirements | Committing iOS Family Controls availability |
| Enforcement feasibility for each Android/router policy | Advertising that specific restriction |
| Notification/job providers, retry behavior, and delivery targets | Release 1 alert delivery |
| Billing provider, edition prices/limits, entitlement handling, and native-store purchase requirements | Any paid launch |
| Legitimate authorized YouTube data source | YouTube implementation |

These decisions do not reopen the agreed Kotlin, Swift/SwiftUI, React/TypeScript desktop, Next.js/Tailwind web, NestJS/PostgreSQL backend, or modular Go agent direction. They make the selected stack concrete for implementation.
