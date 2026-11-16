# Production deployment and recovery

This is an operator-run single-host Linux/Docker Compose baseline with external PostgreSQL and supplied TLS certificates. No hosting, domain, production database, paid account or live provider is provisioned. Production billing remains disabled and alert email transport remains unavailable. Native/mobile tooling is unrelated and is not installed. Never use synthetic CI image tags, fixture credentials or test certificates for production.

## Prepare an immutable release

Build both Dockerfiles from the same reviewed commit with a reviewed Node 24 image digest supplied through `SERVER_NODE_IMAGE`. Push the resulting images to your chosen registry separately and record their immutable repository digests and commit. No image registry is selected or published to by these tools. CI resolves public tags once for disposable verification; those snapshots are not automatic production approval.

Copy the three `.env.example` files to private host paths outside Git. Set real immutable image references, project name, exact public DNS host and paths in `deployment.env`. Keep deployment/backend/dashboard environment files mode 0600. No secret value belongs in these files: use the fixed `_FILE` inputs and mounted secret directory. Required secrets include independent access/refresh signing secrets, base64 32-byte mail/router encryption keys and PostgreSQL URL; use a separate trusted CA file if needed. Never reuse a backup encryption key as an application key.

Provision mounted secrets as regular non-symlink files: runtime UID 10001 reads mode 0400 files owned by 10001, or root-owned mode 0440 files with group 10001. The directory must be traversable by this runtime group (for example root:10001 mode 0750). Environment/configuration may be owned by the operator and mode 0600. Startup rejects unsafe/ambiguous secret inputs and unknown application modes. Keep only application secrets in that mount. No Docker socket is mounted into any app.

Supply a trusted certificate chain as `fullchain.pem` and its private key as `privkey.pem` in the private TLS directory, readable by runtime UID/group 10001 with no other-user key access. Copy certificate material rather than mounting symlinks; arrange renewal and a reviewed ingress restart with your certificate provider. These tools do not obtain/renew certificates or change system trust. The HTTPS overlay defaults to host loopback port 443; use a reviewed front proxy/load balancer or explicitly choose `HTTPS_BIND_ADDRESS=0.0.0.0` and configure the host firewall. Backend/dashboard HTTP ports remain loopback-only. There is no public plain-HTTP listener/redirect.

The backend verifies PostgreSQL TLS; no `sslmode` URL override or insecure fallback is used. Restrict database network access to the server and recovery operator. Provision required PostgreSQL extensions/privileges with your provider before migrations. Back up the independent router/mail keys outside PostgreSQL; dumping encrypted rows does not restore those keys.

## Check, migrate and start

The CLI prints fixed operation results; it deliberately suppresses Docker logs and Compose expansion to avoid printing private inputs. Inspect logs locally under your operational access controls when a command fails. The wrapper verifies environment permissions, immutable references, exact origins, mount inputs and the generated ingress configuration before invoking Compose.

```sh
node infra/scripts/deployment.mjs render-ingress /etc/netsentry/deployment.env
node infra/scripts/deployment.mjs check /etc/netsentry/deployment.env
# After a fresh backup and a demonstrated restore into a separate database:
node infra/scripts/deployment.mjs migrate /etc/netsentry/deployment.env APPLY_REVIEWED_MIGRATIONS
node infra/scripts/deployment.mjs start /etc/netsentry/deployment.env
node infra/scripts/deployment.mjs status /etc/netsentry/deployment.env
```

Apply all **eighteen** migrations explicitly. The new eighteenth migration adds only bounded worker cursor/health metadata. No application startup runs migrations or schema synchronization. The migration command serializes cooperating migration jobs and rejects unknown release history. `schema-check` verifies exact migration names plus metadata parity before startup. An older image whose migration set no longer matches will fail readiness: do not assume swapping an old image is a safe database rollback.

Start waits for container health and runs a trusted HTTPS liveness/readiness/dashboard smoke check. A smoke failure does not undo already-applied migrations or stop/revert a partially rolled-out stack. Resolve the failure while preserving state; prefer a compatible forward fix. `stop` stops only this configured Compose project and never deletes database storage, volumes or backups. Save the previous manifest and separately rehearse a compatible rollback/recovery before release. For a breaking migration, drain incoming traffic and stop API/maintenance before migration; this baseline is not zero-downtime orchestration. Never run database schema reverts automatically to “repair” an outage.

