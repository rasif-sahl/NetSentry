# Deployment and API maintenance

Backend, Kotlin, Swift, Go and TypeScript clients use language-neutral schemas. Platform source and generated client bindings stay with their applications. No mobile build tool is needed to check these contracts.

## Implemented API

`openapi/api.v1.json` describes the 162 documented account, workspace, device, agent, health/readiness, privacy, monitoring, notification, network, Family, Business, sandbox billing and operations endpoints (including disabled legacy registration) at the default `/api/v1` base. It includes request/response schemas, bearer authentication, path parameters, status codes and structured errors. The deployment base URL and prefix remain configurable. The legacy starter root response is not a product API.

POST responses retain NestJS's existing 201 status. Session refresh revokes the previous session. Personal workspaces are created at signup; manual PERSONAL creation returns 403. Existing optional input fields accept null where their DTO uses `IsOptional`. Direct legacy device registration is disabled. One-time enrolment returns a separate opaque device credential; capability/permission history and reported metadata use scoped lifecycle endpoints. Capability declarations never grant permissions. The pre-release API is v1.10.0; native/web consumers are still being implemented.

Errors include `statusCode`, stable `code`, user-facing `message`, optional validation `details`, query-free `path`, UTC `timestamp` and server-generated `requestId`. The same correlation ID is returned in `x-request-id`; arbitrary caller IDs are not trusted. Internal errors never expose exception messages or query strings. Health is liveness only, not a dependency-readiness guarantee.

## Shared formats and future contracts

| Schema | Purpose | Implementation boundary |
| --- | --- | --- |
| `capability-report.schema.json` | Original Phase 0 local agent startup report | No-argument command prints disabled collectors; explicit Phase 5 commands start the shared core |
| `device-capabilities.v1.schema.json` | Per-feature status/reason, source, setup steps, action availability and check/report times | Implemented for authenticated device health/capability reports; no usage-measurement ingestion yet |
| `measurement.v1.schema.json` | Event/workspace/device IDs, source/version, interval, UTC times, units, measured/estimated quality and optional application ID | Future monitoring ingestion |
| `service-permissions.v1.schema.json` | Server-evaluated viewing/control rights for a paired agent | Future control authorization; capabilities cannot grant these rights |
| `service-command.v1.schema.json` | Typed stop/force-stop command, target identity, request time and expiry | Future remote execution, never arbitrary shell input |
| `local-ipc.v1.schema.json` | Typed local status/list/stop request envelope | Future service-control design; active setup IPC uses v2 |

All examples in `fixtures/` are synthetic. They do not establish real monitoring support. Unsupported/permission/setup states expose no executable actions. Command checks enforce a positive lifetime of at most 60 seconds; real execution must additionally check current time, current authorization, duplicate state and the actual process identity. Measurement intervals must be positive, collection cannot precede the interval end, and serialized timestamps must be UTC with a `Z` suffix.

## Versioning and compatibility

Use UUIDs for server-issued workspace/device/agent/event/service/command identifiers. Installation IDs remain separate opaque strings. Preserve source observation/collection time separately from later ingestion time. Do not derive endpoint identity from IP address or process ID alone.

API breaking changes require a new major URI version. Breaking event/IPC shape changes require a new schema filename/ID and `schemaVersion`; do not repurpose the legacy startup report. Existing strict schemas are immutable after adoption unless the change is demonstrably compatible; adding required fields or enum values may break older validators. Clients handle unknown capabilities/statuses as unavailable. Revisit client code generation after endpoint contracts stabilize; no native bindings are claimed generated here.

## Checks

```sh
npm ci --ignore-scripts
npm run check
npm test
```

AJV compiles all JSON Schemas/API components and validates fixtures. Additional checks enforce time, identity uniqueness and capability invariants. The OpenAPI checks cover component compilation, local references and operation structure; they are not a full external OpenAPI conformance linter. `backend/scripts/check-api.mjs` tests actual responses against the specified operation/status schemas using an isolated PostgreSQL database.

The root `check:scaffolds` remains a lightweight file/configuration check, separate from full schema validation and native build verification.

Phase 3 implements the mobile-authenticated measurement batch endpoint and scoped usage/report, retention, manual network label, alert and notification APIs (64 total documented operations). `measurement-batch.v1.schema.json` is a bounded synchronization envelope. Current configuration publishes retry guidance; native persistent queues remain later work. Router/Go-agent sources in the generic observation schema are rejected by the mobile endpoint until their separate authenticated paths exist. See `../docs/features/monitoring.md` for semantic limits and availability.

