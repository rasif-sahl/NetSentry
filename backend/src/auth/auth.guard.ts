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
import { Repository } from 'typeorm';
import type { RequestUser } from './request-user';
import { Session } from './session.entity';

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
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired.');
    }
    request.user = {
      userId: payload.sub,
      sessionId: payload.sid,
      email: payload.email,
    };
    return true;
  }
}
