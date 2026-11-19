import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/other/auth.guard';
import { CurrentUser } from '../auth/other/current-user.decorator';
import type { RequestUser } from '../auth/other/request-user';
import { ConfirmPasswordDto } from '../auth/other/dto/account.dto';
import { DeleteAccountDto } from './other/dto/privacy.dto';
import { PrivacyService } from './privacy.service';
@Controller({ path: 'privacy', version: '1' })
@UseGuards(AuthGuard)
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}
  @Post('export')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  export(@CurrentUser() user: RequestUser, @Body() input: ConfirmPasswordDto) {
    return this.privacy.export(user.userId, input.password);
  }
  @Get('history')
  history(@CurrentUser() user: RequestUser) {
    return this.privacy.history(user.userId);
  }
  @Delete('account')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  delete(@CurrentUser() user: RequestUser, @Body() input: DeleteAccountDto) {
    return this.privacy.deleteAccount(user.userId, input.password);
  }
}
