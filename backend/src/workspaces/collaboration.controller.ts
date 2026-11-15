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
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/request-user';
import { CollaborationService } from './collaboration.service';
import {
  AcceptInvitationDto,
  ChangeRoleDto,
  InvitationDto,
  TransferOwnershipDto,
} from './dto/collaboration.dto';

@Controller({ path: 'workspaces', version: '1' })
@UseGuards(AuthGuard)
export class CollaborationController {
  constructor(private readonly collaboration: CollaborationService) {}
  @Post('invitations/accept')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  accept(@CurrentUser() user: RequestUser, @Body() input: AcceptInvitationDto) {
    return this.collaboration.accept(user.userId, input.token);
  }
  @Post(':workspaceId/invitations')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  invite(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Body() input: InvitationDto,
  ) {
    return this.collaboration.invite(user.userId, id, input);
  }
  @Get(':workspaceId/invitations')
  invitations(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
  ) {
    return this.collaboration.invitations(user.userId, id);
  }
  @Delete(':workspaceId/invitations/:invitationId')
  revoke(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.collaboration.revokeInvitation(user.userId, id, invitationId);
  }
  @Post(':workspaceId/select')
  select(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
  ) {
    return this.collaboration.select(user.userId, id);
  }
  @Get(':workspaceId/members')
  members(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
  ) {
    return this.collaboration.members(user.userId, id);
  }
  @Get(':workspaceId/permissions')
  permissions(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
  ) {
    return this.collaboration.permissions(user.userId, id);
  }
  @Patch(':workspaceId/members/:userId')
  role(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
    @Body() input: ChangeRoleDto,
  ) {
    return this.collaboration.changeMember(
      user.userId,
      id,
      targetId,
      input.role,
    );
  }
  @Delete(':workspaceId/members/:userId')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
  ) {
    return this.collaboration.changeMember(user.userId, id, targetId);
  }
  @Post(':workspaceId/owner')
  transfer(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Body() input: TransferOwnershipDto,
  ) {
    return this.collaboration.transfer(user.userId, id, input.userId);
  }
}
