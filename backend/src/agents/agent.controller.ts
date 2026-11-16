import { DeveloperService } from './developer.service';
import {
  WorkspaceDeveloperController,
  DeveloperAgentController,
} from './developer.controller';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/request-user';
import { AgentService, agentDisclosure } from './agent.service';
import {
  AgentEnrolmentDto,
  AgentHeartbeatDto,
  AgentRedeemDto,
  AgentSettingsDto,
  AgentSyncDto,
} from './agent.dto';
function bearer(value: string | undefined) {
  const [scheme, token, extra] = (value ?? '').split(' ');
  return scheme === 'Bearer' && !extra ? (token ?? '') : '';
}
@Controller({ path: 'workspaces/:workspaceId/agents', version: '1' })
@UseGuards(AuthGuard)
export class WorkspaceAgentController {
  constructor(private readonly agents: AgentService) {}
  @Get() list(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
  ) {
    return this.agents.list(user.userId, id);
  }
  @Post('enrolments')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  issue(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Body() input: AgentEnrolmentDto,
  ) {
    return this.agents.issue(user.userId, id, input);
  }
  @Patch(':agentId') settings(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
    @Param('agentId', ParseUUIDPipe) id: string,
    @Body() input: AgentSettingsDto,
  ) {
    return this.agents.manage(user.userId, wid, id, input);
  }
  @Delete(':agentId') revoke(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
    @Param('agentId', ParseUUIDPipe) id: string,
  ) {
    return this.agents.manage(user.userId, wid, id);
  }
  @Delete(':agentId/data') erase(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) wid: string,
    @Param('agentId', ParseUUIDPipe) id: string,
  ) {
    return this.agents.manage(user.userId, wid, id, undefined, true);
  }
}
@Controller({ path: 'agents', version: '1' })
export class AgentController {
  constructor(private readonly agents: AgentService) {}
  @Get('disclosure') disclosure() {
    return { version: 'agent-enrolment-v1', text: agentDisclosure };
  }
  @Post('enrol') @Throttle({ default: { limit: 20, ttl: 60000 } }) enrol(
    @Body() input: AgentRedeemDto,
  ) {
    return this.agents.redeem(input);
  }
  @Get(':agentId/configuration') configuration(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string | undefined,
  ) {
    return this.agents.device(id, bearer(auth), async (_manager, agent) =>
      this.agents.configuration(agent),
    );
  }
  @Post(':agentId/heartbeat') heartbeat(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string | undefined,
    @Body() input: AgentHeartbeatDto,
  ) {
    return this.agents.heartbeat(id, bearer(auth), input);
  }
  @Post(':agentId/sync') sync(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string | undefined,
    @Body() input: AgentSyncDto,
  ) {
    return this.agents.sync(id, bearer(auth), input);
  }
}
@Module({
  imports: [AuthModule],
  controllers: [
    WorkspaceAgentController,
    AgentController,
    WorkspaceDeveloperController,
    DeveloperAgentController,
  ],
  providers: [AgentService, DeveloperService],
})
export class AgentModule {}
