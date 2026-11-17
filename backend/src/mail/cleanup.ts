import { DataSource } from 'typeorm';
import { AccountAction } from '../auth/account-action.entity';
import { MailOutbox } from './mail-outbox.entity';

// This maintenance path requires no SMTP connection or decryption key.
export async function cleanupAccountMail(source: DataSource) {
  return source.transaction(async (manager) => {
    const now = new Date();
    const messages = await manager.query(
      'DELETE FROM mail_outbox WHERE id IN (SELECT id FROM mail_outbox WHERE "expiresAt"<=$1 ORDER BY id LIMIT 1000) RETURNING id',
      [now],
    );
    const actions = await manager.query(
      'DELETE FROM account_actions WHERE id IN (SELECT id FROM account_actions WHERE "expiresAt"<=$1 ORDER BY id LIMIT 1000) RETURNING id',
      [now],
    );
    return {
      messagesRemoved: Array.isArray(messages[0])
        ? messages[0].length
        : messages.length,
      actionsRemoved: Array.isArray(actions[0])
        ? actions[0].length
        : actions.length,
    };
  });
}
