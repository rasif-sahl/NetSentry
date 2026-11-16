# NetSentry implementation backlog

The full scope and acceptance criteria live in `DEVELOPMENT_PLAN.md`. This index tracks which phase owns each feature group. A scaffold is not a completed monitoring feature.

| Feature group | Phase | Current status |
| --- | --- | --- |
| Repository layout and platform scaffolds | 0 | Source scaffolds added; see Phase 0 validation record |
| Architecture, contracts and database foundation | 1 | Implemented; local and hosted foundation checks pass; native/device acceptance remains deferred |
| 1 Accounts and authentication | 2, 8, 12 | Phase 2 backend verification/recovery/profile/session/deletion flows implemented; Phase 4 web account flows integrated; configured email acceptance and native clients pending |
| 2 Device registration and lifecycle | 2, 8, 12 | Phase 2 enrolment, credentials, metadata/lifecycle and history APIs implemented; native pairing/detection tests pending |
| 3 Capability detection and explanations | 1, 3, 8, 12 | Versioned schema and authenticated metadata ingestion implemented; actual native/router detection and measurement remain pending |
| 4 Personal hotspot and data monitoring | 8 | Pending platform/device validation and implementation |
| 5 Advanced Android monitoring | 9 | Pending |
| 6 Application catalogue | 9 | Pending |
| 7 Reports and exports | 3, 4, 9 | Phase 3 scoped reports, comparisons, source/quality/coverage indicators and CSV APIs implemented; Phase 4 dashboard integration implemented; native integration pending |
| 8 Alerts and notifications | 3 and each domain | Phase 3 measured thresholds, health rules, quiet hours, acknowledgement, in-app delivery, preferences and retries implemented; Phase 4 web management integrated; real push/providers pending |
| 9 Wi-Fi discovery and agent | 5, 10 | Phase 5 shared identity/heartbeat/buffer/module gating implemented and integration-tested; Phase 10 passive macOS/Linux IPv4 source and fixture/API/IPC checks implemented; hardware/OS accuracy pending |
| 10 Router compatibility | 10 | Encrypted credentials, registry/test states and OpenWrt ubus v1.0.0 fixture candidate implemented; hardware support matrix unverified |
| 11 Network inventory | 10, 11, 13 | Passive inventory/spans and labels/association hooks implemented; actual connectivity/identity unknown, profile/department workflows later |
| 12 Wi-Fi monitoring | 10 | WAN counters/history/coverage, freshness and dashboard implemented with fixtures; physical accuracy pending |
| 13 Network security | 10, 13 | Inventory/auth/health events and severity/acknowledgement implemented; provider notifications and Business assignment later |
| 14 Family profiles | 11 | Profiles, explicit guardian/child scope, consent/assignments, reports and web/Android source implemented; native/device checks pending |
| 15 Parental controls | 11, 12 | Policy intent/schedules/warnings/revisions/requests/overrides implemented; executing Android/router restrictions and native notifications unavailable pending supported authority/mechanisms |
| 16 iOS Family Controls | 12 | Optional authorization/picker, local schedules/thresholds, monitor/report/shield source implemented; Apple approval, native builds and physical acceptance pending |
| 17 Wellbeing insights | 9, 11 | Pending; deterministic rules first |
| 18 Authorized YouTube insights | 16 | Deferred; legitimate source required |
| 19 Business organizations | 13 | Organizations, locations/networks, departments, employee/endpoint assignments, consent-scoped reports, compliance observations, alerts/audit and offboarding implemented; native/physical acceptance pending |
| 20 Roles and permissions | 1, 2, 7, 11, 13 | Workspace roles, invitations, lifecycle/consent ownership and separate service gates implemented; Phase 7 named computer-controller grants implemented; explicit Family profile grants and Business roles/scoped sharing implemented; physical/enterprise acceptance remains pending |
| 21 Subscriptions and editions | 14, earlier if paid launch | Pending |
| 22 Responsive web dashboard | 4 and each domain | Phase 4 account/workspace, device, report, alert, team and privacy/settings UI integrated and browser-tested; later domains explicitly planned |
| 23 Data and privacy | 1, 2, 3 and each domain | Phase 2 disclosures/history, export, deletion, revocation/generation and account-mail cleanup implemented; Phase 3 retention and raw/derived-data erasure and Phase 4 web privacy controls implemented; offline-client enforcement pending |
| 24 Platform administration | 3, 14 | Phase 3 workspace monitoring diagnostics implemented; platform administration/billing tools pending |
| 25 Excluded functionality | All | Preserve catalogue boundaries; no inbox access |
| 26 Developer tools and mobile stop | 5–8, 12 | Phase 6 owned macOS TCP discovery, project corrections, local graceful/force outcomes and desktop workflow implemented/tested; Phase 7 remote delivery, explicit grants, desktop consent and web outcomes implemented/tested; Android/iOS confirmed-control source and portable API checks implemented; native device acceptance and reminders await soak |
| Optional platform/container/AI integrations | 16 | Deferred |

