import { DataSource, IsNull } from 'typeorm';
import nodemailer from 'nodemailer';
import { MailOutbox } from './mail-outbox.entity';
import { decryptMail } from './mail-crypto';
import { type AccountMail } from './mail.service';
import { AccountAction } from '../auth/account-action.entity';
import { hashToken } from '../auth/account-actions.service';

export type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
  messageId: string;
};
export type MailSender = (mail: OutgoingMail) => Promise<void>;

export function smtpSender(
  env: Record<string, string | undefined>,
): MailSender {
  if (env.MAIL_ENABLED !== 'true')
    throw new Error(
      'Mail delivery is disabled. Configure SMTP and explicitly set MAIL_ENABLED=true.',
    );
  for (const key of [
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
    'PUBLIC_APP_URL',
  ])
    if (!env[key]) throw new Error(`${key} is required for delivery.`);
  const appURL = new URL(env.PUBLIC_APP_URL!);
  if (
    !['https:', 'http:'].includes(appURL.protocol) ||
    appURL.username ||
    appURL.password ||
    (env.NODE_ENV === 'production' && appURL.protocol !== 'https:')
  )
    throw new Error(
      'PUBLIC_APP_URL must be an HTTP origin, using HTTPS in production.',
    );
  const port = Number(env.SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('SMTP_PORT is invalid.');
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return async (mail) => {
    await transport.sendMail({ from: env.SMTP_FROM, ...mail });
  };
}

export async function deliverOne(
  source: DataSource,
  key: string,
  appURL: string,
  send: MailSender,
): Promise<'sent' | 'discarded' | 'empty'> {
  const job = await source.transaction(async (manager) => {
    const row = await manager
      .getRepository(MailOutbox)
      .createQueryBuilder('mail')
      .addSelect('mail.encryptedPayload')
      .where(
        'mail.sentAt IS NULL AND mail.discardedAt IS NULL AND mail.attempts < 5',
      )
      .andWhere('(mail.claimedUntil IS NULL OR mail.claimedUntil < :now)', {
        now: new Date(),
      })
      .orderBy('mail.createdAt', 'ASC')
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getOne();
    if (!row) return null;
    row.claimedUntil = new Date(Date.now() + 120000);
    row.attempts++;
    await manager.save(row);
    return row;
  });
  if (!job) return 'empty';
  try {
    const payload = decryptMail(
      job.encryptedPayload,
      key,
      job.id,
    ) as AccountMail;
    const action = await source
      .getRepository(AccountAction)
      .findOneBy({
        userId: job.userId,
        tokenHash: hashToken(payload.token),
        purpose: payload.purpose,
        consumedAt: IsNull(),
      });
    if (
      job.expiresAt <= new Date() ||
      !action ||
      action.expiresAt <= new Date()
    ) {
      await source
        .getRepository(MailOutbox)
        .update(job.id, {
          discardedAt: new Date(),
          encryptedPayload: '',
          claimedUntil: null,
        });
      return 'discarded';
    }
    const link = new URL(
      payload.purpose === 'verify_email' ? '/verify-email' : '/reset-password',
      appURL,
    );
    link.hash = new URLSearchParams({ token: payload.token }).toString();
    await send({
      to: payload.to,
      subject:
        payload.purpose === 'verify_email'
          ? 'Verify your NetSentry email'
          : 'Reset your NetSentry password',
      text: `Open ${link.toString()} to continue. This single-use link expires at ${payload.expiresAt}. If you did not request it, ignore this message.`,
      messageId: `<${job.id}@netsentry.invalid>`,
    });
    await source
      .getRepository(MailOutbox)
      .update(job.id, {
        sentAt: new Date(),
        encryptedPayload: '',
        claimedUntil: null,
      });
    return 'sent';
  } catch {
    await source
      .getRepository(MailOutbox)
      .update(job.id, { claimedUntil: null });
    throw new Error(
      'Mail delivery failed; provider details and message contents are not logged.',
    );
  }
}
