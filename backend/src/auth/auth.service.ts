import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { User, AccountStatus } from '../users/entity/user.entity';
import {
  Membership,
  WorkspaceRole,
} from '../workspaces/entity/membership.entity';
import {
  Workspace,
  WorkspaceType,
} from '../workspaces/entity/workspace.entity';
import { PasswordHasher } from './other/password-hasher';
import { Session } from './entity/session.entity';
import { AccountActionsService, hashToken } from './account-actions.service';
import { PreferencesDto } from './dto/account.dto';

type SessionMetadata = { userAgent?: string; ipAddress?: string };

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly passwords: PasswordHasher,
    private readonly actions: AccountActionsService,
  ) {}

  async register(
    input: { email: string; displayName: string; password: string },
    metadata: SessionMetadata,
  ) {
    const email = input.email.trim().toLowerCase();
    try {
      return await this.dataSource.transaction(async (manager) => {
        const user = await manager.save(
          manager.create(User, {
            email,
            displayName: input.displayName.trim(),
            passwordHash: await this.passwords.hash(input.password),
            preferences: {
              theme: 'SYSTEM',
              reducedMotion: false,
              notifications: { inApp: true, push: true, email: false },
            },
          }),
        );
        const workspace = await manager.save(
          manager.create(Workspace, {
            name: 'My Network',
            type: WorkspaceType.PERSONAL,
            ownerId: user.id,
            timezone: 'UTC',
          }),
        );
        await manager.save(
          manager.create(Membership, {
            workspaceId: workspace.id,
            userId: user.id,
            role: WorkspaceRole.OWNER,
          }),
        );
        await this.actions.issue(manager, user, 'verify_email');
        return this.issueSession(manager, user, metadata);
      });
    } catch (error) {
      if (
        (error as { driverError?: { code?: string } }).driverError?.code ===
        '23505'
      )
        throw new ConflictException(
          'An account already exists for this email.',
        );
      throw error;
    }
  }

  async login(email: string, password: string, metadata: SessionMetadata) {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.email = :email', { email: email.trim().toLowerCase() })
        .setLock('pessimistic_write')
        .getOne();
      if (
        !user ||
        user.status !== AccountStatus.ACTIVE ||
        !(await this.passwords.verify(password, user.passwordHash))
      )
        throw new UnauthorizedException('Invalid email or password.');
      return this.issueSession(manager, user, metadata);
    });
  }

  async refresh(refreshToken: string) {
    const payload = await this.jwt
      .verifyAsync<{ sub: string; sid: string; type: string }>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_TOKEN_SECRET'),
      })
      .catch(() => {
        throw new UnauthorizedException('Invalid refresh token.');
      });
    if (payload.type !== 'refresh')
      throw new UnauthorizedException('Invalid refresh token.');
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: payload.sub, status: AccountStatus.ACTIVE },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new UnauthorizedException('Session expired.');
      const session = await manager
        .getRepository(Session)
        .createQueryBuilder('session')
        .addSelect('session.refreshTokenHash')
        .where('session.id = :id AND session.userId = :userId', {
          id: payload.sid,
          userId: user.id,
        })
        .setLock('pessimistic_write')
        .getOne();
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.refreshTokenHash !== hashToken(refreshToken)
      )
        throw new UnauthorizedException('Refresh session expired or reused.');
      session.revokedAt = new Date();
      await manager.save(session);
      return this.issueSession(manager, user, {
        userAgent: session.userAgent ?? undefined,
        ipAddress: session.ipAddress ?? undefined,
      });
    });
  }

  async profile(userId: string) {
    return this.safeUser(await this.users.findOneByOrFail({ id: userId }));
  }

  async updateProfile(userId: string, displayName: string) {
    await this.users.update(userId, { displayName: displayName.trim() });
    return this.profile(userId);
  }

  async preferences(userId: string, input: PreferencesDto) {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneOrFail(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      user.preferences = {
        ...user.preferences,
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.reducedMotion !== undefined
          ? { reducedMotion: input.reducedMotion }
          : {}),
        ...(input.notifications
          ? {
              notifications: {
                ...(user.preferences.notifications as
                  Record<string, boolean> | undefined),
                ...Object.fromEntries(Object.entries(input.notifications)),
              },
            }
          : {}),
      };
      await manager.save(user);
      return this.safeUser(user);
    });
  }

  listSessions(userId: string) {
    return this.sessions.find({
      where: { userId },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
      order: { lastUsedAt: 'DESC' },
    });
  }
  async revokeSession(userId: string, sessionId: string) {
    await this.sessions.update(
      { id: sessionId, userId },
      { revokedAt: new Date() },
    );
  }
  async revokeOthers(userId: string, sessionId: string) {
    await this.sessions.update(
      { userId, id: Not(sessionId), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { revoked: true };
  }

  private async issueSession(
    manager: EntityManager,
    user: User,
    metadata: SessionMetadata,
  ) {
    const sessionId = randomUUID();
    const days = this.config.get<number>('JWT_REFRESH_TOKEN_TTL_DAYS', 30);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, email: user.email, type: 'access' },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_TOKEN_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TOKEN_TTL', '15m'),
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, type: 'refresh' },
      {
        secret: this.config.getOrThrow('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: `${days}d`,
      },
    );
    await manager.save(
      manager.create(Session, {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 86400000),
        revokedAt: null,
        userAgent: metadata.userAgent?.slice(0, 512) ?? null,
        ipAddress: metadata.ipAddress ?? null,
      }),
    );
    return { accessToken, refreshToken, user: this.safeUser(user) };
  }

  safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      preferences: user.preferences,
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
    };
  }
}
