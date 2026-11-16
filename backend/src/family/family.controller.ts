import {
  Module,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/request-user';
import { DeviceGuard, type DeviceRequest } from '../devices/device.guard';
import { FamilyService } from './family.service';
import {
  ProfileDto,
  FamilyAssignmentDto,
  FamilyPolicyDto,
  FamilyRequestDto,
  FamilyDecisionDto,
  FamilyFeedbackDto,
  FamilyDeviceDto,
  FamilyReceiptDto,
} from './family.dto';
@Controller({ path: 'workspaces/:workspaceId/family', version: '1' })
@UseGuards(AuthGuard)
export class FamilyController {
  constructor(private readonly family: FamilyService) {}
  @Get() overview(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
  ) {
    return this.family.overview(u.userId, w);
  }
  @Post('profiles') create(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Body() i: ProfileDto,
  ) {
    return this.family.profile(u.userId, w, i);
  }
  @Get('profiles/:profileId') view(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('profileId', ParseUUIDPipe) id: string,
  ) {
    return this.family.view(u.userId, w, id);
  }
  @Patch('profiles/:profileId') update(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('profileId', ParseUUIDPipe) id: string,
    @Body() i: ProfileDto,
  ) {
    return this.family.profile(u.userId, w, i, id);
  }
  @Delete('profiles/:profileId') erase(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('profileId', ParseUUIDPipe) id: string,
  ) {
    return this.family.erase(u.userId, w, id);
  }
  @Post('profiles/:profileId/devices') assign(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('profileId', ParseUUIDPipe) id: string,
    @Body() i: FamilyAssignmentDto,
  ) {
    return this.family.assign(u.userId, w, id, i);
  }
  @Delete('profiles/:profileId/devices/:deviceId') withdraw(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('profileId', ParseUUIDPipe) id: string,
    @Param('deviceId', ParseUUIDPipe) d: string,
  ) {
    return this.family.withdraw(u.userId, w, id, d);
  }
  @Post('profiles/:profileId/policy') policy(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('profileId', ParseUUIDPipe) id: string,
    @Body() i: FamilyPolicyDto,
  ) {
    return this.family.policy(u.userId, w, id, i);
  }
  @Post('profiles/:profileId/requests') request(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('profileId', ParseUUIDPipe) id: string,
    @Body() i: FamilyRequestDto,
  ) {
    return this.family.request(u.userId, w, id, i);
  }
  @Post('profiles/:profileId/overrides') override(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('profileId', ParseUUIDPipe) id: string,
    @Body() i: FamilyRequestDto,
  ) {
    return this.family.request(u.userId, w, id, i, true);
  }
  @Patch('profiles/:profileId/requests/:requestId') decide(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('profileId', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) r: string,
    @Body() i: FamilyDecisionDto,
  ) {
    return this.family.decide(u.userId, w, id, r, i.decision);
  }
  @Post('profiles/:profileId/feedback') feedback(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Param('profileId', ParseUUIDPipe) id: string,
    @Body() i: FamilyFeedbackDto,
  ) {
    return this.family.feedback(u.userId, w, id, i);
  }
}
@Controller({ path: 'devices/:deviceId/family', version: '1' })
@UseGuards(DeviceGuard)
export class FamilyDeviceController {
  constructor(private readonly family: FamilyService) {}
  @Post('configuration') config(
    @Req() r: DeviceRequest,
    @Body() i: FamilyDeviceDto,
  ) {
    return this.family.deviceConfiguration(r.monitoringDevice.id, i.generation);
  }
  @Post('receipt') receipt(
    @Req() r: DeviceRequest,
    @Body() i: FamilyReceiptDto,
  ) {
    return this.family.receipt(r.monitoringDevice.id, i);
  }
}
@Controller({ path: 'devices', version: '1' })
@UseGuards(AuthGuard)
export class FamilyPrivacyController {
  constructor(private readonly family: FamilyService) {}
  @Delete(':deviceId/family-assignment') withdraw(
    @CurrentUser() u: RequestUser,
    @Param('deviceId', ParseUUIDPipe) id: string,
  ) {
    return this.family.withdrawOwn(u.userId, id);
  }
}
@Module({
  imports: [AuthModule],
  controllers: [
    FamilyController,
    FamilyDeviceController,
    FamilyPrivacyController,
  ],
  providers: [FamilyService, DeviceGuard],
})
export class FamilyModule {}
