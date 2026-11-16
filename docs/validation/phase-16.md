# Phase 16 first increment: themes and email opt-in

Scope selected by the user: complete missing theme support and prepare opt-in alert emails while keeping delivery disabled. Other optional Phase 16 extensions remain deferred. Phase 15 native/hardware acceptance remains pending.

## Implemented source

- Android applies SYSTEM/LIGHT/DARK account preferences to Material 3 and provides explicit appearance choices. Saving appearance preserves reduced-motion settings. Kotlin account operations remain serialized and scoped; sign-out clears the prior account view.
- Desktop adds a local appearance selector, validated nonsecret persistence, OS system-theme updates, open-window synchronization, blocked-storage fallback, dark controls/dialogs and system reduced-motion CSS. This creates no agent authority or account session.
- Web/iOS retain their existing account theme support. Web, Android and iOS add default-off email opt-in. Web alert rules can select the email channel alongside existing channels; native preferences do not change existing rule channels automatically.
- Backend migration seventeen adds the false-default email preference. Older clients omitting email preserve a prior choice. Preferences responses expose `emailDeliveryAvailable: false`. The email adapter has no transport and always reports `EMAIL_DELIVERY_DISABLED`; SMTP/account-mail configuration cannot turn it on. No email recipient entry, inbox access/sorting or live delivery is added.
- Existing access, quiet hours, rule, opt-out, erasure and maintenance boundaries remain. Opted-out deliveries suppress; opted-in eligible email deliveries become explicitly unavailable and do not replay later. Future real transport requires a separate task and review.

## Verification

- Root source/build checks pass: scaffolds, release-helper tests, deployment/package tests, 162 API operations, 14 synthetic fixtures, Android contracts/source, 27 Swift files/project/privacy parsing, backend build, desktop TypeScript/renderer build, dashboard lint and production build. Final targeted checks pass **21 contract tests** and **70 backend tests across 17 suites**.
- PostgreSQL checks pass seventeen migrations, metadata parity, constraints/cascades, rollback, drift refusal and data-preserving baseline adoption. New migration: `AlertEmailPreference1794840000000`. Down migration removes new email history/channel metadata and disables email-only rules before dropping the new column.
- Actual API/PostgreSQL checks cover default false, opt-in, availability false, strict invalid-input rejection, old-client updates preserving opt-in, four channel choices, disabled delivery status/code, no replay, opt-out suppression and rule-history cascade removal. Existing full authorization/privacy/domain regressions and controlled outbound Go/network runner checks pass. No email transport or real message is used.
- **28 dashboard browser scenarios** pass in existing desktop Chrome. New coverage verifies account theme persistence, email preference persistence and visible disabled-delivery status. A new-test navigation selector was corrected; the full suite then passed.
- Actual Chromium desktop-renderer checks pass system media changes, explicit theme override, actual dark background, reload persistence, cross-window sync, blocked localStorage and narrow layout. Electron/Keychain runtime and packaging remain separate pending gates.
- Existing standalone Kotlin compilation/core/reducer/wire checks pass, with eighteen Kotlin source files parsed. Kotlin HTTPS/API/PostgreSQL integration saves the DARK account preference, saves/reads email opt-in and preserves it when omitted by older callers. Compose/Android APIs and physical devices remain unverified.
- Existing host Swift Foundation tests and HTTPS/API/PostgreSQL integration pass with email opt-in/read, unavailable delivery and old-caller preservation checks. SwiftUI/iOS builds and phone behavior remain pending.
- Actual encrypted PostgreSQL backup/empty-target restore and restored schema parity pass with seventeen migrations; nonempty/tampered recovery rejects. All records are synthetic, and temporary recovery artifacts are removed.

No mobile SDK, Android Studio, Xcode, simulator or emulator was installed. Flutter is unchanged. No scheduler, provider, background service, production schema or paid account was provisioned. Account verification/password-reset mail code is unchanged and was not used to send real messages.

## Design stack check

The web dashboard uses **Tailwind CSS 4.3.3** from the installed dependency, imported in `dashboard/src/app/globals.css`, configured through `dashboard/postcss.config.mjs` and mapped to CSS tokens via `@theme`. It also uses custom dashboard CSS; the interface is not exclusively Tailwind utilities. Desktop is React/TypeScript with ordinary CSS, Android is Compose/Material 3, and iOS is SwiftUI. No Tailwind conversion of native/desktop interfaces was requested or performed.

## Rollout

Apply migration seventeen explicitly before this backend. Keep alert email delivery disabled; there is no configuration switch enabling its transport in this increment. Account opt-in alone does not select email on rules or send messages. Do not advertise working email delivery, native builds or device acceptance from these checks. See [architecture](../architecture/themes-and-alert-email.md) and the Phase 15 handoff for remaining release evidence.
