import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/request-user';
import { AlertService } from './alert.service';
import { AlertRuleDto, NotificationPreferenceDto } from './dto/alert.dto';
@Controller({ path: 'workspaces/:workspaceId/monitoring', version: '1' })
@UseGuards(AuthGuard)
export class AlertController {
  constructor(private readonly alerts: AlertService) {}
  @Post('rules') create(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
    @Body() input: AlertRuleDto,
  ) {
    return this.alerts.save(user.userId, wid, input);
  }
  @Patch('rules/:ruleId') update(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
    @Param('ruleId', ParseUUIDPipe) id: string,
    @Body() input: AlertRuleDto,
  ) {
    return this.alerts.save(user.userId, wid, input, id);
  }
  @Delete('rules/:ruleId') remove(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
    @Param('ruleId', ParseUUIDPipe) id: string,
  ) {
    return this.alerts.remove(user.userId, wid, id);
  }
  @Get('rules') rules(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
  ) {
    return this.alerts.listRules(user.userId, wid);
  }
  @Get('alerts') list(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
  ) {
    return this.alerts.list(user.userId, wid);
  }
  @Get('notifications') notifications(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
  ) {
    return this.alerts.list(user.userId, wid, true);
  }
  @Post('alerts/:alertId/acknowledge') acknowledge(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
    @Param('alertId', ParseUUIDPipe) id: string,
  ) {
    return this.alerts.acknowledge(user.userId, wid, id);
  }
  @Get('diagnostics') diagnostics(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
  ) {
    return this.alerts.diagnostics(user.userId, wid);
  }
}
@Controller({ path: 'notifications/preferences', version: '1' })
@UseGuards(AuthGuard)
export class NotificationPreferenceController {
  constructor(private readonly alerts: AlertService) {}
  @Get() read(@CurrentUser() user: RequestUser) {
    return this.alerts.preferences(user.userId);
  }
  @Patch() update(
    @CurrentUser() user: RequestUser,
    @Body() input: NotificationPreferenceDto,
  ) {
    return this.alerts.preferences(user.userId, input);
  }
}
