import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/other/auth.guard';
import { CurrentUser } from '../auth/other/current-user.decorator';
import type { RequestUser } from '../auth/other/request-user';
import { ReportService } from './report.service';
import {
  UsageQuery,
  RetentionDto,
  NetworkDto,
  NetworkAssignmentDto,
} from './dto/report.dto';
@Controller({ path: 'workspaces/:workspaceId/monitoring', version: '1' })
@UseGuards(AuthGuard)
export class ReportController {
  constructor(private readonly reports: ReportService) {}
  @Get('usage') report(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Query() input: UsageQuery,
  ) {
    return this.reports.report(user.userId, id, input);
  }
  @Get('export') export(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Query() input: UsageQuery,
  ) {
    return this.reports.report(user.userId, id, input, true);
  }
  @Get('retention') retention(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
  ) {
    return this.reports.retention(user.userId, id);
  }
  @Patch('retention') updateRetention(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Body() input: RetentionDto,
  ) {
    return this.reports.retention(user.userId, id, input);
  }
  @Get('networks') networks(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
  ) {
    return this.reports.networks(user.userId, id);
  }
  @Post('networks') createNetwork(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Body() input: NetworkDto,
  ) {
    return this.reports.networks(user.userId, id, input.name);
  }
  @Post('network-assignment') assign(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Body() input: NetworkAssignmentDto,
  ) {
    return this.reports.assign(
      user.userId,
      id,
      input.deviceId,
      input.networkId,
    );
  }
}
