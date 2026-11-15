import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { User, AccountStatus } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { AccountAction } from './account-action.entity';
import { PasswordHasher } from './password-hasher';
import { Session } from './session.entity';

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AccountActionsService {
  constructor(
    private readonly source: DataSource,
    private readonly mail: MailService,
    private readonly passwords: PasswordHasher,
  ) {}

  async issue(
    manager: EntityManager,
    user: User,
    purpose: AccountAction['purpose'],
  ): Promise<void> {
    const now = new Date();
    await manager.update(
      AccountAction,
      { userId: user.id, purpose, consumedAt: IsNull() },
      { consumedAt: now },
    );
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      now.getTime() + (purpose === 'verify_email' ? 86400 : 1800) * 1000,
    );
    await manager.save(
      manager.create(AccountAction, {
        userId: user.id,
        purpose,
        tokenHash: hashToken(token),
        expiresAt,
      }),
    );
    await this.mail.queue(manager, user.id, {
      to: user.email,
      purpose,
      token,
      expiresAt: expiresAt.toISOString(),
    });
  }

  async requestVerification(userId: string) {
    await this.source.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId, status: AccountStatus.ACTIVE },
        lock: { mode: 'pessimistic_write' },
      });
      if (user && !user.emailVerifiedAt)
        await this.issue(manager, user, 'verify_email');
    });
    return { accepted: true };
  }

  async forgot(email: string) {
    await this.source.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: {
          email: email.trim().toLowerCase(),
          status: AccountStatus.ACTIVE,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (user) await this.issue(manager, user, 'reset_password');
    });
    return { accepted: true };
  }

  async confirm(
    token: string,
    purpose: AccountAction['purpose'],
    password?: string,
  ) {
    await this.source.transaction(async (manager) => {
      const candidate = await manager.findOneBy(AccountAction, {
        tokenHash: hashToken(token),
        purpose,
      });
      if (!candidate)
        throw new BadRequestException('This link is invalid or has expired.');
      // Always lock the account before action rows, matching reset/deletion ordering.
      const user = await manager.findOne(User, {
        where: { id: candidate.userId, status: AccountStatus.ACTIVE },
        lock: { mode: 'pessimistic_write' },
      });
      const action = await manager.findOne(AccountAction, {
        where: { id: candidate.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !user ||
        !action ||
        action.consumedAt ||
        action.expiresAt <= new Date()
      )
        throw new BadRequestException('This link is invalid or has expired.');
      action.consumedAt = new Date();
      await manager.save(action);
      if (purpose === 'verify_email') {
        user.emailVerifiedAt = new Date();
        await manager.save(user);
      } else {
        if (!password)
          throw new BadRequestException('A new password is required.');
        await manager.update(User, user.id, {
          passwordHash: await this.passwords.hash(password),
        });
        await manager.update(
          Session,
          { userId: user.id, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
        await manager.update(
          AccountAction,
          { userId: user.id, purpose: 'reset_password', consumedAt: IsNull() },
          { consumedAt: new Date() },
        );
      }
    });
    return purpose === 'verify_email' ? { verified: true } : { reset: true };
  }
}
