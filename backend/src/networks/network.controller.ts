import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NetworkService } from './network.service';
import { AuthGuard } from '../auth/other/auth.guard';
import { CurrentUser } from '../auth/other/current-user.decorator';
import type { RequestUser } from '../auth/other/request-user';
import { networkDisclosure, adapterProfiles } from './other/network-values';
import {
  NetworkSiteDto,
  NetworkGrantDto,
  NetworkLocalDto,
  NetworkSnapshotDto,
  RouterSetupDto,
  EndpointUpdateDto,
  NetworkEventDto,
  CompatibilityDto,
} from './other/dto/network.dto';
@Controller({ path: 'networks', version: '1' })
export class NetworkDisclosureController {
  @Get('disclosure') disclosure() {
    return { ...networkDisclosure, adapterProfiles };
  }
}
@Controller({ path: 'workspaces/:workspaceId/networks', version: '1' })
@UseGuards(AuthGuard)
export class NetworkController {
  constructor(private readonly networks: NetworkService) {}
  @Get() list(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
  ) {
    return this.networks.list(u.userId, w);
  }
  @Post() create(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Body() input: NetworkSiteDto,
  ) {
    return this.networks.save(u.userId, w, input);
  }
  @Get(':networkId') view(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.networks.view(u.userId, w, id, from, to);
  }
  @Patch(':networkId') update(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
    @Body() input: NetworkSiteDto,
  ) {
    return this.networks.save(u.userId, w, input, id);
  }
  @Delete(':networkId') remove(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
  ) {
    return this.networks.remove(u.userId, w, id);
  }
  @Post(':networkId/collectors') grant(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
    @Body() input: NetworkGrantDto,
  ) {
    return this.networks.grant(u.userId, w, id, input);
  }
  @Post(':networkId/router') router(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
    @Body() input: RouterSetupDto,
  ) {
    return this.networks.router(u.userId, w, id, input);
  }
  @Delete(':networkId/router') clearRouter(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
  ) {
    return this.networks.clearRouter(u.userId, w, id);
  }
  @Post(':networkId/router/test') test(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
  ) {
    return this.networks.testRouter(u.userId, w, id);
  }
  @Patch(':networkId/endpoints/:endpointId') endpoint(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
    @Param('endpointId', ParseUUIDPipe) eid: string,
    @Body() input: EndpointUpdateDto,
  ) {
    return this.networks.endpoint(u.userId, w, id, eid, input);
  }
  @Delete(':networkId/endpoints/:endpointId') eraseEndpoint(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
    @Param('endpointId', ParseUUIDPipe) eid: string,
  ) {
    return this.networks.endpoint(u.userId, w, id, eid);
  }
  @Patch(':networkId/events/:eventId') event(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eid: string,
    @Body() input: NetworkEventDto,
  ) {
    return this.networks.review(u.userId, w, id, eid, input);
  }
  @Post(':networkId/compatibility') compatibility(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
    @Body() input: CompatibilityDto,
  ) {
    return this.networks.compatibility(u.userId, w, id, input);
  }
}
function token(value: string | undefined) {
  const [scheme, credential, extra] = (value ?? '').split(' ');
  return scheme === 'Bearer' && !extra ? (credential ?? '') : '';
}
@Controller({ path: 'agents/:agentId/network', version: '1' })
export class AgentNetworkController {
  constructor(private readonly networks: NetworkService) {}
  @Post('configuration') configuration(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string | undefined,
    @Body() input: NetworkLocalDto,
  ) {
    return this.networks.configuration(id, token(auth), input);
  }
  @Post('snapshot') snapshot(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string | undefined,
    @Body() input: NetworkSnapshotDto,
  ) {
    return this.networks.snapshot(id, token(auth), input);
  }
  @Post('pause') pause(
    @Param('agentId', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string | undefined,
  ) {
    return this.networks.pause(id, token(auth));
  }
}
