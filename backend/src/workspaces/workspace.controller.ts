import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/request-user';
import { CreateWorkspaceDto, RegisterDeviceDto } from './dto/workspace.dto';
import { WorkspaceService } from './workspace.service';

@Controller({ path: 'workspaces', version: '1' })
@UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspaceService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.workspaces.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() input: CreateWorkspaceDto) {
    return this.workspaces.create(user.userId, input);
  }

  @Get(':workspaceId/devices')
  devices(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaces.listDevices(user.userId, workspaceId);
  }

  @Post('devices')
  registerDevice(
    @CurrentUser() user: RequestUser,
    @Body() input: RegisterDeviceDto,
  ) {
    return this.workspaces.registerDevice(user.userId, input);
  }
}
