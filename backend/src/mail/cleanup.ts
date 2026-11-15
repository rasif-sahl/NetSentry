import { DataSource, LessThanOrEqual } from 'typeorm';
import { AccountAction } from '../auth/account-action.entity';
import { MailOutbox } from './mail-outbox.entity';

// This maintenance path requires no SMTP connection or decryption key.
export async function cleanupAccountMail(source: DataSource) {
  return source.transaction(async (manager) => {
    const now = new Date();
    const messages = await manager.delete(MailOutbox, {
      expiresAt: LessThanOrEqual(now),
    });
    const actions = await manager.delete(AccountAction, {
      expiresAt: LessThanOrEqual(now),
    });
    return {
      messagesRemoved: messages.affected ?? 0,
      actionsRemoved: actions.affected ?? 0,
    };
  });
}
