import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/other/auth.guard';
import { CurrentUser } from '../auth/other/current-user.decorator';
import type { RequestUser } from '../auth/other/request-user';
import { DeveloperService, developerDisclosure } from './developer.service';
import {
  DeveloperPolicyDto,
  DeveloperSnapshotDto,
  RemoteCommandDto,
  CommandLeaseDto,
  CommandResultDto,
} from './dto/developer.dto';
@Controller({ path: 'workspaces/:workspaceId', version: '1' })
@UseGuards(AuthGuard)
export class WorkspaceDeveloperController {
  constructor(private service: DeveloperService) {}
  @Get('developer') list(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
  ) {
    return this.service.list(u.userId, wid);
  }
  @Patch('agents/:agentId/developer-policy') policy(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
    @Param('agentId', ParseUUIDPipe) id: string,
    @Body() input: DeveloperPolicyDto,
  ) {
    return this.service.policy(u.userId, wid, id, input);
  }
  @Get('agents/:agentId/commands') commands(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
    @Param('agentId', ParseUUIDPipe) id: string,
  ) {
    return this.service.commands(u.userId, wid, id);
  }
  @Post('agents/:agentId/commands') create(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
    @Param('agentId', ParseUUIDPipe) id: string,
    @Body() input: RemoteCommandDto,
  ) {
    return this.service.create(u.userId, wid, id, input);
  }
  @Post('agents/:agentId/commands/:commandId/cancel') cancel(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
    @Param('agentId', ParseUUIDPipe) id: string,
    @Param('commandId', ParseUUIDPipe) cid: string,
  ) {
    return this.service.cancel(u.userId, wid, id, cid);
  }
}
function bearer(value: string | undefined) {
  const parts = (value ?? '').split(' ');
  return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : '';
}
@Controller({ path: 'agents', version: '1' })
export class DeveloperAgentController {
  constructor(private service: DeveloperService) {}
  @Get('developer-disclosure') disclosure() {
    return { version: 'developer-sharing-v1', text: developerDisclosure };
  }
  @Get(':agentId/developer/configuration') config(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Headers('authorization') token: string | undefined,
  ) {
    return this.service.configuration(id, bearer(token));
  }
  @Post(':agentId/developer/snapshot') snapshot(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Headers('authorization') token: string | undefined,
    @Body() input: DeveloperSnapshotDto,
  ) {
    return this.service.snapshot(id, bearer(token), input);
  }
  @Post(':agentId/developer/pause') pause(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Headers('authorization') token: string | undefined,
  ) {
    return this.service.pause(id, bearer(token));
  }
  @Post(':agentId/developer/poll') poll(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Headers('authorization') token: string | undefined,
  ) {
    return this.service.poll(id, bearer(token));
  }
  @Post(':agentId/developer/commands/:commandId/start') start(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Param('commandId', ParseUUIDPipe) cid: string,
    @Headers('authorization') token: string | undefined,
    @Body() input: CommandLeaseDto,
  ) {
    return this.service.start(id, bearer(token), cid, input.leaseToken);
  }
  @Post(':agentId/developer/commands/:commandId/result') result(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Param('commandId', ParseUUIDPipe) cid: string,
    @Headers('authorization') token: string | undefined,
    @Body() input: CommandResultDto,
  ) {
    return this.service.result(id, bearer(token), cid, input);
  }
}
