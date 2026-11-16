import { IsOptional, IsUUID } from 'class-validator';
import {
  Module,
  Controller,
  UseGuards,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/request-user';
import { CollaborationService } from '../workspaces/collaboration.service';
import { WorkspaceModule } from '../workspaces/workspace.module';
import { BusinessService } from './business.service';
import {
  EndpointDepartmentDto,
  NameDto,
  DepartmentDto,
  EmployeeDto,
  EmployeeDepartmentDto,
  NetworkLocationDto,
  AssignmentDto,
  BusinessConsentDto,
  CustodyDto,
  ComplianceDto,
  BusinessAlertDto,
  BusinessReportQuery,
  ConfirmOffboardDto,
  ConfirmUnenrolDto,
} from './business.dto';
export class BusinessScopeQuery {
  @IsOptional() @IsUUID() locationId?: string;
}
@Controller({ path: 'workspaces/:workspaceId/business', version: '1' })
@UseGuards(AuthGuard)
export class BusinessController {
  constructor(
    private readonly business: BusinessService,
    private readonly collaboration: CollaborationService,
  ) {}
  @Get() overview(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Query() q: BusinessScopeQuery,
  ) {
    return this.business.overview(u.userId, w, q.locationId);
  }
  @Patch('endpoints/:endpointId/department') endpointDepartment(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('endpointId', ParseUUIDPipe) id: string,
    @Body() input: EndpointDepartmentDto,
  ) {
    return this.business.endpointDepartment(u.userId, w, id, input);
  }
  @Post('locations') location(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Body() i: NameDto,
  ) {
    return this.business.saveLocation(u.userId, w, i);
  }
  @Patch('locations/:locationId') updateLocation(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('locationId', ParseUUIDPipe) id: string,
    @Body() i: NameDto,
  ) {
    return this.business.saveLocation(u.userId, w, i, id);
  }
  @Post('departments') department(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Body() i: DepartmentDto,
  ) {
    return this.business.saveDepartment(u.userId, w, i);
  }
  @Patch('departments/:departmentId') updateDepartment(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('departmentId', ParseUUIDPipe) id: string,
    @Body() i: DepartmentDto,
  ) {
    return this.business.saveDepartment(u.userId, w, i, id);
  }
  @Post('employees') employee(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Body() i: EmployeeDto,
  ) {
    return this.business.createEmployee(u.userId, w, i);
  }
  @Patch('employees/:employeeId') updateEmployee(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('employeeId', ParseUUIDPipe) id: string,
    @Body() i: EmployeeDepartmentDto,
  ) {
    return this.business.updateEmployee(u.userId, w, id, i);
  }
  @Post('employees/:employeeId/offboard') async offboard(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('employeeId', ParseUUIDPipe) id: string,
    @Body() _i: ConfirmOffboardDto,
  ) {
    const target = await this.business.offboardTarget(u.userId, w, id);
    return this.collaboration.changeMember(u.userId, w, target);
  }
  @Patch('networks/:networkId/location') network(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('networkId', ParseUUIDPipe) id: string,
    @Body() i: NetworkLocationDto,
  ) {
    return this.business.locateNetwork(u.userId, w, id, i.locationId);
  }
  @Post('devices/:deviceId/custody') custody(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('deviceId', ParseUUIDPipe) id: string,
    @Body() _i: CustodyDto,
  ) {
    return this.business.declareAsset(u.userId, w, id);
  }
  @Post('devices/:deviceId/assignment') assign(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('deviceId', ParseUUIDPipe) id: string,
    @Body() i: AssignmentDto,
  ) {
    return this.business.assign(u.userId, w, id, i);
  }
  @Post('devices/:deviceId/sharing') consent(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('deviceId', ParseUUIDPipe) id: string,
    @Body() i: BusinessConsentDto,
  ) {
    return this.business.consent(u.userId, w, id, i);
  }
  @Delete('devices/:deviceId/assignment') withdraw(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('deviceId', ParseUUIDPipe) id: string,
  ) {
    return this.business.withdraw(u.userId, w, id);
  }
  @Post('devices/:deviceId/unenrol') unenrol(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('deviceId', ParseUUIDPipe) id: string,
    @Body() _i: ConfirmUnenrolDto,
  ) {
    return this.business.unenrol(u.userId, w, id);
  }
  @Post('compliance-policy') policy(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Body() i: ComplianceDto,
  ) {
    return this.business.compliance(u.userId, w, i);
  }
  @Get('reports') report(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Query() i: BusinessReportQuery,
  ) {
    return this.business.report(u.userId, w, i);
  }
  @Get('reports/export') reportExport(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Query() i: BusinessReportQuery,
  ) {
    return this.business.report(u.userId, w, i, true);
  }
  @Get('alerts') alerts(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
  ) {
    return this.business.alerts(u.userId, w);
  }
  @Patch('alerts/:eventId') alert(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('eventId', ParseUUIDPipe) id: string,
    @Body() i: BusinessAlertDto,
  ) {
    return this.business.assignAlert(u.userId, w, id, i);
  }
  @Get('audit') audit(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Query() i: BusinessReportQuery,
  ) {
    return this.business.audit(u.userId, w, i);
  }
  @Get('audit/export') auditExport(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Query() i: BusinessReportQuery,
  ) {
    return this.business.audit(u.userId, w, i, true);
  }
}
@Module({
  imports: [AuthModule, WorkspaceModule],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
