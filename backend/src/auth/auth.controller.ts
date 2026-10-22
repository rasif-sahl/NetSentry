import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import type { RequestUser } from './request-user';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  register(
    @Body() input: RegisterDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Ip() ipAddress: string,
  ) {
    return this.auth.register(input, { userAgent, ipAddress });
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(
    @Body() input: LoginDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Ip() ipAddress: string,
  ) {
    return this.auth.login(input.email, input.password, {
      userAgent,
      ipAddress,
    });
  }

  @Post('refresh')
  refresh(@Body() input: RefreshDto) {
    return this.auth.refresh(input.refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return this.auth.profile(user.userId);
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  sessions(@CurrentUser() user: RequestUser) {
    return this.auth.listSessions(user.userId);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(AuthGuard)
  async revoke(
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
  ) {
    await this.auth.revokeSession(user.userId, sessionId);
    return { revoked: true };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@CurrentUser() user: RequestUser) {
    await this.auth.revokeSession(user.userId, user.sessionId);
    return { loggedOut: true };
  }
}
