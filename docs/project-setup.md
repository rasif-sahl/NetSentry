# NetSentry project setup

## Local setup

Run the commands from the repository root on the `develop` branch. The core development stack is PostgreSQL, the NestJS API and the Next.js website/dashboard. Use Git, Node.js 24 (the exact version is in [`.nvmrc`](../.nvmrc)), its bundled npm, PostgreSQL 17 (the version used by CI), the PostgreSQL command-line tools, and OpenSSL. The Go agent, Electron desktop app and native clients have separate prerequisites below.

### Install dependencies

Each Node project has its own lockfile. Install backend and dashboard dependencies for the web stack, plus contracts dependencies for the shared schema checks.

```sh
npm --prefix backend ci --ignore-scripts
npm --prefix dashboard ci --ignore-scripts
npm --prefix contracts ci --ignore-scripts
```

### Set up PostgreSQL and the environment

1. Start a local PostgreSQL server on port 5432. As a local database administrator, create a dedicated login role and a database owned by that role. Run the following once on a fresh instance, using your administrator connection settings if needed.

   ```sh
   createuser --login --pwprompt netsentry
   createdb --owner=netsentry netsentry
   ```

   The first migration enables the `uuid-ossp` extension. The migration role needs permission to create it, or a database administrator can install it in advance in the `netsentry` database.

2. On a fresh checkout, create the local configuration files from the templates. If you already have these files, edit them in place.

   ```sh
   install -m 600 backend/.env.example backend/.env
   install -m 600 dashboard/.env.example dashboard/.env.local
   ```

3. Edit `backend/.env`. Use the password you set for the database login, URL-encoding special characters in the connection string. Generate a fresh value for each JWT secret and a separate mail encryption key. Paste the values into the private file.

   ```sh
   openssl rand -base64 48
   openssl rand -base64 48
   openssl rand -base64 32
   ```

| File | Variable | Local configuration |
| --- | --- | --- |
| `backend/.env` | `DATABASE_URL` | PostgreSQL connection URL, for example `postgresql://netsentry:PASSWORD@localhost:5432/netsentry`. |
| `backend/.env` | `DATABASE_SSL`, `DATABASE_SSL_CA` | Use `false` for an isolated local server without TLS. For TLS, use `true` and supply the PEM CA if needed. |
| `backend/.env` | `NODE_ENV`, `DB_SYNCHRONIZE` | Use `development` and `false`. Apply migrations explicitly. |
| `backend/.env` | `PORT`, `API_PREFIX` | Keep `3000` and `api` for the commands below. |
| `backend/.env` | `CORS_ORIGINS`, `PUBLIC_APP_URL` | Use the exact browser origin `http://localhost:3001` for both. |
| `backend/.env` | `JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET` | Set two distinct random secrets, each at least 32 characters. |
| `backend/.env` | `ACCOUNT_MAIL_ENCRYPTION_KEY` | Set an independent base64-encoded 32-byte key. The API needs it even with SMTP disabled. |
| `backend/.env` | `ROUTER_CREDENTIAL_ENCRYPTION_KEY` | Required for local router configuration. Generate it independently with `openssl rand -base64 32`. |
| `backend/.env` | `MAIL_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Leave mail disabled for ordinary development. To exercise verification and password recovery, configure a test SMTP inbox, set `MAIL_ENABLED=true`, and run `npm --prefix backend run mail:deliver` to deliver queued account mail. The default SMTP port is `587`. |
| `backend/.env` | `BILLING_MODE`, `BILLING_ENFORCEMENT`, `BILLING_EVENT_SECRET` | Keep `disabled` and `false` for ordinary development. Set a separate secret of at least 32 characters only if using the optional local billing sandbox. |
| `dashboard/.env.local` | `NETSENTRY_API_URL` | Server-only API base `http://127.0.0.1:3000/api/v1`. |
| `dashboard/.env.local` | `DASHBOARD_ORIGIN` | Exact browser origin `http://localhost:3001`. Use that hostname in your browser. |

### Migrate, start and verify

Apply migrations to the local development database before starting the API.

```sh
npm --prefix backend run migration:run
npm --prefix backend run db:check
npm run dev:backend
```

Run the dashboard in a second terminal from the repository root.

