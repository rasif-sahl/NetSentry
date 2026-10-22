import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Membership, WorkspaceRole } from '../workspaces/membership.entity';
import { Workspace, WorkspaceType } from '../workspaces/workspace.entity';
import { PasswordHasher } from './password-hasher';
import { Session } from './session.entity';

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
  ) {}

  async register(
    input: { email: string; displayName: string; password: string },
    metadata: SessionMetadata,
  ) {
    const email = input.email.trim().toLowerCase();
    if (await this.users.exists({ where: { email } })) {
      throw new ConflictException('An account already exists for this email.');
    }

    const user = await this.dataSource.transaction(async (manager) => {
      const savedUser = await manager.save(
        manager.create(User, {
          email,
          displayName: input.displayName.trim(),
          passwordHash: await this.passwords.hash(input.password),
          preferences: { theme: 'SYSTEM', reducedMotion: false },
        }),
      );
      const workspace = await manager.save(
        manager.create(Workspace, {
          name: 'My Network',
          type: WorkspaceType.PERSONAL,
          ownerId: savedUser.id,
          timezone: 'UTC',
        }),
      );
      await manager.save(
        manager.create(Membership, {
          workspaceId: workspace.id,
          userId: savedUser.id,
          role: WorkspaceRole.OWNER,
        }),
      );
      return savedUser;
    });
    return this.issueSession(user, metadata);
  }

  async login(emailInput: string, password: string, metadata: SessionMetadata) {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', {
        email: emailInput.trim(),
      })
      .getOne();
    if (!user || !(await this.passwords.verify(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return this.issueSession(user, metadata);
  }

  async refresh(refreshToken: string) {
    const payload = await this.jwt
      .verifyAsync<{ sub: string; sid: string; type: string }>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_TOKEN_SECRET'),
      })
      .catch(() => {
        throw new UnauthorizedException('Invalid refresh token.');
      });
    const session = await this.sessions
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .leftJoinAndSelect('session.user', 'user')
      .where('session.id = :id', { id: payload.sid })
      .getOne();
    if (
      payload.type !== 'refresh' ||
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.refreshTokenHash !== this.tokenHash(refreshToken)
    ) {
      if (session && !session.revokedAt) {
        session.revokedAt = new Date();
        await this.sessions.save(session);
      }
      throw new UnauthorizedException('Refresh session expired or reused.');
    }

    session.revokedAt = new Date();
    await this.sessions.save(session);
    return this.issueSession(session.user, {
      userAgent: session.userAgent ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
    });
  }

  async profile(userId: string) {
    const user = await this.users.findOneByOrFail({ id: userId });
    return this.safeUser(user);
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

  private async issueSession(user: User, metadata: SessionMetadata) {
    const sessionId = randomUUID();
    const days = this.config.get<number>('JWT_REFRESH_TOKEN_TTL_DAYS', 30);
    const expiresAt = new Date(Date.now() + days * 86_400_000);
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
    await this.sessions.save(
      this.sessions.create({
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.tokenHash(refreshToken),
        expiresAt,
        revokedAt: null,
        userAgent: metadata.userAgent ?? null,
        ipAddress: metadata.ipAddress ?? null,
      }),
    );
    return { accessToken, refreshToken, user: this.safeUser(user) };
  }

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      preferences: user.preferences,
      createdAt: user.createdAt,
    };
  }
}
