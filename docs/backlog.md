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
| 9 Wi-Fi discovery and agent | 5, 10 | Phase 5 shared identity/heartbeat/buffer/module gating implemented and integration-tested; actual discovery remains Phase 10 |
| 10 Router compatibility | 10 | Pending; select hardware support matrix |
| 11 Network inventory | 10, 11, 13 | Pending |
| 12 Wi-Fi monitoring | 10 | Pending |
| 13 Network security | 10, 13 | Pending |
| 14 Family profiles | 11 | Pending |
| 15 Parental controls | 11, 12 | Pending supported enforcement mechanisms |
| 16 iOS Family Controls | 12 | Pending authorization/entitlements and implementation |
| 17 Wellbeing insights | 9, 11 | Pending; deterministic rules first |
| 18 Authorized YouTube insights | 16 | Deferred; legitimate source required |
| 19 Business organizations | 13 | Pending |
| 20 Roles and permissions | 1, 2, 7, 11, 13 | Workspace roles, invitations, lifecycle/consent ownership and separate service gates implemented; Phase 7 named computer-controller grants implemented; full Family/Business resource grants pending |
| 21 Subscriptions and editions | 14, earlier if paid launch | Pending |
| 22 Responsive web dashboard | 4 and each domain | Phase 4 account/workspace, device, report, alert, team and privacy/settings UI integrated and browser-tested; later domains explicitly planned |
| 23 Data and privacy | 1, 2, 3 and each domain | Phase 2 disclosures/history, export, deletion, revocation/generation and account-mail cleanup implemented; Phase 3 retention and raw/derived-data erasure and Phase 4 web privacy controls implemented; offline-client enforcement pending |
| 24 Platform administration | 3, 14 | Phase 3 workspace monitoring diagnostics implemented; platform administration/billing tools pending |
| 25 Excluded functionality | All | Preserve catalogue boundaries; no inbox access |
| 26 Developer tools and mobile stop | 5–8, 12 | Phase 6 owned macOS TCP discovery, project corrections, local graceful/force outcomes and desktop workflow implemented/tested; Phase 7 remote delivery, explicit grants, desktop consent and web outcomes implemented/tested; native mobile controls remain Phases 8/12 and reminders await soak |
| Optional platform/container/AI integrations | 16 | Deferred |

Use separate source/build/integration/hardware verification states. Do not mark a whole group complete because its project directory or initial UI exists. Before each feature begins, review its catalogue scope, prerequisites, authorization and verification requirements. Commit coherent features separately with plain-language messages describing what changed.

Phase 8 status: native Android personal-client source and SDK-free Kotlin/HTTPS/API checks are implemented. Device accounting, permissions, native builds, background operation and phone stop controls remain unverified. Current API 35 hotspot/client information stays unavailable. Quality-specific estimated allowances are implemented without mixing measured totals. See `validation/phase-8.md`.

Phase 9 status: advanced Android source, detailed consent/ingestion/reports, categories/corrections, evidence-based descriptive insights, bounded synchronization and missing-report alerts are implemented. Count/OS/UI/background correctness remains a physical-device gate; see `validation/phase-9.md`. Launch figures mean observed foreground entries, never an inferred cold-start or wellbeing score.
