# Phase 2 verification

Date: 15 November 2026. Implementation is on develop with separate feature commits, pushed to origin/develop. This phase delivers backend APIs, persistence, shared contracts and access/privacy rules. Web/native client screens and physical-device validation remain in their client phases.

## Delivered features

| Area | Implemented behavior |
| --- | --- |
| Account verification | Transactional verification token/outbox creation, request/reissue, expiry, purpose checking and single-use consumption |
| Password recovery | Consistent public acknowledgement, reset expiry/replay checks, concurrent single winner, password replacement and session revocation |
| Sessions and profile | Active-account checks, serialized refresh rotation, session list/revoke/other-session logout, activity timestamps, display name and typed notification/theme preferences |
| Account mail | AES-256-GCM encrypted outbox with row identity binding, SMTP adapter requiring TLS, explicit delivery command, bounded attempts/leases, stale-message discard and expiry cleanup |
| Workspaces | Verified shared-workspace creation, manual-share invitations, exact recipient matching, expiry/revocation, member/permission listing, selection and membership lifecycle |
| Ownership and roles | Owner-only elevated grants, explicit owner transfer, owner-leave protection, incoming/outgoing invitation cancellation and credential revocation after access loss |
| Device pairing | One-time account/workspace/installation-bound codes, verified-account requirement, opaque hashed installation credentials, rotation and disabled legacy direct registration |
| Device lifecycle | Rename, pause, consent/revoke, unenrol, remove, configuration, last synchronization and reported health/version metadata |
| Capabilities | Runtime validation against the shared schema, identity/time checks, unsupported-action rejection and stored report provenance |
| Consent and permission history | Server-authored actor/time/generation records, disclosure version/hash, selected scopes and permission/battery reports |
| Device erasure | Owned-data deletion even after workspace departure, credential revocation, generation advance and a minimal deletion tombstone |
| Personal export | Fresh-password confirmation, consistent snapshot, own records only, sensitive-field exclusion, actor masking and export history |
| Account deletion | Fresh password and DELETE confirmation, stable reference locks, shared-owner safeguards, transactional cascades and invalidation of credentials |
| Database upgrades | Four new migrations after the identity baseline, frozen-baseline adoption, preserved historical user/device records and no silent verification/monitoring enablement |
| Contracts | OpenAPI v1.2.0 describing 46 operations, including the deprecated direct-registration rejection path |

## Local results

- Backend compilation and type-aware lint passed.
- Nine backend unit suites passed: 36 tests.
- Shared JSON Schema/OpenAPI component checks and all six synthetic fixtures passed.
- Eight contract regression tests passed.
- Disposable PostgreSQL checks passed for clean migration, schema agreement, uniqueness/cascades, complete rollback, drift refusal, baseline adoption and incremental upgrade with historical records.
- Live API/schema checks passed for account actions, wrong-purpose/expired/used tokens, concurrent reset/refresh, session activity/revocation, inactive accounts and strict nested preference input.
- Workspace checks passed for recipient binding, expiry/replay/revocation, role-escalation attempts, ownership transfer, departure, selection cleanup and denial after removal. Removed members cannot rejoin with older pending invitations.
- Device checks passed for code replay/expiry, takeover prevention, separate bearer contexts, credential rotation, generation changes, capability attribution, consent/history, data erasure and membership/credential revocation.
- Privacy checks passed for password confirmation, cross-user isolation, secret exclusion, shared-owner refusal, preserved other-user records, actual SQL deletion and invalidated user/device credentials.
- Account messages were delivered only to a mocked sender. No external emails, live router scans, native collectors or process-control commands were executed.
- Android, iOS, Flutter, desktop and Go source are unchanged by Phase 2. No mobile SDK, Android Studio, emulator, simulator or Xcode was installed.

The checks use already-installed PostgreSQL in a disposable loopback cluster with empty databases ending in _test. No project/production database is used. The temporary PostgreSQL service has been shut down after verification.

## Hosted verification

All five source feature/maintenance commits passed the Foundation checks workflow. The final code run [43710190832](https://github.com/rasif-sahl/NetSentry/actions/runs/43710190832), for commit eabcbc9, passed all three jobs, including session-activity/refresh-race, expiry-cleanup and populated-legacy upgrade checks. The workflow checks backend/contracts against disposable PostgreSQL, desktop compilation and the existing Go scaffold. It installs no mobile tooling and performs no application deployment.

## Operational and client prerequisites

- Set an independent base64-encoded 32-byte ACCOUNT_MAIL_ENCRYPTION_KEY before backend startup. Never reuse JWT secrets for encryption.
- Configure SMTP, a sender and the public client URL, then explicitly enable/run mail delivery for real email acceptance. Verification/reset client screens are not delivered in this backend phase. No production delivery is claimed without provider acceptance.
- Schedule accounts:cleanup even while SMTP is disabled, so expired action tokens and encrypted messages do not remain indefinitely. Delivery and cleanup are explicit backend commands; no persistent scheduler/service is installed here.
- Back up before migration. Frozen-baseline adoption marks only the identity baseline; run current migrations afterward. Phase 2 adds owner/registrant foreign keys and refuses inconsistent orphan references rather than deleting or guessing ownership.
- Old accounts remain email-unverified and old installations UNVERIFIED with monitoring off until explicit confirmation/enrolment.
- Pairing establishes installation/account possession, not hardware attestation. Reported health/capability metadata is not independent device certification.
- MonitoringEnabled is a user setting, not a claim that measurement is supported or active. Usage ingestion, collectors, family policies, organization profiles, routers and desktop service execution remain later phases.
- Physical Android/iOS permission/background/signing tests, actual SMTP acceptance and device-side revocation/erasure behavior remain pending their configured environments. Existing Flutter reference files are preserved.
