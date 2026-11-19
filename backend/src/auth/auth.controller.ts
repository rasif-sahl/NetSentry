import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from './other/auth.guard';
import { AccountActionsService } from './account-actions.service';
import {
  EmailDto,
  ActionTokenDto,
  ResetPasswordDto,
  PreferencesDto,
  UpdateProfileDto,
} from './dto/account.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './other/current-user.decorator';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import type { RequestUser } from './other/request-user';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly actions: AccountActionsService,
  ) {}

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

  @Post('verification/request')
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  requestVerification(@CurrentUser() user: RequestUser) {
    return this.actions.requestVerification(user.userId);
  }

  @Post('verification/confirm')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyEmail(@Body() input: ActionTokenDto) {
    return this.actions.confirm(input.token, 'verify_email');
  }

  @Post('password/forgot')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  forgotPassword(@Body() input: EmailDto) {
    return this.actions.forgot(input.email);
  }

  @Post('password/reset')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  resetPassword(@Body() input: ResetPasswordDto) {
    return this.actions.confirm(input.token, 'reset_password', input.password);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() input: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(user.userId, input.displayName);
  }

  @Patch('preferences')
  @UseGuards(AuthGuard)
  preferences(@CurrentUser() user: RequestUser, @Body() input: PreferencesDto) {
    return this.auth.preferences(user.userId, input);
  }

  @Delete('sessions')
  @UseGuards(AuthGuard)
  revokeOthers(@CurrentUser() user: RequestUser) {
    return this.auth.revokeOthers(user.userId, user.sessionId);
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
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
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
