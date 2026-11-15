# NetSentry implementation backlog

The full scope and acceptance criteria live in `DEVELOPMENT_PLAN.md`. This index tracks which phase owns each feature group. A scaffold is not a completed monitoring feature.

| Feature group | Phase | Current status |
| --- | --- | --- |
| Repository layout and platform scaffolds | 0 | Source scaffolds added; see Phase 0 validation record |
| Architecture, contracts and database foundation | 1 | Implemented; local and hosted foundation checks pass; native/device acceptance remains deferred |
| 1 Accounts and authentication | 2, 8, 12 | Existing backend/Flutter foundation; complete native flows pending |
| 2 Device registration and lifecycle | 2, 8, 12 | Existing registration API; lifecycle/native integration pending |
| 3 Capability detection and explanations | 1, 3, 8, 12 | Versioned statuses/reasons/actions contract and invariants tested; collectors/report ingestion pending |
| 4 Personal hotspot and data monitoring | 8 | Pending platform/device validation and implementation |
| 5 Advanced Android monitoring | 9 | Pending |
| 6 Application catalogue | 9 | Pending |
| 7 Reports and exports | 3, 4, 9 | Pending |
| 8 Alerts and notifications | 3 and each domain | Pending; push requires later device checks |
| 9 Wi-Fi discovery and agent | 5, 10 | Go module boundary only; discovery pending |
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
| 20 Roles and permissions | 1, 2, 7, 11, 13 | Workspace permission foundation and read-only viewer behavior tested; device-specific/Family/Business grants pending |
| 21 Subscriptions and editions | 14, earlier if paid launch | Pending |
| 22 Responsive web dashboard | 4 and each domain | Existing preview interface; live integration pending |
| 23 Data and privacy | 1, 2, 3 and each domain | Privacy/retention/audit boundaries designed; query-safe errors implemented; collection lifecycle/persistence pending |
| 24 Platform administration | 3, 14 | Pending |
| 25 Excluded functionality | All | Preserve catalogue boundaries; no inbox access |
| 26 Developer tools and mobile stop | 5–8, 12 | Desktop/agent source scaffolds; discovery/control pending |
| Optional platform/container/AI integrations | 16 | Deferred |

Use separate source/build/integration/hardware verification states. Do not mark a whole group complete because its project directory or initial UI exists. Before each feature begins, review its catalogue scope, prerequisites, authorization and verification requirements. Commit coherent features separately with plain-language messages describing what changed.
