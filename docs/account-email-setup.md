# Account email setup

NetSentry queues email verification and password reset messages in an encrypted PostgreSQL outbox. A separate delivery command sends them over SMTP. The dashboard's confirmation that a message was requested means it was queued. Email delivery has its own configuration and does not affect monitoring alert delivery.

## SMTP settings

Get the host, port, username and password from the **SMTP** settings of your test inbox or transactional email provider. In production, verify the sending domain or address in your provider's dashboard and use a sender it authorizes.

| Variable | Value |
| --- | --- |
| `MAIL_ENABLED` | Set to `true` in the environment of the delivery process. |
| `SMTP_HOST` | SMTP hostname from the provider. |
| `SMTP_PORT` | Provider port. Defaults to `587` with STARTTLS. Use `465` for TLS from the start of the connection if your provider specifies it. |
| `SMTP_USER` | SMTP username supplied by the provider. |
| `SMTP_PASSWORD` | SMTP credential supplied by the provider. |
| `SMTP_FROM` | Sender email address shown in the message. |
| `PUBLIC_APP_URL` | Browser origin used to build the verification and reset links. Use `http://localhost:3001` for the default local stack and the public dashboard's HTTPS origin in production. |
| `ACCOUNT_MAIL_ENCRYPTION_KEY` | Independent base64-encoded 32-byte key. Generate it with `openssl rand -base64 32` when setting up a new environment. Use the same key in the API and delivery process. |

The SMTP server must support authenticated connections with TLS 1.2 or later and present a trusted certificate. Keep SMTP credentials in private server-side configuration.

## Local development

Start PostgreSQL, apply the backend migrations, and start the backend and dashboard using the [local setup guide](project-setup.md#local-setup). Use a test SMTP inbox so development messages are captured there. For example, in Mailtrap Email Sandbox, open **Email Testing → Sandboxes → My Sandbox → Integration → SMTP** and copy the connection settings. [Mailtrap SMTP setup](https://docs.mailtrap.io/email-sandbox/setup/sandbox-smtp-integration)

Add the SMTP settings to `backend/.env`, keeping the database settings and mail encryption key from the local backend setup. This example uses Mailtrap's sandbox host and port.

```dotenv
MAIL_ENABLED=true
PUBLIC_APP_URL=http://localhost:3001
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_sandbox_username
SMTP_PASSWORD=your_sandbox_password
SMTP_FROM=netsentry@example.com
```

1. Sign in to Workspaces and click **Send verification email**. To test recovery, request a password reset for a dedicated test account instead.
2. From the repository root, run `npm --prefix backend run mail:deliver`. The command builds the backend and processes up to 20 queued jobs.
3. Open the message in the sandbox inbox. For verification, follow the link and click **Verify email**, then return to Workspaces and click **I’ve verified my email**.

## Production

Set up a transactional SMTP provider with a verified sending domain or address. Set `PUBLIC_APP_URL` in the private backend environment to the live dashboard origin, for example `https://netsentry.example.com`. Keep the SMTP settings in a separate private file for the delivery job, such as `/etc/netsentry/account-mail.env` with mode `0600`. Put `MAIL_ENABLED=true` and the five `SMTP_*` settings from the table in that file.

The supplied Compose deployment runs account cleanup. Schedule SMTP delivery separately against the same migrated database and mail encryption key as the API. The job needs access to PostgreSQL over verified TLS and outbound access to the provider's SMTP port.

For the [standard production image](project-setup.md#deploy-to-production), run the compiled CLI with the reviewed backend image digest and the same private backend environment and secret mount used by the API. Set `BACKEND_IMAGE` and `SERVER_SECRET_DIR` to the values in your private deployment configuration and adjust the environment file paths below for your host. Use plain `NAME=value` lines for the Docker environment files. The Node launcher loads the mounted database and application secrets before the CLI starts.

```sh
docker run --rm --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  --env-file /etc/netsentry/backend.env \
  --env-file /etc/netsentry/account-mail.env \
  --env NODE_ENV=production --env DATABASE_SSL=true --env DB_SYNCHRONIZE=false \
  --mount "type=bind,source=$SERVER_SECRET_DIR,target=/run/secrets,readonly" \
  --entrypoint node "$BACKEND_IMAGE" --input-type=module -e '
    import { loadSecrets, secretKeys } from "./infra/runtime-lib.mjs";
    const env = await loadSecrets(process.env);
    for (const key of secretKeys) {
      if (env[key] !== undefined) process.env[key] = env[key];
      delete process.env[key + "_FILE"];
    }
    await import("./dist/mail/other/deliver-cli.js");
  '
```

Run the job once with a controlled test account before scheduling it. Check that the message arrives, the link points to the public HTTPS origin, and the verification or password reset completes in the browser. Then configure a scheduler to run the batch regularly and report nonzero exit codes. Each run handles up to 20 jobs. Choose the interval based on queue volume and how quickly users need their emails.

## Troubleshooting

- **The CLI reports a configuration or processing error.** Check that `MAIL_ENABLED=true`, the SMTP fields are populated, the provider accepts the sender, and the job can reach both SMTP and PostgreSQL. Check the database settings and confirm the mail key matches the API's key. The CLI reports a generic failure to keep credentials and message contents out of logs.
- **The command completes but the inbox is empty.** Confirm you requested the message and that the job uses the same database as the API. Check the sandbox, spam folder, or provider delivery logs. The reported count includes discarded jobs, such as expired messages.
- **The link is invalid or expired.** Request a new message and use the newest link. Verification links expire after 24 hours and password reset links after 30 minutes. A new request replaces the previous link for the same action.
