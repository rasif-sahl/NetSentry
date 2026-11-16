# Infrastructure

Phase 0 does not start services, provision cloud resources or install containers/databases.

The existing backend expects PostgreSQL; see `backend/.env.example` for configuration. Copy it to a private `backend/.env` only when preparing a local database. Generate independent JWT secrets; never commit real credentials.

Versioned migrations, database lifecycle, deployment manifests, backup/restore and environment provisioning belong in Phase 1 and later operational work. No database schema is changed by these scaffolds.

Network operations: apply migration twelve explicitly, store the independent router encryption key outside PostgreSQL and schedule `networks:work -- <workspace-uuid>` at least once per minute. Each run removes up to 1,000 expired rows per network history table; catch up with repeated batches. Back up the key separately; losing/rotating it requires configuring router credentials again. Deploy no inbound LAN proxy or backend-to-router connector. See [network architecture](../docs/architecture/network-monitoring.md).

Family operations: migration thirteen is explicit. Schedule `family:work -- <workspace-uuid>` to remove up to 1,000 requests older than thirty days and 1,000 family events older than ninety days per run; repeat cleanup batches after downtime. No scheduler, restriction service or managed-device provisioning is installed.

Phase 14 adds container source, encrypted PostgreSQL recovery and signed release-candidate verification. Follow [the operational runbook](phase-14-runbook.md); image runtime, production hosting and signing are separate acceptance gates.

Phase 15 adds [deployed runtime/router/recovery acceptance](../docs/release/network-and-operations-testing.md). Compose parsing, fixture recovery and offline package verification remain separate from production runtime, hardware and installer acceptance.
