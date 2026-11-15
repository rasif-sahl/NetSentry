# Deployment foundation

Phase 1 defines topology and checks; it does not deploy services, provision cloud accounts, start a permanent database or install mobile tooling.

## Environments and topology

Keep local development, disposable tests, staging and production separate, with distinct databases and credentials. Clients/agents connect through a TLS HTTPS API entry point. Keep PostgreSQL on a private network with certificate verification enabled. A reverse proxy terminates public TLS; restrict trust-proxy settings explicitly when configuring real deployment, so client IP/rate limits cannot be spoofed.

Run reviewed migrations as an explicit deployment step with a suitably scoped migration role, then run the application with a less privileged runtime database role. Startup never synchronizes or runs migrations automatically. Back up and verify restoration before a production schema change. The initial migration needs the uuid-ossp extension, which can be provisioned by the administrator. Do not reverse the populated baseline to roll back an application release; use compatible application rollback and verified backups.

Use UTC for the backend process and database sessions, and explicit workspace timezones for reports. Secrets come from environment/managed secret storage, never committed environment files. Production requires verified database TLS and explicit HTTPS CORS origins. A configured CA is separate from permissive TLS; certificate errors must fail rather than disabling verification.

## Runtime and health

`GET /api/v1/health` reports process liveness only. Future readiness checks must verify the database, migration level and required background dependencies without exposing credentials. Design separate worker processes when ingestion/retention/alerts need jobs; no queue/provider is installed or claimed implemented now. API handlers and workers share idempotency rules and a versioned contract.

Expose structured request/operation correlation, error-rate/latency, rejected-ingestion counts, source freshness, agent disconnects, job retries, retention backlog and notification failures as those domains arrive. Keep metrics free of payloads/secrets and avoid high-cardinality device identifiers as labels. Set deployment scale/freshness/SLO targets before load testing and autoscaling decisions.

## Packaging and release

Build and verify backend/web/desktop artifacts separately. Package signed Electron/Go artifacts per OS/architecture; native app signing/distribution is a later explicitly prepared environment. No mobile SDK/simulator installation exists in this repository's check workflow. Production promotion requires passing applicable contracts, migration, authorization, build and actual-device/hardware acceptance checks.

Choose hosting, key management, notification/job providers, signing identities, update distribution and backup retention before their production features launch. No provider account, paid resource or production secret is assumed to exist.
