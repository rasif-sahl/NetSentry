# Infrastructure

Phase 0 does not start services, provision cloud resources or install containers/databases.

The existing backend expects PostgreSQL; see `backend/.env.example` for configuration. Copy it to a private `backend/.env` only when preparing a local database. Generate independent JWT secrets; never commit real credentials.

Versioned migrations, database lifecycle, deployment manifests, backup/restore and environment provisioning belong in Phase 1 and later operational work. No database schema is changed by these scaffolds.

Network operations: apply migration twelve explicitly, store the independent router encryption key outside PostgreSQL and schedule `networks:work -- <workspace-uuid>` at least once per minute. Each run removes up to 1,000 expired rows per network history table; catch up with repeated batches. Back up the key separately; losing/rotating it requires configuring router credentials again. Deploy no inbound LAN proxy or backend-to-router connector. See [network architecture](../docs/architecture/network-monitoring.md).