The API, dashboard, worker and ingress run nonroot with read-only root filesystems, dropped capabilities and bounded temporary mounts. Next.js receives an explicitly writable ephemeral cache only; persistent/multi-replica caching and horizontal deployment require separate design. HTTPS ingress sets request/time limits and fixed forwarding headers. The backend intentionally does not trust arbitrary forwarded client IPs; dashboard requests still share its gateway IP for rate limiting. Tune and load-test this aggregate limit for the intended scale, or design authenticated ingress identity propagation separately. The smoke check does not establish cookie/login, multi-user load or operational scale acceptance; exercise those on the selected host.

## Scheduled maintenance

Compose explicitly starts one maintenance service alongside the API. It runs at most fifty workspace records per batch, once per minute, covering evaluation/delivery/retention, agent cleanup, network, Family and Business maintenance plus bounded global account-mail/operations cleanup. It does not send SMTP account mail, activate alert emails/push, or execute restrictions. Existing consent and authorization checks remain in each domain task.

A database keyset cursor resumes after the last completed workspace and wraps at the end. A shared session advisory lock prevents concurrent batches across replicas; interrupted work can replay domain operations, which retain their existing transaction/idempotency controls. Failures are counted, scoped failures go to existing diagnostics, and the private worker-state row records start/completion/success and progress. Health fails if no success exists, a batch failed or a success/running batch is stale beyond five minutes. DB trouble and a lost lock release fail closed. Monitor container health and alert externally; there is no configured pager provider. Large fleets may require changing batch cadence/limits after measuring backlog rather than claiming every workspace runs each minute. Shutdown drains the current batch until the container grace period, then normal container termination may interrupt it; the cursor resumes on restart.

## Backup scheduling and recovery

Use Node 24 plus matching-major PostgreSQL dump/restore tools on the backup host. Copy `backup.env.example` outside Git; use a dedicated least-privilege backup identity with read access to needed rows. Supply an independent random **32-byte binary** mode-0600 key file and private mode-0700 backup directory, owned by the backup service identity. Root-owned group-readable 0440 secret files may be used where configured for that identity. Keys and backup storage need independent recovery arrangements.

```sh
# Run in the private environment loaded by your service manager:
node infra/scripts/backup-cycle.mjs run
node infra/scripts/backup-cycle.mjs health
```

The cycle serializes with an exclusive local lock, streams an AES-GCM database dump, authenticates it without plaintext output and only then advances a private timestamp/digest receipt and prunes authenticated older snapshots. At least two snapshots must be retained (default seven). Unknown names, modified snapshots and old-key backups are never silently deleted. A failed cycle does not replace the previous successful receipt; monitor its exit status as well as backup health. Health checks receipt age (default 36 hours), file presence, private mode, size and digest. A valid encrypted backup is not a verified restore or an off-site copy. Use independently protected persistent/off-site storage selected by the operator and test loss of the primary host. This filesystem adapter does not provision/upload to a cloud provider.

The supplied systemd service/timer are reviewable templates, not installed or enabled by development. Create the dedicated OS identity, adjust Node/PG paths, provision protected storage and key permissions, inspect the units, then explicitly install/enable them on the chosen Linux host. The timer runs daily with catch-up after downtime. Configure monitoring for timer failures and stale backup health. A `.cycle.lock` or staging file left by abrupt termination requires operator inspection; do not delete locks automatically while a process might still be active. Keep prior key versions while retaining backups encrypted with them.

Restore only into a separately provisioned **empty** database, under exclusive recovery access, using the existing authenticated restore CLI and exact database-name confirmation. Entire ciphertext authentication precedes SQL, cooperating restores serialize, and SQL restore uses one transaction. Never restore over the live application database. Use an encrypted temporary volume because the verified dump is temporarily plaintext. Run this release's `schema-check`, inspect counts/critical relationships and run isolated account/consent workflows before separately switching the backend's database secret. The tools do not change DNS, repoint a live database or retire the original database. Record RPO/RTO from the selected environment; no timing/recovery target is certified yet.

See [the original recovery commands](../phase-14-runbook.md), [verification evidence](../../docs/validation/production-deployment.md), [Docker Compose service semantics](https://docs.docker.com/reference/compose-file/services/) and the installed Next.js self-hosting guide used for cache constraints.
