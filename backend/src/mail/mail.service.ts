import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { MailOutbox } from './entity/mail-outbox.entity';
import { encryptMail } from './other/mail-crypto';

export type AccountMail = {
  to: string;
  purpose: 'verify_email' | 'reset_password';
  token: string;
  expiresAt: string;
};

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  async queue(
    manager: EntityManager,
    userId: string,
    payload: AccountMail,
  ): Promise<void> {
    const id = randomUUID();
    await manager.save(
      manager.create(MailOutbox, {
        id,
        userId,
        encryptedPayload: encryptMail(
          payload,
          this.config.getOrThrow<string>('ACCOUNT_MAIL_ENCRYPTION_KEY'),
          id,
        ),
        expiresAt: new Date(payload.expiresAt),
      }),
    );
  }
}
