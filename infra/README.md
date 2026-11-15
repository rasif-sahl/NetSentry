# Infrastructure

Phase 0 does not start services, provision cloud resources or install containers/databases.

The existing backend expects PostgreSQL; see `backend/.env.example` for configuration. Copy it to a private `backend/.env` only when preparing a local database. Generate independent JWT secrets; never commit real credentials.

Versioned migrations, database lifecycle, deployment manifests, backup/restore and environment provisioning belong in Phase 1 and later operational work. No database schema is changed by these scaffolds.
