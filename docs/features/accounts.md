# Account verification and recovery

The backend implements email verification, password recovery, profile/display-name updates, notification/theme preferences and sign-out from other sessions. Native/web screens arrive in their client phases. Email address changes and arbitrary preference keys are not accepted through mass assignment.

Registration atomically creates the account, personal workspace, session and encrypted verification message. Tokens are random 256-bit values; account_actions stores only hashes. Verification lasts 24 hours; reset lasts 30 minutes. Replacement requests invalidate earlier tokens for that purpose. Consumption locks account then action, rejects expired/used/wrong-purpose tokens and has one winner under concurrency. Successful authenticated requests update session activity, and refresh rotation has one winner under concurrency. Reset revokes sessions; login/refresh/guards reject inactive accounts.

Recovery requests return the same accepted response for known/unknown addresses. Route throttles bound attempts; production should add distributed account-aware abuse controls before horizontal scaling. Responses do not expose action tokens. Security mail is independent of optional notification preferences.

Mail payloads use AES-256-GCM with the independent ACCOUNT_MAIL_ENCRYPTION_KEY, authenticated against the row ID. The API queues mail; delivery is opt-in. Configure SMTP, sender and public application URL, set MAIL_ENABLED=true and explicitly run mail:deliver. Stale/used/expired messages are discarded, and sent/discarded payloads are cleared. Jobs use leases, bounded attempts and stable message IDs; SMTP is at-least-once rather than guaranteed exactly-once. Drain/discard outstanding jobs before key rotation. Schedule `npm run accounts:cleanup` to remove expired tokens and encrypted messages even when delivery is disabled; this maintenance command requires no SMTP connection.

Links carry tokens in URL fragments rather than query strings. Verification/reset screens are delivered in later client phases. Real provider delivery requires credentials and a controlled acceptance test; implementation tests use a mocked sender and send no external email.

Tests cover encryption tampering/row binding, valid/replayed/expired/wrong-purpose tokens, concurrent reset, session revocation, inactive accounts, profile/preferences validation and mocked outbox delivery. Database checks cover migration rollback and frozen-baseline adoption followed by current migrations.

References: [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [SMTP TLS settings](https://nodemailer.com/smtp).
