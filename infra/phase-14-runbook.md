# Phase 14 operational runbook

These are explicit operator procedures, not a deployment performed by development. Keep database URLs, encryption/signing keys, JWT keys, provider credentials and backup files out of Git/logs. Use private configuration and independently managed keys. Container image builds/runtime and production infrastructure remain pending acceptance.

## Deployment

1. Build/test the checked-in commit with Node 24 and existing dependencies. Inspect `backend/.env.example`, `dashboard/.env.example` and deployment notes. Production uses `BILLING_MODE=disabled`; sandbox is rejected in production. Enforcement defaults to pre-release evaluation, visibly labeled in clients. Review feature/capacity effects before setting `BILLING_ENFORCEMENT=true`.
2. Back up and rehearse restoration. Apply all seventeen versioned migrations explicitly with the existing backend migration CLI; API startup never applies them. Inspect metadata parity before rollout. Phase 14 adds `BillingOperations1794830599789`; the Phase 16 opt-in migration is `AlertEmailPreference1794840000000`.
3. Build `infra/backend.Dockerfile` and `infra/dashboard.Dockerfile` from repository root, providing `--build-arg SERVER_NODE_IMAGE=node@sha256:<reviewed-Node-24-image-digest>`. Pin resulting backend/dashboard image digests in private deployment configuration. No floating image default is supplied. Images are separate from mobile/agent builds and contain no SDKs.
4. Provide `BACKEND_IMAGE`, `DASHBOARD_IMAGE`, `SERVER_ENV_FILE`, `DASHBOARD_ENV_FILE`, `SERVER_SECRET_DIR` to `docker compose -f infra/compose.yaml`. Supply digest-qualified images. Private backend env may reference `/run/secrets/...` through `DATABASE_URL_FILE`, `DATABASE_SSL_CA_FILE`, `JWT_ACCESS_TOKEN_SECRET_FILE`, `JWT_REFRESH_TOKEN_SECRET_FILE`, `ACCOUNT_MAIL_ENCRYPTION_KEY_FILE`, `ROUTER_CREDENTIAL_ENCRYPTION_KEY_FILE`. The runtime loads only its fixed secret allowlist. Files must be readable by UID 10001 and inaccessible to unrelated users. Avoid mounting extra secrets.
5. Use external PostgreSQL with verified TLS and a trusted HTTPS ingress. Listeners bind host loopback; never expose raw HTTP ports publicly. Configure exact dashboard origin/API URL, request/body/time limits and reviewed client-IP/rate policies. Smoke-test both read-only container filesystems, readiness and cookie flows before any rollout. The source validation/Compose parse is not this runtime test. Verify Next.js runtime cache/write requirements under the intended workload before enabling features that write caches.
6. `/api/v1/ready` returns 503 on missing/drifted migrations or DB failure; health remains liveness. Monitor scheduled workers separately. Keep existing monitoring, agent, network, Family and Business bounded maintenance jobs, plus `npm --prefix backend run operations:work`. Schedule externally, monitor failures/backlog and repeat bounded batches after downtime. No scheduler/service is installed by startup.

## Encrypted recovery

The Node 24 CLI wraps installed matching-major PostgreSQL `pg_dump`/`pg_restore`; it installs nothing. Set `PG_BIN_DIR` if tools are outside PATH. `PG_CONTAINER` is an optional existing PostgreSQL container ID for the isolated CI test, not permission to mount a host Docker socket into the application. Supply a private regular non-symlink `BACKUP_KEY_FILE` containing exactly 32 random bytes, mode 0600. Back up this key separately; loss makes backups unrecoverable. Keep the independent router encryption key separately as well.

Use private environment variables `DATABASE_URL`, `DATABASE_SSL=true`, and `PGSSLROOTCERT` for the PostgreSQL tools' trusted CA file. If a private CA is required, also set `DATABASE_SSL_CA` PEM for the Node preflight connection. Do not put credentials in command arguments. Outside isolated `NODE_ENV=test` databases ending `_test`, verified TLS is mandatory. Database URLs with query parameters are rejected.

```sh
node infra/scripts/backup.mjs backup /private/backup/new-backup.netsbk
# Provision a separate EMPTY database; never restore over the live database.
# Set RESTORE_DATABASE_URL privately to that database.
node infra/scripts/backup.mjs restore /private/backup/new-backup.netsbk exact_empty_database_name
```

Backup output is created exclusively with mode 0600 and AES-256-GCM authentication. Restore authenticates the complete backup into a temporary private file before executing database SQL. It refuses a nonempty database and uses single-transaction restore; temporary plaintext is deleted afterwards. Use an encrypted temporary volume for operational recovery. Restrict access while restoring; no other writer should use the target. Verify migrations, counts, critical relations, account access and relevant synthetic application flows in isolation before a separately reviewed cutover. Database credentials, TLS, router keys, mail/push credentials and deployment configuration are not recreated by a database dump.

`npm run test:recovery` requires an explicitly empty `TEST_DATABASE_URL` ending `_test`, creates a separate `netsentry_phase14_restore_test` database and removes it afterwards. It verifies actual dump, encrypted bytes, restore/schema parity, wrong-tag rejection and nonempty refusal using synthetic data. It is not proof of production backup scheduling, remote storage, retention or disaster recovery time.

## Signed release candidates

The release helper packages an existing artifact; it never downloads, installs or executes it. Use an offline Ed25519 PEM private key file with mode 0600, separately pinned raw 32-byte public key (base64), reviewed increasing integer release, semantic version, supported target and a new output directory. CLI expiry is seven days (library maximum thirty).

```sh
# RELEASE_PRIVATE_KEY_FILE is a private environment variable.
node infra/scripts/release.mjs package /private/build/netsentry-agent /private/releases/candidate 42 0.1.0 darwin arm64
# RELEASE_PINNED_PUBLIC_KEY and RELEASE_HIGH_WATER_FILE are configured privately.
node infra/scripts/release.mjs verify /private/releases/candidate darwin arm64 42
```

Verification checks signature, canonical manifest, target, expiry, digest and minimum release. Configure a protected per-target `RELEASE_HIGH_WATER_FILE` to reject rollback/reuse across invocations; without it only the supplied minimum applies. Acceptance advances a **verified-candidate** counter, not an installed-version claim. Keep its parent private and back it up consistently. Lock or `.new` files left by an interrupted write fail closed; inspect them and the last accepted release before manual recovery. Never delete state simply to accept an older candidate.

The test suite verifies interoperability with the existing Go verifier when `TEST_AGENT_BINARY` names the existing test binary. Synthetic artifact tests do not establish OS code signing/notarization or valid installers. Production requires protected root pin distribution, code signing, platform packaging, tested atomic replacement/rollback and supported-host acceptance. No automatic updater, LaunchAgent/service or production signing key is created here.
