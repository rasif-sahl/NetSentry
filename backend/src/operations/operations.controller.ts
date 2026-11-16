import {
  Controller,
  Module,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/request-user';
import { OperationsService } from './operations.service';
import { AccountStatusDto, FlagDto, CompatibilityDto } from './operations.dto';
@Controller({ path: 'operations', version: '1' })
@UseGuards(AuthGuard)
export class OperationsController {
  constructor(private readonly ops: OperationsService) {}
  @Get('access') access(@CurrentUser() u: RequestUser) {
    return this.ops.access(u.userId);
  }
  @Get() view(@CurrentUser() u: RequestUser) {
    return this.ops.overview(u.userId);
  }
  @Get('users') users(@CurrentUser() u: RequestUser) {
    return this.ops.users(u.userId);
  }
  @Post('users/:userId/status') status(
    @CurrentUser() u: RequestUser,
    @Param('userId', ParseUUIDPipe) id: string,
    @Body() i: AccountStatusDto,
  ) {
    return this.ops.status(u.userId, id, i.status, i.password);
  }
  @Get('workspaces/:workspaceId/diagnostics') diagnostics(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
  ) {
    return this.ops.diagnostics(u.userId, id);
  }
  @Post('flags') flag(@CurrentUser() u: RequestUser, @Body() i: FlagDto) {
    return this.ops.flag(u.userId, i);
  }
  @Post('compatibility') compatibility(
    @CurrentUser() u: RequestUser,
    @Body() i: CompatibilityDto,
  ) {
    return this.ops.compatibility(u.userId, i);
  }
}
@Module({
  imports: [AuthModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