## Monitoring maintenance

Phase 3 supplies `npm --prefix backend run monitoring:work -- WORKSPACE_UUID` as a one-pass operator command. Deployment must enumerate workspaces and schedule recurring evaluation/delivery/retention passes with failure/backlog monitoring. Each retention pass is bounded to 1,000 rows per store; repeat to catch up. No scheduler/service is installed by application startup. Workspace locks serialize concurrent ingestion, evaluation, scope changes and cleanup.

Android/iOS push providers remain unconfigured and report unavailable. Configure secure token registration, provider idempotency, credentials and bounded network timeouts in the native delivery phase before enabling real push. No provider traffic is generated by current checks. Review `docs/features/monitoring.md` for retention defaults, synchronization metadata retention, renewed disclosure requirements and backup/client-deletion limitations.

## Web dashboard connection

Phase 4 requires the dashboard server to reach `NETSENTRY_API_URL` and an exact `DASHBOARD_ORIGIN` matching the user's HTTPS browser origin. No JWT signing or encryption secret is copied into the dashboard; tokens remain HTTP-only cookies and backend authorization remains authoritative. See `dashboard/README.md` for cookie names, body/download limits, timeouts and the current shared-IP rate-limit consideration. Configure reviewed trusted ingress and rate policies before a multi-user rollout; do not solve it by forwarding arbitrary client-controlled IP headers.

The dashboard CI job runs Webpack/Tailwind/PostCSS production builds and desktop Chromium tests against isolated PostgreSQL. It is verification only and does not deploy the site, start monitoring daemons, configure paid services or install mobile platforms.

## Agent operations

Apply the Phase 5 agent-identity migration explicitly after backup and schema checks. Account JWTs, mobile-device credentials and Go-agent credentials are separate. Terminate HTTPS at trusted ingress and retain throttling/body limits; the agent refuses redirects and untrusted TLS. The browser gateway intentionally cannot redeem agent codes or proxy opaque-agent routes.

Schedule `npm --prefix backend run agents:cleanup -- WORKSPACE_UUID` for each workspace to remove diagnostic rows older than seven days and expired ten-minute enrolment codes, at most 1,000 rows from each store per pass. Repeat bounded passes if a backlog remains; monitor failures. API startup installs no scheduler. Erasure immediately removes owned enrolment-code details and diagnostics, while retaining the minimal revoked identity/generation. Account deletion cascades owned agent records. Unpairing on a computer removes local credentials; workspace revocation invalidates copied credentials and is a separate API action.

Deploy the Go core as an explicit foreground development process now. Do not register a LaunchAgent/service automatically. Release packaging must supply independently pinned signing keys, code signing/notarization, a protected monotonic-release high-water mark and tested atomic upgrade/rollback before automatic updates are enabled. See [agent setup](../agent/README.md), [service/package decision](../docs/architecture/agent-distribution.md) and [Phase 5 validation](../docs/validation/phase-5.md). Production Windows/Linux secure-service support remains pending.

## Phase 7 remote developer maintenance

Apply the tenth migration before enabling remote developer features. Existing `agents:cleanup` additionally removes commands older than seven days (with cascading audit), at most 1,000 per pass, and clears stored service summaries older than sixty seconds. Schedule it per workspace and monitor backlog/failures. Reads hide reports after fifteen seconds independently. Deployment must provide HTTPS and protected agent secret storage. No inbound agent port is needed. See [remote authorization and execution](../docs/architecture/remote-service-commands.md).

Phase 8 estimated allowance rules still require scheduled `monitoring:work` evaluation/delivery; Android upload does not run the worker automatically. Each rule uses exactly one source quality. The Kotlin API check uses temporary test-only TLS material and synthetic OS data, not a production TLS configuration or native device validation.

## Phase 9 application history

Apply the eleventh reviewed migration. `monitoring:work` additionally expires application_windows using raw retention and application_days using aggregate retention, at most 1,000 rows/store/pass. Repeat bounded passes to clear backlog. Current bounded metadata catalogs persist until device/account erasure. New missing-report rules depend on this existing evaluation/delivery schedule; API/Android startup installs no server scheduler. Detailed history requires the separate app-usage-v1 consent record. See the advanced Android architecture for limits and pending device checks.
