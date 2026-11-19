import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { IsNull, MoreThan, Repository } from 'typeorm';
import type { RequestUser } from './request-user';
import { AccountStatus } from '../../users/entity/user.entity';
import { Session } from '../entity/session.entity';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const [kind, token] = (request.headers.authorization ?? '').split(' ');
    if (kind !== 'Bearer' || !token) throw new UnauthorizedException();

    const payload = await this.jwt
      .verifyAsync<{ sub: string; sid: string; email: string; type: string }>(
        token,
        { secret: this.config.getOrThrow('JWT_ACCESS_TOKEN_SECRET') },
      )
      .catch(() => {
        throw new UnauthorizedException('Invalid access token.');
      });
    if (payload.type !== 'access') throw new UnauthorizedException();
    const session = await this.sessions.findOne({
      where: { id: payload.sid, userId: payload.sub },
      relations: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== AccountStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Session expired.');
    }
    const touched = await this.sessions.update(
      {
        id: session.id,
        userId: payload.sub,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      { lastUsedAt: new Date() },
    );
    if (touched.affected !== 1)
      throw new UnauthorizedException('Session expired.');
    request.user = {
      userId: payload.sub,
      sessionId: payload.sid,
      email: payload.email,
    };
    return true;
  }
}
