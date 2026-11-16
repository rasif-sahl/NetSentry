# Phase 11 verification and device handoff

Implemented on `develop`, 16 November 2026. No mobile SDK, Android Studio, emulator, simulator or Xcode installation. Flutter is preserved; iOS source work remains Phase 12.

## Source delivered

- Family profiles with icon avatars/age bands, existing invitations, explicit guardian grants, child account linkage, network labels and device-owner sharing consent.
- Generation/profile-revision invalidation, scoped child dashboards/timeline and privacy/erasure integration.
- Versioned policy intent for daily/app/category limits, bedtime/study/weekend schedules, temporary pauses, allowed/restricted apps and domain/category selections.
- Warnings, synchronized unsupported/failure states, immutable child requests, guardian decisions/direct exceptions, expiry and action history.
- Consent-filtered weekly/day/app/category reports, deterministic suggestions, education/entertainment comparisons, evidence/confidence and feedback.
- Web family workflows and Android family views, device-policy synchronization, consent withdrawal and request/approval source.
- Fail-closed Android/router adapter boundaries. Current mechanisms cannot execute restrictions; no receipt can claim `applied`.

## Verification boundaries

Root checks cover 124 API operations, 14 synthetic fixtures, 18 contract tests, 50 backend unit tests and backend/web/desktop production builds plus dashboard lint. PostgreSQL checks cover thirteen migrations, schema parity, rollback, cascades and data-preserving baseline adoption.

Live API scenarios use synthetic actors/data to check invitations/current roles, profile isolation, cross-workspace denial, device-owner consent, source generations/revisions, unsupported receipts and rejection of forged applied status, policy conflicts, requests/decisions/expiry, exception invalidation, consent-date exclusion, app/category evidence, privacy projection, linked-child account erasure preserving guardian-owned devices, and bounded retention. Existing Go/native controlled-process integrations remain regression checks; no router or family restriction is executed.

Pure policy tests cover missing usage, threshold warnings, overnight weekend wrap, exclusive boundaries, both DST repeated hours, exact override expiry, disabled rules and invalid/contradictory input. Browser scenarios cover child-to-assigned-guardian approval, viewer isolation, owner edits and the existing account/device/network/developer workflows. Fixtures are explicitly synthetic.

SDK-free Kotlin tests cover 31 personal repository checks, 14 advanced reducer checks, family generation/unsupported-receipt checks and parsing all sixteen Kotlin source files. Kotlin HTTPS integration exercises real API/PostgreSQL family consent, an unsupported phone receipt, child time request and guardian approval alongside existing personal/remote flows. Pure JVM checks and syntax parsing do not type-check Compose/framework calls or establish a native APK build.

## Pending and unavailable

Consumer Android UsageStats access does not authorize other-app suspension. The router adapter is read-only. There is no executing restriction adapter, native policy notification delivery, managed-device provisioning, app suspension, network pause or domain filtering in this release. Separate platform authority/provisioning, a supported mechanism and physical tests are required before those actions can be implemented/enabled and described as applied. See [family architecture](../architecture/family-wellbeing.md).

Native Android build/signing, Compose type checking, real-device consent/identity changes, permission withdrawal, UI/accessibility, background/Doze/reboot, clock/timezone transitions, privacy/retention under long outages and push/notifications remain pending physical checks. iOS authorization/entitlements/framework behavior follows Phase 12. Age bands/account linkage do not verify a child or legal guardian. No SDK or simulator was installed to bypass these gates.

Apply migration thirteen explicitly and schedule bounded `family:work` cleanup; no deployment or scheduler is provisioned by these commits. Reconsent devices after profile or device-generation changes. Family reports begin with the first complete post-consent local day; they do not retroactively expose existing personal history. Guardian legacy report/alert scope is narrowed deliberately to prevent bypass of the new child grants.
