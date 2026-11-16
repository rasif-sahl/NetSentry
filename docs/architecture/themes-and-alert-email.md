# Phase 16 themes and opt-in alert email

This increment is the user-selected Phase 16 scope. Windows/Linux/Docker/WSL expansion, more routers, AI, YouTube, Enterprise and Business notification integrations remain separate future decisions. Phase 15 native/hardware acceptance stays pending; Flutter remains preserved.

## Appearance

Web and iOS already honor the account's SYSTEM/LIGHT/DARK preference. Android now uses that same preference for its Material 3 color scheme and provides explicit choices in settings; account changes/logout naturally remove the prior account's preference from the view. Saving a theme preserves the current reduced-motion preference. No SDK or native build is installed/performed here.

The Electron renderer has no account session, so its appearance is explicitly local to this computer. It stores only a validated SYSTEM/LIGHT/DARK choice in localStorage, follows OS changes in SYSTEM mode, synchronizes open windows and remains usable when storage is blocked. No credentials or monitoring preferences are stored there, and theme selection touches no agent IPC or consent. CSS covers dark surfaces, controls/dialogs and system reduced-motion settings. Native Electron/OS accessibility acceptance remains pending.

The web dashboard uses **Tailwind CSS 4** through `@import "tailwindcss"`, `@tailwindcss/postcss` and `@theme` tokens, together with custom dashboard CSS. It is not a utility-only implementation. Desktop uses React/TypeScript with ordinary CSS; Android uses native Jetpack Compose/Material 3; iOS uses SwiftUI. This task verifies the design stack and does not convert those platform interfaces to Tailwind.

## Email preferences and disabled delivery

Migration seventeen adds `notification_preferences.email`, default false. Account opt-in is independent of in-app/push preferences; each alert rule must also explicitly choose the `email` channel. Older clients omitting the optional email request field preserve an existing choice. Export/erasure uses the existing account-scoped preference lifecycle. No arbitrary recipient address, email connection, inbox access or sorting is added.

All clients state that alert-email delivery is disabled. `emailDeliveryAvailable` is false in the preferences response. The email adapter always returns `unavailable` / `EMAIL_DELIVERY_DISABLED`; it has **no transport** and cannot be activated by SMTP environment settings or an account-mail worker. Existing verification/password-reset mail code remains separate and unchanged. No real messages are sent by this work.

Existing evaluation/delivery workers continue checking current workspace/role/device scope, rule state, quiet hours and preferences. With no opt-in, email delivery is suppressed. With opt-in, an eligible email rule records an explicit unavailable attempt. It is terminal and does not automatically replay if a provider is added later. Changing a preference never sends a test email or creates a new alert by itself. In-app delivery continues independently.

Adding a transport later requires a separate explicit task: provider choice, verified current recipient/consent and authorization rechecks, minimal message contents, guarded secret configuration, delivery-outside-long-transaction design, bounded timeouts/retries, SMTP acceptance versus inbox-delivery semantics, duplicate/uncertain-result handling, opt-out and erasure races, deployment/mail privacy review and actual authorized delivery tests. Current preferences are readiness for that task, not a working live email service.

## Migration and rollout

Apply all seventeen migrations explicitly before this backend; readiness requires exact migration parity. `AlertEmailPreference1794840000000` adds the opt-in with false default. Down migration removes email delivery history/channel selections, disables email-only rules and removes the preference column so older code never reads an unknown channel. Existing non-email channels/data remain. Do not downgrade without reviewing this loss of new metadata.

Scheduled monitoring work remains necessary. No scheduler, mail transport, provider credentials, paid account, daemon or production schema is provisioned. Native source/core/HTTPS verification remains separate from Android/SwiftUI native builds and physical-device acceptance.
