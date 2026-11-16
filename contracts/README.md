# Shared contracts

Backend, Kotlin, Swift, Go and TypeScript clients use language-neutral schemas. Platform source and generated client bindings stay with their applications. No mobile build tool is needed to check these contracts.

## Implemented API

`openapi/api.v1.json` describes the 74 documented account, workspace, device, agent, health, privacy, monitoring and notification operations (including disabled legacy registration) at the default `/api/v1` base. It includes request/response schemas, bearer authentication, path parameters, status codes and structured errors. The deployment base URL and prefix remain configurable. The legacy starter root response is not a product API.

POST responses retain NestJS's existing 201 status. Session refresh revokes the previous session. Personal workspaces are created at signup; manual PERSONAL creation returns 403. Existing optional input fields accept null where their DTO uses `IsOptional`. Direct legacy device registration is disabled. One-time enrolment returns a separate opaque device credential; capability/permission history and reported metadata use scoped lifecycle endpoints. Capability declarations never grant permissions. The pre-release API is v1.5.0; native/web consumers are still being implemented.

Errors include `statusCode`, stable `code`, user-facing `message`, optional validation `details`, query-free `path`, UTC `timestamp` and server-generated `requestId`. The same correlation ID is returned in `x-request-id`; arbitrary caller IDs are not trusted. Internal errors never expose exception messages or query strings. Health is liveness only, not a dependency-readiness guarantee.

## Shared formats and future contracts

| Schema | Purpose | Implementation boundary |
| --- | --- | --- |
| `capability-report.schema.json` | Original Phase 0 local agent startup report | No-argument command prints disabled collectors; explicit commands start the Phase 5 core |
| `device-capabilities.v1.schema.json` | Per-feature status/reason, source, setup steps, action availability and check/report times | Implemented for authenticated device health/capability reports; mobile ingestion requires separate consent, permission, current generation and supported OS measurement capability |
| `measurement-batch.v1.schema.json` | Bounded offline envelope, batch UUID, generation, observations and explicit gaps | Mobile device-authenticated batch endpoint; native persistent buffers pending |
| `measurement.v1.schema.json` | Event/workspace/device IDs, source/version, interval, UTC times, units, measured/estimated quality and optional application ID | Mobile-authenticated observation ingestion; router/agent paths remain future work |
| `service-permissions.v1.schema.json` | Server-evaluated viewing/control rights for a paired agent | Future control authorization; capabilities cannot grant these rights |
| `service-command.v1.schema.json` | Typed stop/force-stop command, target identity, request time and expiry | Future remote execution, never arbitrary shell input |
| `local-ipc.v1.schema.json` | Typed local status/list/stop request envelope | Future service-control design; active setup transport uses v2 |

The active Phase 5 local transport uses `local-auth.v1.schema.json` (handshake/vector definitions), `local-ipc.v2.schema.json` (typed setup requests) and `local-ipc-response.v2.schema.json` (status/errors). HMAC bytes are shared between Go and Node tests. These schemas enable pairing/preferences only; the older stop-command schema does not authorize execution. Agent HTTP uses separate `agentTokenAuth`, excluded from the browser gateway. See [protocol](../docs/architecture/agent-protocol.md).

All examples in `fixtures/` are synthetic. They do not establish real monitoring support. Unsupported/permission/setup states expose no executable actions. Command checks enforce a positive lifetime of at most 60 seconds; real execution must additionally check current time, current authorization, duplicate state and the actual process identity. Measurement intervals must be positive, collection cannot precede the interval end, and serialized timestamps must be UTC with a `Z` suffix.

## Versioning and compatibility

Use UUIDs for server-issued workspace/device/agent/event/service/command identifiers. Mobile installation IDs remain separate opaque strings; Phase 5 agent installation IDs are locally generated UUIDs. Preserve source observation/collection time separately from later ingestion time. Do not derive endpoint identity from IP address or process ID alone.

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

Phase 5 adds separate agent enrolment/configuration/heartbeat/diagnostic-sync APIs. Only enumerated diagnostic codes are accepted; generic traffic/process observations are still rejected. Revocation, generations, privacy and bounded retention apply independently of mobile-device ingestion.

Phase 6 adds separately versioned `local-ipc.v3.schema.json` / `local-ipc-response.v3.schema.json` for local discovery, observation-bound graceful/force actions, project labels, action receipts and local consent. Earlier v1/v2 contracts are preserved. Phase 7 supersedes that local-only boundary with the remote HTTP components in OpenAPI 1.7.0. See [local controls](../docs/architecture/local-service-controls.md).

Phase 7 documents 86 HTTP operations and adds strict local IPC v4 remote-preference envelopes while preserving earlier versions. Current remote requests use `RemoteCommandInput`, not the earlier design-only service-command fixture. See [native mobile flow](REMOTE_MOBILE_FLOW.md) for request retry, expiry, cancellation, uncertainty and privacy rules. Native bindings/UI/device checks remain pending.

Phase 8 OpenAPI 1.8.0 keeps 86 operations and adds optional allowance-rule `quality` (measured default, estimated explicitly selected) plus quality-labelled threshold snapshots. Kotlin-emitted synthetic wire evidence is checked through `npm run check:android`; actual Kotlin repository/HTTPS adapters have separate JVM/API checks. Native compilation and physical-device acceptance remain pending.

Phase 9 adds `app-usage-batch.v1.schema.json`, detailed app consent/report/catalog routes and the `not_reporting` alert kind. OpenAPI is 1.9.0 (92 operations). Kotlin-emitted synthetic rich payloads are checked by `check:android`; strict schemas exclude activity classes/content/icons and bound arrays. Native event accuracy is not established by schema/JVM checks.