```sh
npm run dev:dashboard
```

Open the homepage at `http://localhost:3001` and the workspace at `http://localhost:3001/app`. Check API liveness and database/schema readiness separately.

```sh
curl --fail --silent --show-error http://127.0.0.1:3000/api/v1/health
curl --fail --silent --show-error http://127.0.0.1:3000/api/v1/ready
```

Run `npm run check` for the repository checks after preparing the desktop dependencies below as well. For database, API and dashboard integration checks, create a separate empty database owned by the local test role. Its name must end in `_test`. Set `TEST_DATABASE_URL` and, for isolated local PostgreSQL without TLS, `TEST_DATABASE_SSL=false` in your test shell. Run `npm run test:database`, `npm run test:api` and `npm run test:dashboard` separately. The dashboard suite needs an existing compatible Chromium browser or the `PLAYWRIGHT_CHROME_EXECUTABLE` override for an existing Chrome executable. Test data is synthetic. See [database test configuration](../backend/.env.test.example) and the [dashboard test instructions](../dashboard/README.md#checks).

### Optional clients and tooling

| Component | Local setup |
| --- | --- |
| Go agent | Use Go 1.23+ and run `npm run test:agent` from the root. From `agent/`, build with `GOTOOLCHAIN=local go build -o /tmp/netsentry-agent ./cmd/netsentry-agent`. Use the documented loopback-only development credential store against the local HTTP API. The macOS Keychain path requires existing Command Line Tools and a trusted HTTPS API. See the [agent README](../agent/README.md). |
| Desktop | Run `npm --prefix desktop ci --ignore-scripts` and `npm run build:desktop`. Run `npm --prefix desktop run dev:renderer` for the browser renderer on `http://127.0.0.1:5173`. The native bridge requires an existing Electron runtime. For agent connection settings and native launch, see the [desktop README](../desktop/README.md). |
| Android | Run `npm run check:android` for source/contract checks. The pending native build uses JDK 17, Gradle 8.11.1 and Android SDK API 35 on a separately prepared host. See the [Android build and signing handoff](../android/README.md#build-and-signing-handoff--pending). |
| iOS | Run `npm run check:ios` for source checks. The host Swift checks use existing Apple Command Line Tools. The pending native build targets iOS 17+ and needs a separately prepared compatible Xcode host and signing configuration. See the [iOS build and signing handoff](../ios/README.md#targets-and-later-physical-device-handoff). |
| Flutter | `mobile/` is the preserved reference. The Android and iOS clients live in the root `android/` and `ios/` directories. |

The local web stack requires no mobile tooling. Keep native build, signing and physical-device checks pending until they run on a prepared host. The native clients need a reachable, trusted HTTPS API ending in `/api/v1`.

## Deploy to production

The repository provides an operator-run Docker Compose deployment for a single Linux host running the backend, dashboard, maintenance worker and nginx HTTPS ingress. Prepare Docker with the Compose plugin, Node.js 24 for the deployment CLI, an image registry, external PostgreSQL with verified TLS and the `uuid-ossp` extension, a DNS name, and its trusted certificate chain and private key. Provide PostgreSQL roles for the application, migrations and backup as appropriate to the host and database provider. CI verifies the deployment on disposable infrastructure. Live hosting, DNS, registry and certificates are operator-provided. See the [production runbook](../infra/production/README.md) and [deployment verification record](validation/production-deployment.md).

### Build and publish images

Build both images from the same reviewed commit. Replace the example values with your registry, release tag and reviewed base image digest before running these commands.

```sh
SERVER_NODE_IMAGE='node@sha256:REPLACE_WITH_REVIEWED_NODE_24_DIGEST'
RELEASE_REPOSITORY='registry.example.invalid/netsentry'
RELEASE_TAG='REPLACE_WITH_REVIEWED_COMMIT'

docker build -f infra/backend.Dockerfile --build-arg SERVER_NODE_IMAGE="$SERVER_NODE_IMAGE" -t "$RELEASE_REPOSITORY/backend:$RELEASE_TAG" .
docker build -f infra/dashboard.Dockerfile --build-arg SERVER_NODE_IMAGE="$SERVER_NODE_IMAGE" -t "$RELEASE_REPOSITORY/dashboard:$RELEASE_TAG" .
docker push "$RELEASE_REPOSITORY/backend:$RELEASE_TAG"
docker push "$RELEASE_REPOSITORY/dashboard:$RELEASE_TAG"
```

Record the published digests and the source commit. Pin the backend, dashboard and a reviewed nginx image by digest. Make sure the deployment host can pull them.

### Production environment variables

Copy the templates for [deployment.env](../infra/production/deployment.env.example), [backend.env](../infra/production/backend.env.example) and [dashboard.env](../infra/production/dashboard.env.example) to private files outside the checkout, for example under `/etc/netsentry`. Use mode `0600` and replace the placeholders. Supply application credentials in separate files inside `SERVER_SECRET_DIR`. The backend and maintenance containers read them from `/run/secrets`.

| File | Variable | Required | Value or purpose |
| --- | --- | --- | --- |
| `deployment.env` | `COMPOSE_PROJECT_NAME` | Yes | Stable project name, for example `netsentry-production`. |
| `deployment.env` | `BACKEND_IMAGE`, `DASHBOARD_IMAGE`, `INGRESS_IMAGE` | Yes | Reviewed image references in `repository@sha256:digest` form. |
| `deployment.env` | `SERVER_ENV_FILE`, `DASHBOARD_ENV_FILE` | Yes | Absolute host paths to the private backend and dashboard environment files. |
| `deployment.env` | `SERVER_SECRET_DIR` | Yes | Absolute host path to the private directory mounted at `/run/secrets`. |
| `deployment.env` | `TLS_CERT_DIR` | Yes | Absolute host path to the directory containing `fullchain.pem` and `privkey.pem`. |
| `deployment.env` | `INGRESS_CONFIG_FILE` | Yes | Absolute host path where `render-ingress` writes the nginx configuration. |
| `deployment.env` | `PUBLIC_HOST` | Yes | Public DNS hostname, for example `netsentry.example.com`. Use only the hostname. |
| `deployment.env` | `HTTPS_BIND_ADDRESS` | Yes | Use `127.0.0.1` behind a front proxy or load balancer on the host. Use `0.0.0.0` for direct IPv4 ingress with a configured host firewall. HTTPS uses port 443. |
| `backend.env` | `PORT`, `API_PREFIX` | Yes | Keep `3000` and `api`. The ingress routes `/api/v1/` to the API. |
| `backend.env` | `DATABASE_URL_FILE` | Yes | For example `/run/secrets/database-url`. File contains the PostgreSQL connection URL without SSL query overrides. |
| `backend.env` | `DATABASE_SSL_CA_FILE` | If needed | For example `/run/secrets/database-ca`. File contains the database CA in PEM format if the default trust store cannot validate it. Remove the template entry if unused. |
| `backend.env` | `JWT_ACCESS_TOKEN_SECRET_FILE`, `JWT_REFRESH_TOKEN_SECRET_FILE` | Yes | Paths to separate files under `/run/secrets`, each holding a unique secret of at least 32 characters. |
| `backend.env` | `ACCOUNT_MAIL_ENCRYPTION_KEY_FILE`, `ROUTER_CREDENTIAL_ENCRYPTION_KEY_FILE` | Yes | Paths to separate files under `/run/secrets`, each holding an independently generated base64-encoded 32-byte key. Back these keys up separately from the database. |
| `backend.env` | `CORS_ORIGINS`, `PUBLIC_APP_URL` | Yes | Both must equal `https://PUBLIC_HOST` with your real hostname and no trailing slash. |
| `backend.env` | `API_RATE_LIMIT` | Optional | Defaults to `120`. Dashboard requests share the proxy address for rate limiting. Check behavior under intended load. |
| `backend.env` | `JWT_ACCESS_TOKEN_TTL`, `JWT_REFRESH_TOKEN_TTL_DAYS` | Optional | Defaults are `15m` and `30` days. |
| `backend.env` | `BILLING_MODE`, `BILLING_ENFORCEMENT` | Mode required | Use `disabled` and keep enforcement `false` for the supplied baseline. |
| `dashboard.env` | `NETSENTRY_API_URL` | Yes | Set exactly `http://backend:3000/api/v1` for server-to-server traffic inside Compose. |
| `dashboard.env` | `DASHBOARD_ORIGIN` | Yes | Set to the same exact `https://PUBLIC_HOST` used in the backend configuration. |

Compose supplies `NODE_ENV=production`, `DATABASE_SSL=true` and `DB_SYNCHRONIZE=false` for the backend. Keep secret values out of the deployment environment files and Git. Use regular, non-symlink secret files readable by container UID/GID `10001:10001`, for example UID-10001-owned mode `0400` or root-owned, group-10001 mode `0440`. Make the mounted directories traversable by that runtime group, for example root:10001 mode `0750`. Supply certificate files directly in the TLS directory, with private key access limited to its owner and runtime group. Arrange certificate renewal and an ingress restart. The backend and dashboard HTTP ports stay on host loopback.

### Migrate, start and verify the deployment

Run these commands from the reviewed checkout on the Linux host. On first deploy, render the ingress config to a new file. For upgrades, reuse a matching config or render a changed configuration to a new path. Before applying migrations, take a fresh encrypted backup and demonstrate a restore to a separate empty database.

```sh
node infra/scripts/deployment.mjs render-ingress /etc/netsentry/deployment.env
node infra/scripts/deployment.mjs check /etc/netsentry/deployment.env
node infra/scripts/deployment.mjs migrate /etc/netsentry/deployment.env APPLY_REVIEWED_MIGRATIONS
node infra/scripts/deployment.mjs start /etc/netsentry/deployment.env
node infra/scripts/deployment.mjs status /etc/netsentry/deployment.env
```

The migration command applies the release's eighteen versioned migrations. Startup checks schema parity, waits for container health and checks the public HTTPS homepage and API endpoints `/api/v1/health` and `/api/v1/ready`. Open `https://PUBLIC_HOST/app` in a browser with the real hostname and verify sign-in, secure cookies and a workspace request. A failed smoke check can leave the stack running with migrations already applied. For breaking migrations, drain traffic and stop the API and maintenance worker before migration, and plan recovery against a compatible schema.

The Compose maintenance service covers monitoring, retention, agent, network, Family, Business, account cleanup and operations tasks. Check its health with the deployment `status` command. The stack does not deliver SMTP account mail. For verification and password recovery email in production, arrange a separately operated account-mail delivery process with private SMTP credentials. Alert email and live billing remain disabled in the supplied deployment.

### Backup and client release

For scheduled encrypted database backups, provision a dedicated identity and private persistent storage, then copy [backup.env.example](../infra/production/backup.env.example) to a mode-`0600` host file. Use matching-major PostgreSQL dump/restore tools. The [backup runbook](../infra/production/README.md#backup-scheduling-and-recovery) covers the systemd templates, monitoring and empty-database recovery.

| File | Variable | Required | Value or purpose |
| --- | --- | --- | --- |
| `backup.env` | `NODE_ENV`, `DATABASE_SSL` | Yes for production | Use `production` and `true`. |
| `backup.env` | `DATABASE_URL_FILE` | Yes | Private host-side file containing the backup role's PostgreSQL URL without query parameters. |
| `backup.env` | `DATABASE_SSL_CA_FILE`, `PGSSLROOTCERT` | If needed | Trusted CA path for the Node database check and PostgreSQL tools, respectively. |
| `backup.env` | `BACKUP_KEY_FILE`, `BACKUP_DIR` | Yes | Independent 32-byte binary encryption key in a private file, and a private mode-`0700` backup directory. |
| `backup.env` | `PG_BIN_DIR` | If needed | Directory for matching-major PostgreSQL tools if they are outside `PATH`. |
| `backup.env` | `BACKUP_KEEP_COUNT`, `BACKUP_MAX_AGE_HOURS` | Optional | Defaults are seven snapshots and a 36-hour health threshold. Keep at least two snapshots. |
| Private restore environment | `RESTORE_DATABASE_URL_FILE` | For recovery | File containing the URL of a separate, empty restore target. |

Desktop/agent packaging and Android/iOS signing are separate release workflows. Point clients to `https://PUBLIC_HOST/api/v1` after the deployment is reachable. For signed artifacts and pending physical validation, use the [desktop packaging guide](../desktop/packaging/README.md) and the [release acceptance guide](release/README.md).
