import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/request-user';
import { DeviceGuard, type DeviceRequest } from '../devices/device.guard';
import { ApplicationService } from './application.service';
import {
  ApplicationCategoryDto,
  ApplicationCorrectionDto,
  ApplicationQuery,
} from './application.dto';
@Controller({ path: 'devices', version: '1' })
export class ApplicationIngestionController {
  constructor(private readonly applications: ApplicationService) {}
  @Post(':deviceId/application-usage')
  @UseGuards(DeviceGuard)
  ingest(@Req() request: DeviceRequest, @Body() input: unknown) {
    return this.applications.ingest(request.monitoringDevice, input);
  }
}
@Controller({ path: 'workspaces/:workspaceId/monitoring', version: '1' })
@UseGuards(AuthGuard)
export class ApplicationController {
  constructor(private readonly applications: ApplicationService) {}
  @Get('application-usage') report(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspace: string,
    @Query() query: ApplicationQuery,
  ) {
    return this.applications.report(user.userId, workspace, query);
  }
  @Get('application-export') export(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspace: string,
    @Query() query: ApplicationQuery,
  ) {
    return this.applications.report(user.userId, workspace, query, true);
  }
  @Post('application-categories') category(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspace: string,
    @Body() input: ApplicationCategoryDto,
  ) {
    return this.applications.category(
      user.userId,
      workspace,
      input.deviceId,
      input.name,
    );
  }
  @Delete('application-categories/:categoryId') remove(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspace: string,
    @Param('categoryId', ParseUUIDPipe) category: string,
    @Query('deviceId', ParseUUIDPipe) device: string,
  ) {
    return this.applications.category(
      user.userId,
      workspace,
      device,
      '',
      category,
    );
  }
  @Patch('application-classification') correction(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspace: string,
    @Body() input: ApplicationCorrectionDto,
  ) {
    return this.applications.correction(
      user.userId,
      workspace,
      input.deviceId,
      input.applicationId,
      input.categoryId,
    );
  }
}