Use separate source/build/integration/hardware verification states. Do not mark a whole group complete because its project directory or initial UI exists. Before each feature begins, review its catalogue scope, prerequisites, authorization and verification requirements. Commit coherent features separately with plain-language messages describing what changed.

Phase 8 status: native Android personal-client source and SDK-free Kotlin/HTTPS/API checks are implemented. Device accounting, permissions, native builds, background operation and phone stop controls remain unverified. Current API 35 hotspot/client information stays unavailable. Quality-specific estimated allowances are implemented without mixing measured totals. See `validation/phase-8.md`.

Phase 9 status: advanced Android source, detailed consent/ingestion/reports, categories/corrections, evidence-based descriptive insights, bounded synchronization and missing-report alerts are implemented. Count/OS/UI/background correctness remains a physical-device gate; see `validation/phase-9.md`. Launch figures mean observed foreground entries, never an inferred cold-start or wellbeing score.

Phase 10 status: named networks, independent desktop consent/grants, passive cache observations, source-aware inventory/spans, encrypted router credentials, read-only OpenWrt ubus protocol fixtures, WAN history/coverage and network event review are implemented. Hardware/firmware certification is pending; unsupported traffic/identity remains unavailable. See `validation/phase-10.md`. Family/department assignment workflows stay in Phases 11/13.

Phase 11 adds scoped family sharing and digital wellbeing source with synthetic verification. Restrictions remain unsupported by the current consumer Android/read-only router adapters; no configured policy is represented as applied. See `validation/phase-11.md`.

Phase 12 source: SwiftUI account/device/capability, report/alert/rule, family, settings/privacy and desktop-control flows are implemented with a Keychain-backed Foundation repository. Portable Swift, emitted-contract, grammar/project and isolated HTTPS/API/PostgreSQL checks are distinct from pending native builds. Local Screen Time uses a separate feature target and Apple authorization; server policy state never becomes an applied iOS receipt. Report data remains inside the report extension. See `validation/phase-12.md` and `architecture/ios-client.md`. Flutter stays as a reference; no mobile tools were installed.

Phase 13: Business organization administration, employee consent/ownership boundaries, reporting compliance, organization/location reports, alert assignment, audit exports and safe offboarding are implemented with backend/PostgreSQL/browser checks. Native employee source and actual Kotlin/Swift HTTPS checks pass without installing mobile tools. Organization-wide roles do not imply per-location grants, legal guardianship/ownership, OS authority or a security certification. Billing operations remain Phase 14; physical-device acceptance follows Phase 15. See `validation/phase-13.md`.

Phase 14 sandbox source and operational tools are implemented. Before monetization: approve actual catalog limits/prices, select and implement a live reconciled billing provider, financial retention and native purchase/distribution requirements. Before deployment: build/run reviewed digest-pinned images, validate HTTPS ingress/read-only runtime and schedule workers/backups. Before agent distribution: protected signing roots/high-water state, OS signing/notarization and tested installation/recovery. See Phase 14 validation for available evidence; Phase 15 retains actual-device/hardware acceptance.

Phase 15 is in progress. Candidate evidence tooling and physical-device handoffs are prepared, and iOS Debug identifiers are isolated from Flutter. Native compilation/signing/privacy manifest, actual phone/router behavior, packaged Electron, production runtime and installer/update acceptance remain pending; do not mark Phase 15 complete from source/fixture checks. See `docs/release/README.md`.

Phase 16 selected increment: Android/account and desktop/local themes plus optional email-alert preferences/channels are implemented. Email delivery is hard-disabled; transport/provider work remains future scope. No optional platform/AI/YouTube/Enterprise scope is implied. Phase 15 hardware/native release acceptance is still pending. See `validation/phase-16.md`.

Desktop packaging/update follow-up adds macOS preview packaging, signed DMG/ZIP configuration, user-confirmed signed metadata/download/install flow and agent runtime-lock handoff. No production signing identity or update host exists, so activation and real signed replacement/recovery remain pending. Actual LaunchAgent registration/removal remains separate.

## Desktop background-service follow-up

Explicit per-user macOS registration, start, removal and update interlocking are implemented. Registration requires native confirmation, fresh workspace authorization and a signed application installed in Applications. No production service was registered during development. Signed packaged-agent/Keychain and actual login acceptance remain pending. See [validation](validation/desktop-background-service.md).

## Desktop diagnostics and recovery

Explicit current-state diagnostics, user-confirmed stale-socket recovery and redacted JSON export are implemented. Repair requires verified trust, no managed job/registration, private state and exclusive runtime locking; it preserves credentials, settings and data and never starts/stops a process. Partial-registration and failure guidance is included. Signed native acceptance remains pending. See [validation and operation](validation/desktop-diagnostics.md).

## Production deployment and recovery follow-up

Explicit digest-gated rollout and HTTPS/runtime checks, all-workspace maintenance with durable cursor/health and authenticated scheduled backup retention/health are implemented. Apply all **eighteen** migrations explicitly; migration eighteen stores only operational worker state. No production hosting/provider is configured. Earlier phase evidence remains historical; source, isolated container verification and live acceptance are separate. See [current operation and verification](validation/production-deployment.md).
