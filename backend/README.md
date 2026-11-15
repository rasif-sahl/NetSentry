# NetSentry API

NestJS/TypeScript and PostgreSQL account, session, workspace and registered-device foundation. Business, monitoring, Family and remote-control APIs are delivered in later phases.

## Local configuration

Use Node.js 24 and the pinned dependency lockfile. Copy `.env.example` to `.env`, set `DATABASE_URL`, and replace both JWT secrets with independent values of at least 32 characters. Use explicit HTTP origins for local CORS. Runtime configuration is validated before database startup.

```sh
npm ci --ignore-scripts
npm run migration:run
npm run start:dev
```

The default API base is `/api/v1`. PostgreSQL must already be available; these commands do not provision it. `DATABASE_SSL=true` enables certificate verification; provide `DATABASE_SSL_CA` for a private CA. Connection-string SSL query parameters are rejected so they cannot override the explicit TLS policy. Production requires TLS and HTTPS CORS origins. `DB_SYNCHRONIZE` defaults to false and is rejected outside development when true. Application startup never runs migrations automatically.

## Database lifecycle

Back up an existing database before schema changes. Commands load the local `.env` without printing its contents. Migration CLI connections always disable schema synchronization and automatic extension installation. The initial migration explicitly creates `uuid-ossp` if absent; a database administrator may need to provision this extension first. Database sessions use UTC.

```sh
npm run migration:show
npm run migration:run
npm run db:check
```

For a schema originally created by development synchronization, applying the initial migration directly is refused. First back up the database, then run:

```sh
npm run db:check
npm run db:adopt
```

Adoption records only the initial migration after an exact entity-schema comparison, preserving application rows. It refuses schema drift or multiple migration definitions. Do not use `--fake` to bypass this verification. `db:check` reports differences without applying them; investigate differences explicitly rather than enabling synchronization on a populated database.

Generate future migrations with `npm run migration:generate -- src/database/migrations/MeaningfulName`, review SQL and test against an isolated database. `npm run migration:revert` reverses the latest migration; reversing the initial baseline drops application tables and their data, including an adopted schema. Restore from a verified backup rather than reverting a populated baseline.

## Verification

```sh
npm run build
npm test -- --runInBand
```

With an existing PostgreSQL server and a dedicated empty database whose name ends in `_test`:

```sh
TEST_DATABASE_URL=postgresql://localhost/netsentry_test npm run test:database
```

This test refuses nonempty application schemas or migration history. It creates only test fixtures, verifies migration/schema agreement, database constraints/cascades, rollback and data-preserving adoption, then removes its fixture tables through rollback. Never point it at a real application database. It does not install PostgreSQL, mobile SDKs, emulators or other platform tooling.

## API contract verification

The shared OpenAPI specification is `../contracts/openapi/api.v1.json`. Error codes and response correlation are configured identically in application startup and API checks. With the contracts dependencies prepared and a separate empty test database:

```sh
TEST_DATABASE_URL=postgresql://localhost/netsentry_api_test npm run test:api
```

`npm run test:e2e` aliases this same integration check, replacing the original starter test that did not exercise the configured API.

This runs a loopback API server with fixture accounts, validates actual responses against OpenAPI component/operation schemas, and checks request validation, workspace isolation, device ownership, refresh rotation and session revocation. It rolls back its fixture schema afterward. It does not contact mobile devices or external notification services.
